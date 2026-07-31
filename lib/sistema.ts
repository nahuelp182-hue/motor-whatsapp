// Lo que el panel necesita saber del sistema: en qué estado está cada automatización y
// dónde se va la plata de IA.
//
// Las dos preguntas viven en el mismo archivo porque salen del mismo lugar y se consultan
// desde la misma pantalla, pero se calculan por separado: el estado se mira todos los días
// en cinco segundos, el gasto una vez por mes con calma.
import { getPool } from '@/lib/db'
import { CATALOGO, derivarEstado, horasDesde, ultimasCorridas, type Estado, type Origen } from '@/lib/cron-heartbeat'

export type JobEstado = {
  slug: string
  que: string
  origen: Origen
  estado: Estado
  horas: number | null
  detalle: string | null
  maxHoras: number
}

/** Estado de las 46 automatizaciones, ordenadas por urgencia. */
export async function estadoDeJobs(): Promise<JobEstado[]> {
  const ultimas = await ultimasCorridas()
  const ahora = new Date()

  const orden: Record<Estado, number> = { falla: 0, atrasado: 1, nunca: 2, ok: 3 }

  return Object.entries(CATALOGO)
    .map(([slug, cfg]) => {
      const u = ultimas.get(slug)
      return {
        slug,
        que: cfg.que,
        origen: cfg.origen,
        maxHoras: cfg.maxHoras,
        estado: derivarEstado(slug, u, ahora),
        horas: horasDesde(u, ahora),
        detalle: u?.detalle ?? null,
      }
    })
    .sort((a, b) => orden[a.estado] - orden[b.estado] || a.slug.localeCompare(b.slug))
}

export type GastoConsumidor = {
  canal: string
  proveedor: string
  llamadas: number
  usd: number
  usdPorLlamada: number
  tokensEntrada: number
  tokensSalida: number
  busquedas: number
  /** Porcentaje de la entrada servido desde caché. La palanca más barata que existe. */
  cachePct: number
}

/**
 * Ranking de gasto por consumidor.
 *
 * Se muestra USD por llamada además del total, porque son dos problemas distintos y se
 * arreglan distinto: un consumidor caro por llamada se optimiza tocando el prompt o las
 * herramientas; uno caro por volumen, bajando la frecuencia. Con solo el total, los dos se
 * ven igual.
 */
export async function gastoIA(dias = 30): Promise<{ consumidores: GastoConsumidor[]; total: number; desdeDias: number }> {
  const p = getPool()
  if (!p) return { consumidores: [], total: 0, desdeDias: dias }

  const { rows } = await p.query(
    `SELECT channel,
            max(coalesce(provider, 'anthropic'))         AS proveedor,
            count(*)::int                                AS llamadas,
            sum(cost_usd)::float                         AS usd,
            sum(input_tokens)::bigint                    AS entrada,
            sum(output_tokens)::bigint                   AS salida,
            sum(coalesce(web_search_requests, 0))::int   AS busquedas,
            sum(coalesce(cache_read_tokens, 0))::bigint  AS cache
       FROM claude_usage
      WHERE ts > now() - ($1 || ' days')::interval
      GROUP BY channel
      ORDER BY 4 DESC`,
    [String(dias)],
  )

  const consumidores: GastoConsumidor[] = rows.map((r: Record<string, unknown>) => {
    const entrada = Number(r.entrada ?? 0)
    const cache = Number(r.cache ?? 0)
    const llamadas = Number(r.llamadas ?? 0)
    const usd = Number(r.usd ?? 0)
    return {
      canal: String(r.channel),
      proveedor: String(r.proveedor),
      llamadas,
      usd,
      usdPorLlamada: llamadas ? usd / llamadas : 0,
      tokensEntrada: entrada,
      tokensSalida: Number(r.salida ?? 0),
      busquedas: Number(r.busquedas ?? 0),
      // El denominador incluye la caché: es "de todo lo que entró, cuánto salió barato".
      cachePct: entrada + cache ? (cache / (entrada + cache)) * 100 : 0,
    }
  })

  return {
    consumidores,
    total: consumidores.reduce((s, c) => s + c.usd, 0),
    desdeDias: dias,
  }
}
