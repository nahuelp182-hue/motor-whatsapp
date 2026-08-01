// Vigilante de canales mudos.
//
// POR QUÉ EXISTE
// El webhook de Instagram dejó de recibir mensajes el 11/07/2026 y nadie se enteró hasta el
// 01/08 — tres semanas. No falló nada ruidoso: los comentarios seguían entrando por el mismo
// endpoint, la firma validaba, el token era válido y las suscripciones estaban bien. Lo único
// que pasó fue que dejaron de llegar DMs, y **un canal mudo se ve exactamente igual que un
// canal sin demanda**. Se descubrió de casualidad, mirando una tabla a mano.
//
// Este cron convierte ese silencio en una alerta. La regla no es "hace X días que no entra
// nada" a secas: es "este canal venía recibiendo con cierto ritmo y se cortó". Un canal que
// nunca tuvo tráfico no alerta (sería ruido); uno que traía mensajes todos los días y lleva
// una semana en cero, sí.
//
// Igual que el resto de la vigilancia, corre en Vercel y no en el VPS, y el disparo lo hace
// el cron del VPS por curl (Vercel Hobby topea en 2 crons diarios).
import { NextResponse } from 'next/server'
import { chequearCron } from '@/lib/cron-auth'
import { getPool } from '@/lib/db'
import { notifyNahuel } from '@/lib/notify'
import { consumirLimite } from '@/lib/ratelimit'
import { marcarHeartbeat } from '@/lib/cron-heartbeat'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Días sin un solo mensaje entrante para considerar que el canal se cortó. */
const DIAS_SILENCIO = 4
/**
 * Cuántos días hacia atrás se mira para saber si el canal "venía activo". Tiene que ser
 * bastante más largo que DIAS_SILENCIO: si no, un canal que lleva un mes mudo deja de contar
 * como activo y el vigilante se olvida del problema justo cuando ya es grave.
 */
const VENTANA_ACTIVIDAD_D = 60
/** Mínimo de mensajes en esa ventana para que el canal cuente como "vivo". */
const MIN_MENSAJES = 5
/** No repetir la alerta del mismo canal más de una vez por semana. */
const REALERTA_H = 168

const NOMBRES: Record<string, string> = {
  wa: 'WhatsApp',
  ig: 'Instagram (DMs)',
  messenger: 'Messenger de Facebook',
  web: 'Asistente web',
}

/**
 * Solo MENSAJES entrantes. Los comentarios quedan afuera a propósito: en julio siguieron
 * llegando por el mismo webhook mientras los DMs estaban cortados, así que contarlos como
 * actividad del canal es exactamente lo que tapó el problema.
 */
const ENTRANTES = ['recibido', 'recibido_archivo']

type Fila = { canal: string; total: string; ult: Date }

export async function GET(req: Request) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth

  const pool = getPool()
  if (!pool) return NextResponse.json({ error: 'sin base' }, { status: 503 })

  const { rows } = await pool.query<Fila>(
    `SELECT canal, COUNT(*) AS total, MAX(ts) AS ult
       FROM ig_diag
      WHERE canal IS NOT NULL
        AND kind = ANY($1)
        AND ts > now() - ($2 || ' days')::interval
      GROUP BY canal`,
    [ENTRANTES, String(VENTANA_ACTIVIDAD_D)],
  )

  const ahora = Date.now()
  const informe: Array<Record<string, unknown>> = []

  for (const fila of rows) {
    const total = Number(fila.total)
    const dias = (ahora - new Date(fila.ult).getTime()) / 86_400_000
    const mudo = total >= MIN_MENSAJES && dias >= DIAS_SILENCIO
    informe.push({ canal: fila.canal, mensajes: total, diasSinRecibir: Math.round(dias), mudo })
    if (!mudo) continue

    // El anti-spam va por rate limit y no por una columna nueva: la tabla RateLimit ya hace
    // exactamente esto y se limpia sola.
    const { permitido } = await consumirLimite(`watchdog:canal:${fila.canal}`, 1, REALERTA_H * 3600)
    if (!permitido) continue

    const nombre = NOMBRES[fila.canal] ?? fila.canal
    await notifyNahuel(
      `Canal mudo: ${nombre} lleva ${Math.round(dias)} días sin recibir un mensaje`,
      `El canal ${nombre} venía recibiendo (${total} mensajes en los últimos ${VENTANA_ACTIVIDAD_D} días) ` +
        `y no entra uno desde hace ${Math.round(dias)} días.\n\n` +
        `Esto NO prueba que esté roto: puede ser que no haya demanda. Pero es la señal que ` +
        `faltó en julio, cuando Instagram estuvo tres semanas sin recibir DMs sin que saltara nada.\n\n` +
        `Qué revisar, en orden:\n` +
        `1. Mandale un mensaje a la cuenta desde otro perfil y mirá si aparece en /conversaciones.\n` +
        `2. Si no aparece: en Instagram, Configuración → Privacidad → Mensajes → Herramientas ` +
        `conectadas → "Permitir acceso a los mensajes". Si eso está apagado, los DMs dejan de ` +
        `llegar al webhook y los comentarios siguen entrando — que es justo el síntoma que tuvimos.\n` +
        `3. Recién después mirar permisos y suscripciones de la app.`,
    )
  }

  const entregas = await revisarEntregas(pool)
  // Sin esto el vigilante puede morirse en silencio, que es exactamente el problema que
  // vino a resolver. Ver CLAUDE.md: todo cron nuevo late.
  await marcarHeartbeat('canales-watchdog', true, `canales=${informe.length} entregas=${entregas.total}`)
  return NextResponse.json({ ok: true, canales: informe, entregas })
}

/**
 * Segunda mitad: ¿los mensajes que mandamos a CLIENTES están llegando?
 *
 * registrarStatuses() (webhook de WhatsApp) ya avisa al instante cuando falla un mensaje a un
 * número interno — el tío o Nahuel —, porque ahí hay una venta sin despachar en juego. Los
 * fallos a clientes no alertan a propósito: uno suelto es ruido (número mal cargado, alguien
 * que bloqueó). Pero un porcentaje alto sostenido no es ruido: es una plantilla caída o un
 * problema de ventana de 24 h, y así se pierden 31 pedidos de reseña sin que nadie lo note.
 *
 * El cruce se hace por la columna `wamid` de MessageLog, que existe desde el 01/08/2026. Los
 * envíos anteriores no lo tienen y quedan fuera de la cuenta, no se adivinan.
 */
async function revisarEntregas(pool: NonNullable<ReturnType<typeof getPool>>) {
  const { rows } = await pool.query<{ total: string; fallidos: string; entregados: string }>(
    `SELECT COUNT(*)                                             AS total,
            COUNT(*) FILTER (WHERE s.estado = 'failed')          AS fallidos,
            COUNT(*) FILTER (WHERE s.estado IN ('delivered','read')) AS entregados
       FROM "MessageLog" m
       JOIN "WaStatus"  s ON s.wamid = m.wamid
      WHERE m."createdAt" > now() - interval '7 days'`,
  )
  const total = Number(rows[0]?.total ?? 0)
  const fallidos = Number(rows[0]?.fallidos ?? 0)
  const entregados = Number(rows[0]?.entregados ?? 0)
  const resumen = { total, fallidos, entregados }

  // Con menos de 10 acuses cualquier porcentaje es anecdótico.
  if (total < 10 || fallidos / total < 0.2) return resumen

  const { permitido } = await consumirLimite('watchdog:entregas', 1, 24 * 3600)
  if (!permitido) return resumen

  const pct = Math.round((fallidos / total) * 100)
  await notifyNahuel(
    `${pct}% de los WhatsApp a clientes no se están entregando`,
    `De los últimos ${total} mensajes de campaña con acuse, ${fallidos} figuran como NO entregados ` +
      `y ${entregados} sí llegaron.\n\n` +
      `Un fallo suelto es normal (número mal cargado, alguien que bloqueó). ${pct}% no: mirá si ` +
      `alguna plantilla quedó sin aprobar, o si se están mandando fuera de la ventana de 24 h ` +
      `(código 131047 — ahí solo entregan las plantillas).\n\n` +
      `Detalle por mensaje en la tabla WaStatus, cruzada por wamid contra MessageLog.`,
  )
  return resumen
}
