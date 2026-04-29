import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
    const wherePeriod = { ...whereStore, createdAt: { gte: startDate, lte: endDate } }

    // ── TN: Revenue por día ──────────────────────────────────────
    const periodCustomers = await prisma.customer.findMany({
      where: wherePeriod,
      select: { createdAt: true, total_spent: true },
      orderBy: { createdAt: 'asc' },
    })

    const revenueByDay = periodCustomers.reduce<Record<string, number>>((acc, c) => {
      const day = c.createdAt.toISOString().slice(0, 10)
      acc[day] = (acc[day] ?? 0) + c.total_spent
      return acc
    }, {})

    const totalRevenue = periodCustomers.reduce((s, c) => s + c.total_spent, 0)
    const newCustomers = periodCustomers.length

    // ── Meta Ads por día ─────────────────────────────────────────
    const [metaDays, metaTotals] = await Promise.all([
      fetchMetaByDay(since, until),
      fetchMetaTotals(since, until),
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
    }))

    // ── Net revenue total ─────────────────────────────────────────
    const netRevenue = totalRevenue - metaTotals.spend

    // ── Fuentes de tráfico (estimado con datos disponibles) ───────
    // Meta clicks = paid traffic
    // Resto = orgánico + directo (estimado, sin GA4)
    const metaClicks = metaTotals.clicks
    // Sin GA4 no tenemos total de visitas, mostramos lo que tenemos
    const trafficSources = [
      { source: 'Meta Ads',  value: metaClicks,              color: '#f97316' },
      { source: 'Orgánico',  value: null,                    color: '#34d399' }, // requiere GA4
      { source: 'Directo',   value: null,                    color: '#818cf8' }, // requiere GA4
    ]

    // ── LTV / CAC ────────────────────────────────────────────────
    const ltvResult = await prisma.customer.aggregate({
      where: whereStore,
      _sum: { total_spent: true },
      _count: { id: true },
    })
    const ltv = ltvResult._count.id > 0 ? (ltvResult._sum.total_spent ?? 0) / ltvResult._count.id : 0
    const cac = newCustomers > 0 ? metaTotals.spend / newCustomers : 0

    return NextResponse.json({
      period:  { since, until },
      summary: {
        totalRevenue,
        metaSpend:   metaTotals.spend,
        netRevenue,
        newCustomers,
        cac,
        ltv,
        clicks:      metaTotals.clicks,
        impressions: metaTotals.impressions,
        reach:       metaTotals.reach,
        roas: metaTotals.spend > 0 ? totalRevenue / metaTotals.spend : 0,
      },
      timeline,
      trafficSources,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
