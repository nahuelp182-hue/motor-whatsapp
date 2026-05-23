import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const GADS_CUSTOMER_ID  = process.env.GOOGLE_ADS_CUSTOMER_ID  ?? '5307718423'
const GADS_DEV_TOKEN    = process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? ''
const CLARITY_PROJECT   = process.env.CLARITY_PROJECT_ID ?? 'uhup54dj4f'
const GA4_PROPERTY_ID   = process.env.GA4_PROPERTY_ID ?? ''

// ── OAuth helper ────────────────────────────────────────────────────────────
async function getGoogleAccessToken(): Promise<string | null> {
  const clientId     = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) return null
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type:    'refresh_token',
      }),
    })
    const data = await res.json() as { access_token?: string }
    return data.access_token ?? null
  } catch { return null }
}

// ── Google Ads ──────────────────────────────────────────────────────────────
interface GadsRow {
  campaign?: { id: string; name: string; status: string; advertisingChannelType: string }
  metrics?: {
    impressions: string; clicks: string; costMicros: string
    conversions: number; conversionsValue: number; ctr: number; averageCpc: string
  }
}

async function fetchGoogleAds(token: string, since: string, until: string) {
  if (!GADS_DEV_TOKEN) return null
  const query = `
    SELECT
      campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.conversions_value, metrics.ctr, metrics.average_cpc
    FROM campaign
    WHERE campaign.status = 'ENABLED'
      AND segments.date BETWEEN '${since}' AND '${until}'
    ORDER BY metrics.cost_micros DESC
    LIMIT 10
  `
  try {
    const res = await fetch(
      `https://googleads.googleapis.com/v18/customers/${GADS_CUSTOMER_ID}/googleAds:search`,
      {
        method: 'POST',
        headers: {
          Authorization:    `Bearer ${token}`,
          'developer-token': GADS_DEV_TOKEN,
          'login-customer-id': GADS_CUSTOMER_ID,
          'Content-Type':   'application/json',
        },
        body: JSON.stringify({ query }),
      },
    )
    if (!res.ok) {
      const err = await res.text()
      console.error('Google Ads error:', err)
      return null
    }
    const data = await res.json() as { results?: GadsRow[] }
    const rows = data.results ?? []

    let impressions = 0, clicks = 0, costMicros = 0, conversions = 0, convValue = 0
    const campaigns = rows.map(r => {
      const m = r.metrics!
      const imp   = parseInt(m.impressions  ?? '0')
      const clk   = parseInt(m.clicks       ?? '0')
      const cost  = parseInt(m.costMicros   ?? '0')
      const conv  = m.conversions  ?? 0
      const convv = m.conversionsValue ?? 0
      impressions += imp
      clicks      += clk
      costMicros  += cost
      conversions += conv
      convValue   += convv
      return {
        id:     r.campaign?.id ?? '',
        name:   r.campaign?.name ?? '',
        status: r.campaign?.status ?? '',
        type:   r.campaign?.advertisingChannelType ?? '',
        impressions: imp,
        clicks:      clk,
        costARS:     cost / 1_000_000,
        conversions: conv,
        convValue:   convv,
        ctr:         m.ctr ?? 0,
        avgCpc:      parseInt(m.averageCpc ?? '0') / 1_000_000,
      }
    })

    const totalCostARS = costMicros / 1_000_000
    return {
      totalImpressions: impressions,
      totalClicks:      clicks,
      totalCostARS,
      totalConversions: conversions,
      totalConvValue:   convValue,
      ctr:              clicks > 0 ? clicks / impressions : 0,
      avgCpc:           clicks > 0 ? totalCostARS / clicks : 0,
      roas:             totalCostARS > 0 ? convValue / totalCostARS : 0,
      campaigns,
    }
  } catch (e) {
    console.error('Google Ads fetch error:', e)
    return null
  }
}

// ── Clarity ─────────────────────────────────────────────────────────────────
interface ClarityMetric {
  metricName: string
  information: Record<string, unknown>[]
}

async function fetchClarity(since: string, until: string) {
  const token = process.env.CLARITY_TOKEN
  if (!token) return null
  try {
    const params = new URLSearchParams({ projectId: CLARITY_PROJECT, startDate: since, endDate: until })
    const res = await fetch(
      `https://www.clarity.ms/export-data/api/v1/project-insights?${params}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    if (!res.ok) return null
    const data = await res.json() as ClarityMetric[]
    const byName: Record<string, Record<string, unknown>[]> = {}
    for (const m of data) byName[m.metricName] = m.information

    const traffic    = (byName['Traffic']       ?? [{}])[0] as Record<string, unknown>
    const engagement = (byName['EngagementTime'] ?? [{}])[0] as Record<string, unknown>
    const scroll     = (byName['ScrollDepth']    ?? [{}])[0] as Record<string, unknown>
    const devices    = (byName['Device']         ?? []) as Record<string, unknown>[]
    const quickback  = (byName['QuickbackClick'] ?? [{}])[0] as Record<string, unknown>
    const rageClicks = (byName['RageClickCount'] ?? [{}])[0] as Record<string, unknown>
    const deadClicks = (byName['DeadClickCount'] ?? [{}])[0] as Record<string, unknown>
    const pages      = (byName['PopularPages']   ?? []) as Record<string, unknown>[]

    const mobile = devices.find(d => String(d.deviceType ?? d.device ?? '').toLowerCase() === 'mobile')
    const desktop= devices.find(d => String(d.deviceType ?? d.device ?? '').toLowerCase() === 'desktop')

    return {
      sessions:       Number(traffic.totalSessionCount ?? 0),
      users:          Number(traffic.distinctUserCount  ?? 0),
      pagesPerSession:Number(traffic.pagesPerSessionPercentage ?? 0),
      activeTime:     Number(engagement.activeTime  ?? 0),
      totalTime:      Number(engagement.totalTime   ?? 0),
      scrollDepth:    Number(scroll.averageScrollDepth ?? 0),
      mobilePct:      Number(mobile?.sessionsWithMetricPercentage  ?? 0),
      desktopPct:     Number(desktop?.sessionsWithMetricPercentage ?? 0),
      quickbackPct:   Number(quickback.sessionsWithMetricPercentage ?? 0),
      rageClickPct:   Number(rageClicks.sessionsWithMetricPercentage ?? 0),
      deadClickPct:   Number(deadClicks.sessionsWithMetricPercentage ?? 0),
      topPages: pages
        .sort((a, b) => Number(b.pageViews ?? b.pagesViews ?? 0) - Number(a.pageViews ?? a.pagesViews ?? 0))
        .slice(0, 5)
        .map(p => ({ url: String(p.url ?? p.pageTitle ?? ''), views: Number(p.pageViews ?? p.pagesViews ?? 0) })),
    }
  } catch (e) {
    console.error('Clarity fetch error:', e)
    return null
  }
}

// ── GA4 ─────────────────────────────────────────────────────────────────────
async function fetchGA4(token: string, since: string, until: string) {
  if (!GA4_PROPERTY_ID) return null
  try {
    const body = {
      dateRanges: [{ startDate: since, endDate: until }],
      metrics: [
        { name: 'sessions' },
        { name: 'totalUsers' },
        { name: 'screenPageViews' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
      ],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      limit: 10,
    }
    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )
    if (!res.ok) return null
    type GA4Row = { dimensionValues: { value: string }[]; metricValues: { value: string }[] }
    const data = await res.json() as { rows?: GA4Row[]; totals?: { metricValues: { value: string }[] }[] }
    const rows = data.rows ?? []

    let sessions = 0, users = 0, pageviews = 0, bounceSum = 0, durationSum = 0

    const sources = rows.map(r => {
      const channel = r.dimensionValues[0].value
      const sess    = parseInt(r.metricValues[0].value)
      const usr     = parseInt(r.metricValues[1].value)
      const pv      = parseInt(r.metricValues[2].value)
      const bounce  = parseFloat(r.metricValues[3].value)
      const dur     = parseFloat(r.metricValues[4].value)
      sessions   += sess
      users      += usr
      pageviews  += pv
      bounceSum  += bounce * sess
      durationSum+= dur * sess
      return { channel, sessions: sess, users: usr }
    })

    return {
      sessions,
      users,
      pageviews,
      bounceRate:      sessions > 0 ? bounceSum  / sessions : 0,
      avgSessionDur:   sessions > 0 ? durationSum/ sessions : 0,
      sources: sources.sort((a, b) => b.sessions - a.sessions),
    }
  } catch (e) {
    console.error('GA4 fetch error:', e)
    return null
  }
}

// ── Handler ─────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const p     = req.nextUrl.searchParams
    const since = p.get('since') ?? (() => { const d = new Date(); d.setDate(d.getDate()-29); return d.toISOString().slice(0,10) })()
    const until = p.get('until') ?? new Date().toISOString().slice(0,10)

    const [token, clarity] = await Promise.all([
      getGoogleAccessToken(),
      fetchClarity(since, until),
    ])

    const [gads, ga4] = await Promise.all([
      token ? fetchGoogleAds(token, since, until) : Promise.resolve(null),
      token ? fetchGA4(token, since, until)       : Promise.resolve(null),
    ])

    return NextResponse.json({ since, until, gads, clarity, ga4 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
