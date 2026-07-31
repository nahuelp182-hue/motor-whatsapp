// Latido de automatizaciones — la mitad barata del arreglo al agujero de "algo dejó de
// correr y nada lo nota". La otra mitad, el aviso, sale del cron resumen-bot.
//
// HISTORIA CORTA, PORQUE EXPLICA EL DISEÑO
//
// La primera versión guardaba una fila por job (upsert sobre `CronHeartbeat`) y respondía
// una sola pregunta: ¿corrió? El 31/07/2026 se descubrió que la tabla estaba vacía desde
// que se creó: el código que la escribía nunca se había desplegado, y el único proceso que
// podía avisarlo —resumen-bot— era uno de los crons que no corría. Un vigilante que
// depende de lo que vigila no vigila nada.
//
// De ahí las dos decisiones de esta versión:
//
//  1. `JobRun` es APPEND-ONLY. Con una fila por job no se puede saber si algo falla siempre
//     o falló una vez, desde cuándo, ni si está tardando más que antes. El upsert pisa la
//     evidencia justo cuando hace falta.
//  2. El estado se DERIVA de la cadencia declarada en CATALOGO, no de un campo guardado. Un
//     job que dejó de dispararse no escribe nada — y algo que no escribe nunca se puede
//     marcar a sí mismo como caído. La ausencia tiene que ser la señal.
import { prisma } from '@/lib/prisma'

export type Origen = 'vercel' | 'vps' | 'github' | 'windows'
export type Estado = 'ok' | 'atrasado' | 'falla' | 'nunca'

export type EntradaCatalogo = {
  origen: Origen
  /** Antigüedad máxima tolerada antes de considerarlo caído. */
  maxHoras: number
  /** Reseña de qué hace, en pocas palabras. Es lo que se lee en el panel. */
  que: string
}

/**
 * Catálogo de automatizaciones vigiladas.
 *
 * `maxHoras` no es la cadencia: es la cadencia MÁS un margen. Un job cada 30 min con
 * tolerancia de 30 min daría falsa alarma ante cualquier demora; con 2 h avisa recién
 * cuando perdió cuatro corridas seguidas, que ya no es ruido.
 *
 * Los jobs a demanda (andreani, instalar-widgets-tn) quedan afuera a propósito: no tienen
 * cadencia, así que su ausencia no significa nada.
 */
export const CATALOGO: Record<string, EntradaCatalogo> = {
  'carrito-abandonado': {
    origen: 'vps', maxHoras: 2,
    que: 'Detecta carritos abandonados con teléfono y encola el mensaje',
  },
  'resena-post-entrega': {
    origen: 'vps', maxHoras: 2,
    que: 'Pide la reseña cuando el pedido figura entregado',
  },
  'send-pending': {
    origen: 'vps', maxHoras: 2,
    que: 'Drena la cola de mensajes salientes del recupero de carrito',
  },
  radar: {
    origen: 'vps', maxHoras: 26,
    que: 'Mina sugerencias de tendencias; avisa solo si hay algo emergente',
  },
  'sync-calendario': {
    origen: 'vps', maxHoras: 26,
    que: 'Espeja las fechas comerciales al calendario Google "Ecommerce"',
  },
  'ciclo-cultivo': {
    origen: 'vps', maxHoras: 26,
    que: 'Acompaña por mail el ciclo de cultivo del cliente, día por día',
  },
  'resumen-bot': {
    origen: 'github', maxHoras: 26,
    que: 'Resumen del bot + chequeo de crons caídos + alerta de gasto de IA',
  },
  'despacho-watchdog': {
    origen: 'github', maxHoras: 3,
    que: "Dead-man's switch del despacho apícola del VPS",
  },
}

/**
 * Registra que `slug` corrió. Best-effort: nunca lanza — un fallo al medir no puede
 * tumbar el trabajo que se estaba midiendo.
 */
export async function marcarHeartbeat(
  slug: string,
  ok = true,
  detalle?: string,
  extra?: { duracionMs?: number; exitCode?: number; origen?: Origen },
): Promise<void> {
  try {
    const fin = new Date()
    const duracion = extra?.duracionMs
    await prisma.jobRun.create({
      data: {
        slug,
        origen: extra?.origen ?? CATALOGO[slug]?.origen ?? 'vercel',
        inicio: duracion ? new Date(fin.getTime() - duracion) : fin,
        fin,
        duracion_ms: duracion ?? null,
        exit_code: extra?.exitCode ?? null,
        ok,
        detalle: detalle?.slice(0, 2000) ?? null,
      },
    })
  } catch (e) {
    console.error('[cron-heartbeat] no se pudo marcar:', slug, e)
  }
}

export type CronVencido = { nombre: string; horasSinCorrer: number | null; last_ok: boolean }

/** Corrida más reciente de un job, en la forma mínima que necesita `derivarEstado`. */
export type UltimaCorrida = { inicio: Date; ok: boolean } | undefined

/**
 * Estado de un job a partir de su última corrida. Función pura: toda la lógica de decisión
 * vive acá para poder probarla sin base ni reloj real.
 *
 * El orden importa. Un job que falló hace 5 minutos es 'falla', no 'ok': el hecho de que
 * corriera recién no lo vuelve sano.
 */
export function derivarEstado(
  slug: string,
  ultima: UltimaCorrida,
  ahora: Date = new Date(),
): Estado {
  const cfg = CATALOGO[slug]
  if (!cfg) return 'ok' // fuera del catálogo = a demanda, no se vigila
  if (!ultima) return 'nunca'
  if (!ultima.ok) return 'falla'
  const horas = (ahora.getTime() - ultima.inicio.getTime()) / 3_600_000
  return horas > cfg.maxHoras ? 'atrasado' : 'ok'
}

/** Horas desde la última corrida, o null si nunca corrió. */
export function horasDesde(ultima: UltimaCorrida, ahora: Date = new Date()): number | null {
  if (!ultima) return null
  return (ahora.getTime() - ultima.inicio.getTime()) / 3_600_000
}

export type CorridaResumen = { inicio: Date; ok: boolean; detalle: string | null }

/** Última corrida de cada job del catálogo. Una sola consulta, no una por job. */
export async function ultimasCorridas(): Promise<Map<string, CorridaResumen>> {
  const slugs = Object.keys(CATALOGO)
  const filas = await prisma.jobRun.findMany({
    where: { slug: { in: slugs } },
    orderBy: { inicio: 'desc' },
    select: { slug: true, inicio: true, ok: true, detalle: true },
  })
  const porSlug = new Map<string, CorridaResumen>()
  for (const f of filas) if (!porSlug.has(f.slug)) porSlug.set(f.slug, f)
  return porSlug
}

/** Los jobs del catálogo que no reportaron a tiempo, fallaron, o nunca reportaron. */
export async function chequearHeartbeats(): Promise<CronVencido[]> {
  const ultimas = await ultimasCorridas()
  const ahora = new Date()
  const vencidos: CronVencido[] = []

  for (const slug of Object.keys(CATALOGO)) {
    const u = ultimas.get(slug)
    if (derivarEstado(slug, u, ahora) === 'ok') continue
    const h = horasDesde(u, ahora)
    vencidos.push({
      nombre: slug,
      horasSinCorrer: h === null ? null : Math.round(h),
      last_ok: u?.ok ?? false,
    })
  }
  return vencidos
}

/**
 * Poda las corridas viejas. Append-only sin poda es una tabla que crece para siempre; 90
 * días alcanzan para ver una tendencia y son baratos de guardar. Se llama desde la
 * auditoría diaria, no desde un cron propio: un cron nuevo es una cosa más que puede
 * dejar de correr en silencio.
 */
export async function purgarJobRuns(dias = 90): Promise<number> {
  const corte = new Date(Date.now() - dias * 86_400_000)
  const r = await prisma.jobRun.deleteMany({ where: { inicio: { lt: corte } } })
  return r.count
}
