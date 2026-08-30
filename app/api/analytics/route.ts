import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { log, traceId } from '@/lib/log'
import { fetchTNOrdersClassified, aggregateByChannel, CHANNEL_LABEL, CHANNEL_COLOR, type TNClass } from '@/lib/attribution'

export const dynamic = 'force-dynamic'

const META_ACCOUNT = 'act_1063192135217249'

interface MetaInsightDay {
  date_start: string
  spend: string
  clicks: string
  impressions: string
  reach: string
  actions?: { action_type: string; value: string }[]
}

async function fetchMetaByDay(since: string, until: string) {
  const token = process.env.META_ADS_TOKEN
  if (!token) return []
  try {
    const url = `https://graph.facebook.com/v21.0/${META_ACCOUNT}/insights` +
      `?fields=spend,clicks,impressions,reach,actions` +
      `&time_increment=1` +
      `&time_range={"since":"${since}","until":"${until}"}` +
      `&limit=90` +
      `&access_token=${token}`
    const res  = await fetch(url)
    const data = await res.json() as { data?: MetaInsightDay[] }
    return data.data ?? []
  } catch { return [] }
}

// ── Google Ads: gasto del período desde gads_cache (poblada por ~/.claude/gads.py) ──
async function fetchGoogleSpend(since: string, until: string): Promise<number> {
  try {
    const rows = await prisma.gadsCache.aggregate({
      where: { date: { gte: since, lte: until } },
      _sum: { cost_ars: true },
    })
    return rows._sum.cost_ars ?? 0
  } catch {
    return 0
  }
}

async function fetchMetaTotals(since: string, until: string) {
  const token = process.env.META_ADS_TOKEN
  if (!token) return { spend: 0, clicks: 0, impressions: 0, reach: 0 }
  try {
    const url = `https://graph.facebook.com/v21.0/${META_ACCOUNT}/insights` +
      `?fields=spend,clicks,impressions,reach` +
      `&time_range={"since":"${since}","until":"${until}"}` +
      `&access_token=${token}`
    const res  = await fetch(url)
    const data = await res.json() as { data?: { spend: string; clicks: string; impressions: string; reach: string }[] }
    const d = data.data?.[0]
    if (!d) return { spend: 0, clicks: 0, impressions: 0, reach: 0 }
    return {
      spend:       parseFloat(d.spend       ?? '0'),
      clicks:      parseInt(d.clicks        ?? '0'),
      impressions: parseInt(d.impressions   ?? '0'),
      reach:       parseInt(d.reach         ?? '0'),
    }
  } catch { return { spend: 0, clicks: 0, impressions: 0, reach: 0 } }
}

export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams
    const storeId = p.get('storeId') ?? undefined

    // Rangos de fecha
    const since = p.get('since') ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10)
    const until = p.get('until') ?? new Date().toISOString().slice(0,10)

    const startDate = new Date(since + 'T00:00:00-03:00')
    const endDate   = new Date(until + 'T23:59:59-03:00')

    const whereStore  = storeId ? { store_id: storeId } : {}

    // ── TN: órdenes reales del período (por fecha de orden, no lifetime del cliente) ──
    // Antes esto usaba prisma.customer.total_spent (acumulado histórico, bucketeado en
    // el día de ALTA del cliente) -> inflaba "revenue del período" con ventas de otros
    // meses. Ahora se trae la orden real de TN, clasificada por canal de origen
    // (utm/fbclid capturado por TN al momento del click -> ver lib/attribution.ts).
    const classifiedOrders = await fetchTNOrdersClassified(since, until)
    const byChannel = aggregateByChannel(classifiedOrders)
    const channels = (Object.keys(byChannel) as TNClass[]).map(k => ({
      key: k,
      label: CHANNEL_LABEL[k],
      color: CHANNEL_COLOR[k],
      orders: byChannel[k].orders,
      revenue: byChannel[k].revenue,
    }))

    const revenueByDay = classifiedOrders.reduce<Record<string, number>>((acc, o) => {
      const day = o.createdAt.slice(0, 10)
      acc[day] = (acc[day] ?? 0) + o.total
      return acc
    }, {})

    const revenueByDayChannel = classifiedOrders.reduce<Record<string, Record<string, number>>>((acc, o) => {
      const day = o.createdAt.slice(0, 10)
      if (!acc[day]) acc[day] = {}
      acc[day][o.tnClass] = (acc[day][o.tnClass] ?? 0) + o.total
      return acc
    }, {})

    const totalRevenue = classifiedOrders.reduce((s, o) => s + o.total, 0)
    const newCustomers = classifiedOrders.length

    // ── Meta Ads por día + gasto Google (para el ROAS Global) ─────
    const [metaDays, metaTotals, googleSpend] = await Promise.all([
      fetchMetaByDay(since, until),
      fetchMetaTotals(since, until),
      fetchGoogleSpend(since, until),
    ])

    const metaByDay = metaDays.reduce<Record<string, { spend: number; clicks: number; impressions: number }>>((acc, d) => {
      acc[d.date_start] = {
        spend:       parseFloat(d.spend       ?? '0'),
        clicks:      parseInt(d.clicks        ?? '0'),
        impressions: parseInt(d.impressions   ?? '0'),
      }
      return acc
    }, {})

    // ── Merge: timeline combinado ─────────────────────────────────
    const allDays = new Set([...Object.keys(revenueByDay), ...Object.keys(metaByDay)])
    const timeline = Array.from(allDays).sort().map(date => ({
      date,
      revenue:     revenueByDay[date]     ?? 0,
      spend:       metaByDay[date]?.spend       ?? 0,
      clicks:      metaByDay[date]?.clicks      ?? 0,
      impressions: metaByDay[date]?.impressions ?? 0,
      net:         (revenueByDay[date] ?? 0) - (metaByDay[date]?.spend ?? 0),
      meta_ads:            revenueByDayChannel[date]?.meta_ads ?? 0,
      sin_utm_con_landing: revenueByDayChannel[date]?.sin_utm_con_landing ?? 0,
      sin_dato_de_visita:  revenueByDayChannel[date]?.sin_dato_de_visita ?? 0,
      otro:                (revenueByDayChannel[date]?.google_ads ?? 0) + (revenueByDayChannel[date]?.otro_utm ?? 0),
    }))

    // ── Net revenue total ─────────────────────────────────────────
    const netRevenue = totalRevenue - metaTotals.spend

    // ── Fuentes de tráfico: revenue real por canal (Capa 1, ver lib/attribution.ts) ──
    const trafficSources = channels
      .filter(c => c.orders > 0 || c.revenue > 0)
      .map(c => ({ source: c.label, value: c.orders, revenue: c.revenue, color: c.color }))

    // ── LTV / CAC ────────────────────────────────────────────────
    const ltvResult = await prisma.customer.aggregate({
      where: whereStore,
      _sum: { total_spent: true },
      _count: { id: true },
    })
    const ltv = ltvResult._count.id > 0 ? (ltvResult._sum.total_spent ?? 0) / ltvResult._count.id : 0
    const cac = newCustomers > 0 ? metaTotals.spend / newCustomers : 0

    // ── ROAS real de Meta: SOLO revenue de órdenes confirmadas como meta_ads ──
    // (antes: totalRevenue/metaSpend mezclaba ventas orgánicas -> ROAS inflado, ver
    // feedback_attribution_framework). cacMetaReal usa solo las órdenes de ese canal.
    const metaChannel = byChannel.meta_ads
    const roasMetaReal = metaTotals.spend > 0 ? metaChannel.revenue / metaTotals.spend : 0
    const cacMetaReal  = metaChannel.orders > 0 ? metaTotals.spend / metaChannel.orders : 0

    // ── ROAS GLOBAL: pulso del negocio, no atribución por canal. TODO lo que
    // ingresó por TN en el período / TODO lo gastado en ads (Meta + Google).
    // A diferencia de roasMetaReal (que es channel-attributed y sirve para
    // decidir presupuesto por canal), este SÍ incluye venta orgánica en el
    // numerador a propósito -- es la foto rápida de "cómo vino el período",
    // captura también el halo (Meta empuja venta que después aparece
    // orgánica/directa, ver sesión de correlación). No usar para comparar
    // Meta vs Google entre sí -- para eso está roasMetaReal / channels[].
    const totalAdSpend = metaTotals.spend + googleSpend
    const roasGlobal    = totalAdSpend > 0 ? totalRevenue / totalAdSpend : 0

    // ── Comparativa 7 días (siempre vs hoy, independiente del filtro) ──
    const now    = new Date()
    const d7ago  = new Date(now); d7ago.setDate(d7ago.getDate() - 7)
    const d14ago = new Date(now); d14ago.setDate(d14ago.getDate() - 14)

    const [last7, prev7] = await Promise.all([
      prisma.customer.aggregate({
        where: { ...whereStore, createdAt: { gte: d7ago,  lte: now   } },
        _sum: { total_spent: true }, _count: { id: true },
      }),
      prisma.customer.aggregate({
        where: { ...whereStore, createdAt: { gte: d14ago, lte: d7ago } },
        _sum: { total_spent: true }, _count: { id: true },
      }),
    ])

    const last7Rev  = last7._sum.total_spent ?? 0
    const prev7Rev  = prev7._sum.total_spent ?? 0
    const delta     = prev7Rev > 0 ? ((last7Rev - prev7Rev) / prev7Rev) * 100
                    : last7Rev > 0 ? 100 : 0

    const trend7d = {
      last7Rev,
      prev7Rev,
      last7Orders: last7._count.id,
      prev7Orders: prev7._count.id,
      delta:       Math.round(delta * 10) / 10,
      direction:   Math.abs(delta) <= 10 ? 'neutral' : delta > 0 ? 'up' : 'down' as 'up'|'down'|'neutral',
    }

    return NextResponse.json({
      period:  { since, until },
      summary: {
        totalRevenue,
        metaSpend:   metaTotals.spend,
        netRevenue,
        newCustomers,
        cac,
        cacMetaReal,
        ltv,
        clicks:      metaTotals.clicks,
        impressions: metaTotals.impressions,
        reach:       metaTotals.reach,
        roasBlended: metaTotals.spend > 0 ? totalRevenue / metaTotals.spend : 0, // legado: TN total / gasto Meta, mezcla orgánico. NO usar para decisiones.
        roasMetaReal,
        googleSpend,
        totalAdSpend,
        roasGlobal,
      },
      channels,
      timeline,
      trafficSources,
      trend7d,
    })
  } catch (err) {
    // El mensaje crudo de Prisma trae el host de la base y rutas del disco,
    // y el panel lo imprimía tal cual en pantalla. El detalle va al log del
    // servidor; al cliente solo el trace_id para poder cruzarlo.
    const trace = traceId(req)
    log.error('analytics: fallo al calcular métricas', { ambito: 'analytics', trace_id: trace }, err)
    return NextResponse.json(
      { error: 'No se pudieron cargar las métricas', trace_id: trace },
      { status: 500 },
    )
  }
}
