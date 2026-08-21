// Vigilante de la zona ciega del handoff a Mateo (WhatsApp).
//
// POR QUÉ EXISTE
// Cuando el bot deriva un chat a Mateo, deja de responder — es la conducta correcta, no una
// falla, y `ia-watchdog` ya cubre el caso de que el bot mismo esté fallando (errores/saldo
// agotado). Lo que ningún vigilante mira es qué pasa DESPUÉS de derivar: las respuestas de
// Mateo no se loguean en ningún lado. Se confirmó en vivo (20/08/2026) que no se puede
// reconectar un bridge de lectura a su número — WhatsApp lo bloquea (ver memoria
// feedback_bridge_baileys_bloqueado_confirmado). Este cron no finge saber si Mateo atendió:
// solo avisa cuánto tiempo lleva un cliente esperando en esa zona ciega, para que alguien
// vaya a mirar a mano.
//
// Vive en GitHub Actions y no en el VPS ni en vercel.json, por la misma regla que el resto
// de la vigilancia (ver CLAUDE.md): un vigilante no puede depender de la infraestructura
// que vigila, y Vercel Hobby topea en 2 crons diarios.
import { NextResponse } from 'next/server'
import { chequearCron } from '@/lib/cron-auth'
import { getPool } from '@/lib/db'
import { notifyNahuel } from '@/lib/notify'
import { consumirLimite } from '@/lib/ratelimit'
import { marcarHeartbeat } from '@/lib/cron-heartbeat'
import { ultimaDerivacion, handoffEsPermanente } from '@/lib/diag'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Debe coincidir con HANDOFF_HORAS del webhook (app/api/webhooks/whatsapp/route.ts): es la
 * misma ventana en la que un chat derivado sigue "en manos de una persona" para el bot. Si
 * se cambia ahí, cambiar acá también — no se pudo compartir la constante entre dos rutas
 * de Next sin exportarla del archivo de ruta, que no es un patrón usado en este repo.
 */
const HANDOFF_HORAS = 6
/**
 * Ventana de los handoff que NO expiran (plata, cancelación, conflicto legal): debe
 * coincidir con HANDOFF_HORAS_MAX del webhook. Sin esto, el vigilante dejaba de mirar a las
 * 6 h justo los casos que el webhook ahora retiene indefinidamente — es decir, se volvía
 * ciego exactamente donde más importa (caso Gerchu, 19/08/2026).
 */
const HANDOFF_HORAS_MAX = 24 * 30
/** Horas en zona ciega antes de recordar que sigue sin confirmación. */
const HANDOFF_ALERTA_H = 3
/** No repetir el recordatorio más de una vez cada 6 h por cliente. */
const REALERTA_H = 6
/** Los casos sensibles se recuerdan mas seguido: nadie mas los va a destrabar. */
const REALERTA_PERMANENTE_H = 2

export async function GET(req: Request) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth

  const pool = getPool()
  if (!pool) return NextResponse.json({ error: 'sin base' }, { status: 503 })

  try {
    const zonaCiega = await revisarZonaCiega(pool)
    await marcarHeartbeat('atencion-watchdog', true, `zona_ciega=${zonaCiega.avisados}`)
    return NextResponse.json({ ok: true, zonaCiega })
  } catch (e) {
    await marcarHeartbeat('atencion-watchdog', false, String(e).slice(0, 300))
    return NextResponse.json({ ok: false, error: String(e).slice(0, 300) })
  }
}

/**
 * Clientes cuya última señal conocida es "derivado a Mateo" (handoff activo) desde hace
 * más de HANDOFF_ALERTA_H. No prueba que Mateo NO haya contestado — solo que no hay forma
 * de saberlo desde acá, y que ya pasó tiempo suficiente para que valga la pena mirar a mano.
 *
 * Reusa `ultimaDerivacion()` (la misma función que usa el webhook para decidir el handoff
 * lock) en vez de reconstruir esa lógica en SQL: solo hay UN 'pensado' con derivar=true por
 * ciclo de derivación (los mensajes siguientes del cliente generan 'handoff_activo', no un
 * 'pensado' nuevo, porque el webhook corta antes de volver a pensar) — así que esa función
 * ya devuelve el inicio del handoff actual, probada en producción.
 *
 * OJO: la derivación por FALLA del bot (catch-all del webhook, `derivarAlEquipo` directo)
 * no pasa por `wdiag('pensado', ..., {derivar:true})` — solo manda el mensaje. Esos casos
 * no quedan marcados como handoff para `ultimaDerivacion()` y este cron no los ve. No es un
 * bug de este archivo: es una zona ciega dentro de la zona ciega, ya existente en el código
 * del webhook, no algo que corresponda arreglar acá.
 */
async function revisarZonaCiega(pool: NonNullable<ReturnType<typeof getPool>>) {
  // Candidatos: clientes con actividad de handoff reciente (dentro de la ventana en la que
  // el webhook los sigue considerando derivados).
  const { rows } = await pool.query<{ sender: string }>(
    `SELECT DISTINCT sender FROM ig_diag
      WHERE canal = 'wa' AND kind = 'handoff_activo'
        AND ts > now() - interval '${HANDOFF_HORAS_MAX} hours'`,
  )

  let avisados = 0
  for (const { sender } of rows) {
    // Los casos delicados se retienen hasta que una persona los cierre, así que se los
    // busca en la ventana larga; el resto sigue con la de 6 h.
    const permanente = await handoffEsPermanente(sender)
    const desde = await ultimaDerivacion(sender, permanente ? HANDOFF_HORAS_MAX : HANDOFF_HORAS)
    if (!desde) continue // ya salió de la ventana de handoff, o falló la consulta

    const horas = (Date.now() - desde.getTime()) / 3_600_000
    if (horas < HANDOFF_ALERTA_H) continue

    // En un caso sensible el bot ya no responde nunca: el unico que puede destrabarlo es
    // una persona, asi que se insiste mas seguido. En el resto, el ritmo normal.
    const reAlerta = permanente ? REALERTA_PERMANENTE_H : REALERTA_H
    const { permitido } = await consumirLimite(`watchdog:zona_ciega:${sender}`, 1, reAlerta * 3600)
    if (!permitido) continue

    avisados++
    // Un caso delicado no es "puede que ya este resuelto": el bot esta callado a proposito
    // y nadie mas lo va a atender. El aviso lo dice con todas las letras.
    await notifyNahuel(
      permanente
        ? `⚠️ Caso SENSIBLE sin atender hace ${Math.round(horas)} h (plata / cancelación / legal)`
        : `Cliente esperando a Mateo hace ${Math.round(horas)} h (sin confirmación)`,
      permanente
        ? `Un cliente con un reclamo DELICADO (cancelación, reintegro o conflicto) está derivado ` +
          `desde hace ${Math.round(horas)} h.\n\n` +
          `El bot NO va a retomar este chat: en estos casos el handoff no expira a propósito ` +
          `(el 19/08/2026 el bot retomó uno así y terminó inventando un número de reclamo, con el ` +
          `cliente anunciando una denuncia en Defensa del Consumidor).\n\n` +
          `O sea: si no entra una persona, este cliente no recibe respuesta de nadie.\n\n` +
          `Ver el hilo: https://mw-micelium.vercel.app/conversaciones`
        : `Este cliente está derivado desde hace ${Math.round(horas)} h y seguimos sin poder confirmar ` +
          `si alguien le contestó — las respuestas de Mateo no quedan logueadas en ningún sistema.\n\n` +
          `No es necesariamente un problema: puede que ya esté resuelto por WhatsApp normal y este ` +
          `aviso sea el único rastro que va a quedar. Solo lo marcamos porque ya pasó tiempo.\n\n` +
          `Ver el hilo: https://mw-micelium.vercel.app/conversaciones`,
    )
  }

  return { revisados: rows.length, avisados }
}
