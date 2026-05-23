import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const GADS_CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID ?? '5307718423'
const CLARITY_PROJECT  = process.env.CLARITY_PROJECT_ID ?? 'uhup54dj4f'
const GA4_PROPERTY_ID  = process.env.GA4_PROPERTY_ID ?? ''

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
        client_id: clientId, client_secret: clientSecret,
        refresh_token: refreshToken, grant_type: 'refresh_token',
      }),
    })
    const data = await res.json() as { access_token?: string }
    return data.access_token ?? null
  } catch { return null }
}

// ── Google Ads — reads from cache table (populated by Python cron) ──────────
async function fetchGoogleAdsCache(since: string, until: string) {
  // Google Ads API only supports gRPC (no REST interface).
  // Data is populated via the local Python script: ~/.claude/gads.py
  // The script writes to the gads_cache table in Supabase daily.
  // For now we check the DB; if empty, return null.
  try {
    const { prisma } = await import('@/lib/prisma')
    const rows = await (prisma as unknown as {
      gadsCache?: { findMany: (args: object) => Promise<{
        date: string; campaign_name: string; campaign_id: string; campaign_status: string; campaign_type: string;
        impressions: number; clicks: number; cost_ars: number;
        conversions: number; conv_value: number; ctr: number; avg_cpc: number;
      }[]> }
    }).gadsCache?.findMany({
      where: {
        date: { gte: since, lte: until },
      },
      orderBy: { cost_ars: 'desc' },
    })

    if (!rows || rows.length === 0) return null

    let impressions = 0, clicks = 0, costARS = 0, conversions = 0, convValue = 0
    const campaigns: Record<string, {
      id: string; name: string; status: string; type: string;
      impressions: number; clicks: number; costARS: number;
      conversions: number; convValue: number; ctr: number; avgCpc: number;
    }> = {}

    for (const r of rows) {
      impressions += r.impressions; clicks += r.clicks; costARS += r.cost_ars
      conversions += r.conversions; convValue += r.conv_value
      const key = r.campaign_id
      if (!campaigns[key]) {
        campaigns[key] = {
          id: r.campaign_id, name: r.campaign_name,
          status: r.campaign_status, type: r.campaign_type,
          impressions: 0, clicks: 0, costARS: 0,
          conversions: 0, convValue: 0, ctr: 0, avgCpc: 0,
        }
      }
      campaigns[key].impressions += r.impressions
      campaigns[key].clicks      += r.clicks
      campaigns[key].costARS     += r.cost_ars
      campaigns[key].conversions += r.conversions
      campaigns[key].convValue   += r.conv_value
    }

    const campaignList = Object.values(campaigns).map(c => ({
      ...c,
      ctr:    c.impressions > 0 ? c.clicks / c.impressions : 0,
      avgCpc: c.clicks > 0 ? c.costARS / c.clicks : 0,
    }))

    return {
      totalImpressions: impressions,
      totalClicks:      clicks,
      totalCostARS:     costARS,
      totalConversions: conversions,
      totalConvValue:   convValue,
      ctr:              impressions > 0 ? clicks / impressions : 0,
      avgCpc:           clicks > 0 ? costARS / clicks : 0,
      roas:             costARS > 0 ? convValue / costARS : 0,
      campaigns:        campaignList,
      fromCache:        true,
    }
  } catch {
    return null
  }
}

// ── Clarity ─────────────────────────────────────────────────────────────────
// API returns PascalCase: MetricName, Information
interface ClarityMetric {
  MetricName: string
  Information: Record<string, unknown>[]
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
    for (const m of data) byName[m.MetricName] = m.Information

    const traffic    = (byName['Traffic']       ?? [{}])[0]
    const engagement = (byName['EngagementTime'] ?? [{}])[0]
    const scroll     = (byName['ScrollDepth']    ?? [{}])[0]
    const devices    = (byName['Device']         ?? [])
    const quickback  = (byName['QuickbackClick'] ?? [{}])[0]
    const rageClicks = (byName['RageClickCount'] ?? [{}])[0]
    const deadClicks = (byName['DeadClickCount'] ?? [{}])[0]
    const pages      = (byName['PopularPages']   ?? [])

    const mobile  = devices.find(d => String(d.deviceType ?? d.device ?? d.Device ?? '').toLowerCase() === 'mobile')
    const desktop = devices.find(d => String(d.deviceType ?? d.device ?? d.Device ?? '').toLowerCase() === 'desktop')

    return {
      sessions:       Number(traffic.totalSessionCount ?? 0),
      users:          Number(traffic.distinctUserCount  ?? 0),
      pagesPerSession:Number(traffic.pagesPerSessionPercentage ?? 0),
      activeTime:     Number(engagement.activeTime  ?? 0),
      totalTime:      Number(engagement.totalTime   ?? 0),
      scrollDepth:    Number(scroll.averageScrollDepth ?? 0),
      mobilePct:      Number(mobile?.sessionsWithMetricPercentage  ?? mobile?.SessionsWithMetricPercentage  ?? 0),
      desktopPct:     Number(desktop?.sessionsWithMetricPercentage ?? desktop?.SessionsWithMetricPercentage ?? 0),
      quickbackPct:   Number(quickback.sessionsWithMetricPercentage ?? quickback.SessionsWithMetricPercentage ?? 0),
      rageClickPct:   Number(rageClicks.sessionsWithMetricPercentage ?? rageClicks.SessionsWithMetricPercentage ?? 0),
      deadClickPct:   Number(deadClicks.sessionsWithMetricPercentage ?? deadClicks.SessionsWithMetricPercentage ?? 0),
      topPages: pages
        .sort((a, b) => Number(b.pageViews ?? b.pagesViews ?? b.PageViews ?? 0) - Number(a.pageViews ?? a.pagesViews ?? a.PageViews ?? 0))
        .slice(0, 5)
        .map(p => ({
          url:   String(p.url ?? p.pageTitle ?? p.Url ?? p.PageTitle ?? ''),
          views: Number(p.pageViews ?? p.pagesViews ?? p.PageViews ?? 0),
        })),
    }
  } catch (e) {
    console.error('[performance] Clarity error:', e)
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
        { name: 'sessions' }, { name: 'totalUsers' },
        { name: 'screenPageViews' }, { name: 'bounceRate' },
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
    if (!res.ok) {
      console.error('[performance] GA4 error:', res.status, await res.text())
      return null
    }
    type GA4Row = {
      dimensionValues?: { value: string }[]
      metricValues: { value: string }[]
    }
    const data = await res.json() as { rows?: GA4Row[] }
    const rows = data.rows ?? []

    let sessions = 0, users = 0, pageviews = 0, bounceSum = 0, durationSum = 0

    const sources = rows.map(r => {
      const channel = r.dimensionValues?.[0]?.value ?? 'Unknown'
      const sess    = parseInt(r.metricValues[0]?.value ?? '0')
      const usr     = parseInt(r.metricValues[1]?.value ?? '0')
      const pv      = parseInt(r.metricValues[2]?.value ?? '0')
      const bounce  = parseFloat(r.metricValues[3]?.value ?? '0')
      const dur     = parseFloat(r.metricValues[4]?.value ?? '0')
      sessions    += sess
      users       += usr
      pageviews   += pv
      bounceSum   += bounce * sess
      durationSum += dur * sess
      return { channel, sessions: sess, users: usr }
    })

    return {
      sessions,
      users,
      pageviews,
      bounceRate:    sessions > 0 ? bounceSum   / sessions : 0,
      avgSessionDur: sessions > 0 ? durationSum / sessions : 0,
      sources: sources.sort((a, b) => b.sessions - a.sessions),
    }
  } catch (e) {
    console.error('[performance] GA4 error:', e)
    return null
  }
}

// ── Handler ─────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const p     = req.nextUrl.searchParams
    const since = p.get('since') ?? (() => { const d = new Date(); d.setDate(d.getDate()-29); return d.toISOString().slice(0,10) })()
    const until = p.get('until') ?? new Date().toISOString().slice(0,10)

    const [token, clarity, gads] = await Promise.all([
      getGoogleAccessToken(),
      fetchClarity(since, until),
      fetchGoogleAdsCache(since, until),
    ])

    const ga4 = token ? await fetchGA4(token, since, until) : null

    return NextResponse.json({ since, until, gads, clarity, ga4 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[performance] outer error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
