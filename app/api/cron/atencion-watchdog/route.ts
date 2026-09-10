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
import { ultimaDerivacion, handoffEsPermanente, diag } from '@/lib/diag'

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
/** kind del log que numera los avisos de este caso (ver `contarAvisosDelCaso`). */
const KIND_WATCHDOG_AVISADO = 'watchdog_avisado'

export async function GET(req: Request) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth

  const pool = getPool()
  if (!pool) return NextResponse.json({ error: 'sin base' }, { status: 503 })

  try {
    const zonaCiega = await revisarZonaCiega(pool)
    await mandarDigestReincidentes(zonaCiega.reincidentes)
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
 * POR QUÉ LOS CANDIDATOS SALEN DE DOS KINDS Y NO SOLO DE 'handoff_activo' (auditoría
 * 10/09/2026)
 * Hasta acá el query solo miraba `kind = 'handoff_activo'` — y ESE kind solo se escribe
 * cuando el cliente, ya derivado, vuelve a escribir (el segundo mensaje de alguien en
 * handoff genera 'handoff_activo', no un 'pensado' nuevo, porque el webhook corta antes de
 * volver a pensar). O sea: el vigilante solo veía al cliente que INSISTE. El que deriva y
 * espera en silencio —el comportamiento normal y educado— nunca generaba esa señal y
 * quedaba invisible para siempre. Medido sobre 10 días reales: 17 derivaciones, y de esas
 * solo 3 habían generado alguna vez una alerta. Las otras 14 —dos leads de compra
 * mayorista, una rotura de fábrica, dos comprobantes de pago sin verificar— nunca entraron
 * al radar.
 *
 * El fix: sumar como candidato a CUALQUIER derivación reciente ('pensado' con
 * derivar=true), no solo a la que ya insistió después. `ultimaDerivacion()` y
 * `handoffEsPermanente()` no cambian — ya sabían resolver bien un sender derivado, sea cual
 * sea el motivo por el que entró a esta lista.
 *
 * OJO: la derivación por FALLA del bot (catch-all del webhook, `derivarAlEquipo` directo)
 * sigue sin pasar por `wdiag('pensado', ..., {derivar:true})` — solo manda el mensaje. Esos
 * casos siguen sin quedar marcados para `ultimaDerivacion()` y este cron sigue sin verlos.
 * Es una zona ciega distinta, ya documentada, y no la que este cambio corrige.
 */
/** Un caso que ya avisó antes y esta corrida decide agrupar en el digest en vez de repetir. */
type CasoReincidente = { sender: string; nombre: string | null; horas: number; nroAviso: number; permanente: boolean }

async function revisarZonaCiega(pool: NonNullable<ReturnType<typeof getPool>>) {
  // Candidatos: clientes con una derivación reciente, sea porque insistieron después
  // ('handoff_activo') o porque el bot los derivó y quedaron esperando en silencio
  // ('pensado' con derivar=true) — dentro de la ventana en la que el webhook los sigue
  // considerando derivados.
  const { rows } = await pool.query<{ sender: string }>(
    `SELECT DISTINCT sender FROM ig_diag
      WHERE canal = 'wa'
        AND (
          kind = 'handoff_activo'
          OR (kind = 'pensado' AND detail->>'derivar' = 'true')
        )
        AND ts > now() - interval '${HANDOFF_HORAS_MAX} hours'`,
  )

  let avisados = 0
  const reincidentes: CasoReincidente[] = []

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

    // Nº de este aviso DENTRO del caso actual (reinicia si el caso se cerró y reabrió: se
    // cuenta desde `desde`, el inicio de ESTA derivación, no desde siempre).
    const nroAvisoReal = await contarAvisosDelCaso(pool, sender, desde) + 1
    const nroAviso = Math.min(nroAvisoReal, 3) // solo para el título, no cambia el ruteo de abajo
    const nombre = await nombreDe(pool, sender)

    // AUDITORÍA 10/09/2026: en 12 días, 153 alertas individuales y 1 solo cierre manual.
    // El primer aviso de un caso es el que importa recibir solo (es la primera noticia de
    // que algo quedó esperando) — a partir del segundo, repetir el mismo mensaje entero
    // cada 2-6 h no sumó acción, solo volumen. Desde acá, los reincidentes se juntan en
    // UN digest al final de la corrida (`mandarDigestReincidentes`) en vez de una alerta
    // más por caso.
    if (nroAvisoReal >= 2) {
      await diag(KIND_WATCHDOG_AVISADO, sender, { nroAviso, permanente, horas: Math.round(horas), digest: true }, 'wa')
      reincidentes.push({ sender, nombre, horas: Math.round(horas), nroAviso: nroAvisoReal, permanente })
      continue
    }

    const { wamidWa } = await notifyNahuel(
      permanente
        ? `⚠️ [Alerta ${nroAviso}/3] Caso SENSIBLE sin atender — ${Math.round(horas)} h`
        : `[Alerta ${nroAviso}/3] Cliente esperando a Mateo — ${Math.round(horas)} h`,
      permanente
        ? formatearAlerta({
            titulo: '⚠️ CASO SENSIBLE — plata / cancelación / legal',
            cliente: nombre, sender,
            resumen:
              `Cancelación/reintegro/conflicto sin resolver, derivado hace ${Math.round(horas)} h. ` +
              `El bot NO va a retomar este chat a propósito (el 19/08/2026 inventó un número de ` +
              `reclamo en un caso así). Si no entra una persona, no recibe respuesta de nadie.`,
            nroAviso,
          })
        : formatearAlerta({
            titulo: 'Cliente esperando a Mateo',
            cliente: nombre, sender,
            resumen:
              `Derivado hace ${Math.round(horas)} h, sin confirmación de que alguien contestó — las ` +
              `respuestas de Mateo no quedan logueadas en ningún sistema.\n` +
              `No es necesariamente un problema: puede que ya esté resuelto por WhatsApp normal.`,
            nroAviso,
          }),
    )
    await diag(KIND_WATCHDOG_AVISADO, sender, { nroAviso, permanente, horas: Math.round(horas) }, 'wa')

    // Correlación para el cierre informal (ver `respuestaCierraAlerta` en lib/diag.ts): si
    // esta alerta salió por WhatsApp, se guarda su wamid → sender para poder reconocer un
    // "listo"/"ok" que la responda por swipe-to-reply, sin exigir el teléfono a mano.
    if (wamidWa) {
      await diag('watchdog_alerta_wamid', sender, { wamid: wamidWa, sender }, 'wa')
    }
  }

  return { revisados: rows.length, avisados, reincidentes }
}

/**
 * Un solo mensaje con todos los casos que ya habían avisado antes (nroAviso >= 2) y
 * siguieron sin cerrarse en esta corrida. Reemplaza N alertas repetidas por 1 resumen —
 * sigue habiendo UNA notificación por hora si hay reincidentes (el cron sigue corriendo
 * cada hora), pero deja de repetir el cuerpo completo por cada caso individual.
 *
 * No lleva wamid de correlación: el digest lista varios teléfonos, así que "listo" sobre
 * él sería ambiguo — para cerrar desde acá sigue siendo `cerrar <tel>` explícito (cada
 * línea trae el suyo, para copiar).
 */
async function mandarDigestReincidentes(casos: CasoReincidente[]): Promise<void> {
  if (casos.length === 0) return
  const lineas = casos
    .sort((a, b) => b.horas - a.horas)
    .map((c) => {
      const marca = c.permanente ? '⚠️' : '•'
      const quien = c.nombre ? `${c.nombre} · ${c.sender}` : c.sender
      return `${marca} ${quien} — ${c.horas} h esperando (aviso ${Math.min(c.nroAviso, 99)}) → cerrar ${c.sender}`
    })
    .join('\n')
  await notifyNahuel(
    `📋 Digest — ${casos.length} caso${casos.length === 1 ? '' : 's'} sin cerrar (repetidos)`,
    `Estos casos ya habían avisado antes y siguen abiertos. No se repite la alerta ` +
      `completa de cada uno — se resumen acá:\n\n${lineas}\n\n` +
      `Para cerrar uno, respondé con "cerrar <teléfono>" (la línea de arriba ya lo trae).\n` +
      `🔗 Ver hilos: https://mw-micelium.vercel.app/conversaciones`,
  )
}

/** Cuántos avisos de este cron ya salieron para este caso, desde que arrancó (`desde`). */
async function contarAvisosDelCaso(
  pool: NonNullable<ReturnType<typeof getPool>>, sender: string, desde: Date,
): Promise<number> {
  try {
    const { rows } = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM ig_diag
        WHERE sender = $1 AND kind = $2 AND canal = 'wa' AND ts >= $3`,
      [sender, KIND_WATCHDOG_AVISADO, desde],
    )
    return Number(rows[0]?.n ?? 0)
  } catch {
    return 0 // ante error, mejor mostrar "1/3" de más que romper el aviso
  }
}

/** Nombre del cliente si quedó logueado en algún 'recibido' previo. Best-effort. */
async function nombreDe(pool: NonNullable<ReturnType<typeof getPool>>, sender: string): Promise<string | null> {
  try {
    const { rows } = await pool.query<{ nombre: string | null }>(
      `SELECT detail->>'nombre' AS nombre FROM ig_diag
        WHERE sender = $1 AND kind = 'recibido' AND canal = 'wa' AND detail->>'nombre' IS NOT NULL
        ORDER BY id DESC LIMIT 1`,
      [sender],
    )
    // El nombre es el perfil de WhatsApp del cliente, texto libre sin sanitizar en origen:
    // se recorta y se limpia de saltos de línea para que no rompa el formato de la alerta.
    const nombre = rows[0]?.nombre
    return nombre ? nombre.replace(/\s+/g, ' ').trim().slice(0, 60) || null : null
  } catch {
    return null
  }
}

/**
 * Arma el cuerpo de la alerta con secciones separadas visualmente (nada de un párrafo
 * pegado): CASO / CLIENTE / cómo cerrarlo / resumen. Por email y Telegram esto sale con
 * saltos de línea reales, bien legible.
 *
 * Por WhatsApp (plantilla de Meta) los \n se colapsan a " · " y el body se corta a 600
 * caracteres (ver `paramSeguro` en lib/notify.ts) — por eso el comando "cerrar <tel>" va
 * ANTES del resumen largo, no al final: si ese canal corta el mensaje, lo primero que se
 * pierde es el resumen, nunca la forma de frenar las alertas. El comando se manda tal cual,
 * respondiendo al mismo chat de WhatsApp desde el que llega esta alerta — el webhook ya lo
 * procesa (ver `esCierreDeHandoff`).
 */
function formatearAlerta(p: {
  titulo: string; cliente: string | null; sender: string; resumen: string; nroAviso: number
}): string {
  const lineaCliente = p.cliente ? `${p.cliente} · ${p.sender}` : p.sender
  return (
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${p.titulo}\n` +
    `Alerta ${p.nroAviso}/3 de este caso\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `👤 CLIENTE: ${lineaCliente}\n\n` +
    `✅ PARA CERRAR (frena las alertas de este caso):\n` +
    `Respondé a este mismo chat con:\ncerrar ${p.sender}\n\n` +
    `📋 RESUMEN:\n${p.resumen}\n\n` +
    `🔗 Ver hilo: https://mw-micelium.vercel.app/conversaciones`
  )
}
