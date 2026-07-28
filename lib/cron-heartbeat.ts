// Heartbeat de crons — la mitad barata del arreglo al agujero de "el VPS se cae y nada lo
// nota". Cada cron (VPS o Vercel) marca su corrida acá; resumen-bot revisa a diario si
// alguno dejó de llegar y avisa por notifyNahuel. Ver Bloque A del plan de arquitectura.
//
// No hay un cron dedicado a chequear: mientras no esté confirmado el plan de Vercel, un
// cron nuevo podría no llegar a correr nunca. Se engancha al primero de los 5 ya
// declarados en vercel.json, que además ya manda mail a diario.
import { prisma } from '@/lib/prisma'

/** Registra que `nombre` corrió ahora. Best-effort: nunca lanza. */
export async function marcarHeartbeat(nombre: string, ok = true, detalle?: string): Promise<void> {
  try {
    await prisma.cronHeartbeat.upsert({
      where: { nombre },
      create: { nombre, last_ok: ok, detalle },
      update: { last_run: new Date(), last_ok: ok, detalle },
    })
  } catch (e) {
    console.error('[cron-heartbeat] no se pudo marcar:', nombre, e)
  }
}

/**
 * Máxima antigüedad esperada por cron antes de considerarlo "no llegó". Los disparados por
 * el VPS corren cada ~30 min (ver los comentarios en sus propias rutas); los de Vercel,
 * una vez al día. `andreani` e `instalar-widgets-tn` son a demanda / sin cadencia fija y
 * quedan afuera del chequeo por ahora.
 */
const MAX_ANTIGUEDAD_HORAS: Record<string, number> = {
  'carrito-abandonado': 2,
  'resena-post-entrega': 2,
  'send-pending': 26,
  radar: 26,
  'sync-calendario': 26,
  'ciclo-cultivo': 26,
}

export type CronVencido = { nombre: string; horasSinCorrer: number | null; last_ok: boolean }

/** Devuelve los crons de MAX_ANTIGUEDAD_HORAS que no reportaron a tiempo, o nunca lo hicieron. */
export async function chequearHeartbeats(): Promise<CronVencido[]> {
  const filas = await prisma.cronHeartbeat.findMany({
    where: { nombre: { in: Object.keys(MAX_ANTIGUEDAD_HORAS) } },
  })
  const porNombre = new Map(filas.map((f) => [f.nombre, f]))
  const ahora = Date.now()

  const vencidos: CronVencido[] = []
  for (const [nombre, maxH] of Object.entries(MAX_ANTIGUEDAD_HORAS)) {
    const fila = porNombre.get(nombre)
    if (!fila) {
      vencidos.push({ nombre, horasSinCorrer: null, last_ok: false }) // nunca reportó
      continue
    }
    const horas = (ahora - fila.last_run.getTime()) / 3_600_000
    if (horas > maxH || !fila.last_ok) {
      vencidos.push({ nombre, horasSinCorrer: Math.round(horas), last_ok: fila.last_ok })
    }
  }
  return vencidos
}
