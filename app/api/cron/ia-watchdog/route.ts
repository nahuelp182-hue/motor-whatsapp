// Vigilante de fallas del cerebro (Claude) al responder mensajes.
//
// POR QUÉ EXISTE
// El 12-18/08/2026 el saldo de Anthropic se agotó y el bot falló 51 veces con
// "Your credit balance is too low". `canales-watchdog` no lo detectó porque mide otra cosa:
// silencio del CANAL (¿dejaron de llegar mensajes?). Acá el canal siguió recibiendo normal —
// lo que faltaba era la respuesta saliente, y eso hoy no lo mira ningún vigilante. 17
// conversaciones quedaron sin ninguna respuesta real durante esa semana, incluida una
// denuncia pública de estafa, antes de que alguien lo notara.
//
// Corre cada 15 min desde GitHub Actions (no VPS, no Vercel cron): tercera infraestructura,
// independiente de las dos que vigila. Vercel Hobby además topea en 2 crons diarios — muy
// lento para esto.
import { NextResponse } from 'next/server'
import { chequearCron } from '@/lib/cron-auth'
import { getPool } from '@/lib/db'
import { notifyNahuel } from '@/lib/notify'
import { consumirLimite } from '@/lib/ratelimit'
import { marcarHeartbeat } from '@/lib/cron-heartbeat'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Ventana hacia atrás que se revisa. Mayor al intervalo del cron (15 min) para no perder
 *  eventos si una corrida se demora o se salta un tick. */
const VENTANA_MIN = 20
/** Errores en la ventana a partir de los cuales se considera un problema real y no ruido
 *  suelto (un timeout de Meta, un cliente que mandó un tipo de mensaje no soportado). */
const UMBRAL_ERRORES = 3
/** No repetir la alerta más de una vez por hora mientras la falla siga. */
const REALERTA_H = 1

const KINDS_ERROR = ['wa_error', 'error', 'send_fail']

type Fila = { canal: string | null; detail: unknown; ts: string }

export async function GET(req: Request) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth

  const pool = getPool()
  if (!pool) return NextResponse.json({ error: 'sin base' }, { status: 503 })

  const { rows } = await pool.query<Fila>(
    `SELECT canal, detail, ts FROM ig_diag
      WHERE kind = ANY($1) AND ts > now() - ($2 || ' minutes')::interval
      ORDER BY ts ASC`,
    [KINDS_ERROR, String(VENTANA_MIN)],
  )

  const total = rows.length
  // Distingue el caso ya conocido (saldo de Anthropic agotado) del resto: cambia qué decirle
  // a Nahuel y dónde mirar. El resto de los errores puede ser un timeout de Meta, un token
  // vencido, o la base caída — no hay forma de saberlo sin leer el detalle.
  const porSaldo = rows.filter((r) => {
    const d = typeof r.detail === 'string' ? r.detail : JSON.stringify(r.detail ?? {})
    return /credit balance/i.test(d)
  }).length

  const informe = { total, porSaldo, ventanaMin: VENTANA_MIN, umbral: UMBRAL_ERRORES }

  if (total >= UMBRAL_ERRORES) {
    const { permitido } = await consumirLimite('watchdog:ia-errores', 1, REALERTA_H * 3600)
    if (permitido) {
      const porCanal = new Map<string, number>()
      for (const r of rows) porCanal.set(r.canal ?? '?', (porCanal.get(r.canal ?? '?') ?? 0) + 1)
      const detalleCanal = [...porCanal.entries()].map(([c, n]) => `${c}: ${n}`).join(', ')

      if (porSaldo > 0) {
        await notifyNahuel(
          `🔴 Saldo de Anthropic agotado — el bot no está respondiendo (${total} fallos en ${VENTANA_MIN} min)`,
          `${porSaldo} de ${total} errores son "credit balance too low". Mientras dure, el bot ` +
            `deriva al equipo en vez de responder (fix del 18/08) pero nadie está viendo esos ` +
            `mensajes en tiempo real.\n\n` +
            `Por canal: ${detalleCanal}\n\n` +
            `Arreglo: console.anthropic.com/settings/billing → cargar crédito (o prender ` +
            `auto-reload para que esto no vuelva a pasar).`,
        )
      } else {
        await notifyNahuel(
          `🟠 El bot está fallando al responder (${total} errores en ${VENTANA_MIN} min)`,
          `Por canal: ${detalleCanal}\n\n` +
            `No es el error conocido de saldo — revisar /dashboard/conversaciones y los logs ` +
            `de Vercel para ver el detalle real del error.`,
        )
      }
    }
  }

  await marcarHeartbeat('ia-watchdog', true, `errores=${total} porSaldo=${porSaldo}`)
  return NextResponse.json({ ok: true, ...informe })
}
