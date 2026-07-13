import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Reporte de cohortes por canal de first-touch. Protegido por el auth del
// dashboard (no está en el allowlist del middleware → exige cookie dash-auth).
const TN_STORE_ID = process.env.TN_STORE_ID ?? '1957278'

type Row = {
  ft_channel: string
  visitors: number
  avg_first_dwell_s: number | null
  avg_first_scroll: number | null
  pct_engaged_first: number | null // % que NO rebotó en la 1ra visita
  return_rate: number | null // % que volvió con sesión engaged otro día
  purchase_rate: number | null
  purchase_30d: number | null
  purchase_60d: number | null
  purchase_90d: number | null
  median_days_to_purchase: number | null
}

export async function GET() {
  const store = await prisma.store.findFirst({
    where: { tiendanube_store_id: TN_STORE_ID, is_active: true },
  })
  if (!store) return NextResponse.json({ error: 'no store' }, { status: 404 })

  // TZ AR para comparar "día distinto" (retorno). Sin esto, sesiones nocturnas
  // cruzan la medianoche UTC y falsean la tasa de retorno.
  // Casteos ::int/::float8 → node-pg devuelve bigint/numeric como BigInt/string;
  // forzamos number para que el JSON salga limpio.
  const rows = await prisma.$queryRaw<Row[]>`
    WITH v AS (
      SELECT vis.id, vis.ft_channel, vis.ft_at, vis.purchased_at,
        (SELECT count(*) FROM "Visit" t
           WHERE t.visitor_id = vis.id AND t.engaged
             AND (t.started_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
               <> (vis.ft_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date) AS ret_engaged,
        (SELECT t.duration_ms FROM "Visit" t
           WHERE t.visitor_id = vis.id ORDER BY t.started_at ASC LIMIT 1) AS first_dur,
        (SELECT t.max_scroll FROM "Visit" t
           WHERE t.visitor_id = vis.id ORDER BY t.started_at ASC LIMIT 1) AS first_scroll,
        (SELECT t.engaged FROM "Visit" t
           WHERE t.visitor_id = vis.id ORDER BY t.started_at ASC LIMIT 1) AS first_engaged
      FROM "Visitor" vis
      WHERE vis.store_id = ${store.id}
    )
    SELECT ft_channel,
      count(*)::int AS visitors,
      round(avg(first_dur) / 1000.0, 1)::float8 AS avg_first_dwell_s,
      round(avg(first_scroll), 1)::float8 AS avg_first_scroll,
      round(100.0 * avg((first_engaged)::int), 1)::float8 AS pct_engaged_first,
      round(100.0 * avg((ret_engaged > 0)::int), 1)::float8 AS return_rate,
      round(100.0 * avg((purchased_at IS NOT NULL)::int), 1)::float8 AS purchase_rate,
      round(100.0 * avg((purchased_at IS NOT NULL AND purchased_at <= ft_at + interval '30 days')::int), 1)::float8 AS purchase_30d,
      round(100.0 * avg((purchased_at IS NOT NULL AND purchased_at <= ft_at + interval '60 days')::int), 1)::float8 AS purchase_60d,
      round(100.0 * avg((purchased_at IS NOT NULL AND purchased_at <= ft_at + interval '90 days')::int), 1)::float8 AS purchase_90d,
      round(percentile_cont(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (purchased_at - ft_at)) / 86400.0)
        FILTER (WHERE purchased_at IS NOT NULL)::numeric, 1)::float8 AS median_days_to_purchase
    FROM v
    GROUP BY ft_channel
    ORDER BY visitors DESC
  `

  const cohortes = rows.map((r) => ({
    canal: r.ft_channel,
    visitantes: Number(r.visitors),
    curiosidad: {
      dwell_1ra_visita_s: r.avg_first_dwell_s,
      scroll_1ra_visita_pct: r.avg_first_scroll,
      engaged_1ra_visita_pct: r.pct_engaged_first, // 100 - esto = % que rebotó
    },
    retorno_pct: r.return_rate,
    recompra: {
      total_pct: r.purchase_rate,
      d30_pct: r.purchase_30d,
      d60_pct: r.purchase_60d,
      d90_pct: r.purchase_90d,
      mediana_dias: r.median_days_to_purchase,
    },
  }))

  return NextResponse.json({ store: store.nombre, generado: new Date().toISOString(), cohortes })
}
