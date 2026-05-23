import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const since = req.nextUrl.searchParams.get('since') ?? '2026-05-01'
  const until = req.nextUrl.searchParams.get('until') ?? '2026-05-23'
  const envCheck = {
    GOOGLE_CLIENT_ID:           !!process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET:       !!process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN:       !!process.env.GOOGLE_REFRESH_TOKEN,
    GOOGLE_ADS_DEVELOPER_TOKEN: !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    GOOGLE_ADS_CUSTOMER_ID:     !!process.env.GOOGLE_ADS_CUSTOMER_ID,
    CLARITY_TOKEN:              !!process.env.CLARITY_TOKEN,
    CLARITY_PROJECT_ID:         !!process.env.CLARITY_PROJECT_ID,
    GA4_PROPERTY_ID:            !!process.env.GA4_PROPERTY_ID,
  }

  // Test Google token refresh
  let tokenOk = false
  let tokenError = ''
  let clarityRaw: unknown = null
  let ga4Raw: unknown = null

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id:     process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN ?? '',
        grant_type:    'refresh_token',
      }),
    })
    const d = await res.json() as { access_token?: string; error?: string }
    tokenOk = !!d.access_token
    tokenError = d.error ?? ''

    if (d.access_token) {
      // Test GA4
      try {
        const ga4Res = await fetch(
          `https://analyticsdata.googleapis.com/v1beta/properties/${process.env.GA4_PROPERTY_ID}:runReport`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${d.access_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
              metrics: [{ name: 'sessions' }],
              limit: 1,
            }),
          },
        )
        ga4Raw = { status: ga4Res.status, body: await ga4Res.json() }
      } catch (e) { ga4Raw = { error: String(e) } }
    }
  } catch (e) { tokenError = String(e) }

  // Test Clarity - replicate EXACT fetchClarity logic from /api/performance
  let claritySteps: Record<string, unknown> = {}
  try {
    const clarityToken = process.env.CLARITY_TOKEN
    claritySteps.hasToken = !!clarityToken
    const params = new URLSearchParams({
      projectId: process.env.CLARITY_PROJECT_ID ?? '',
      startDate: since,
      endDate: until,
    })
    const cRes = await fetch(
      `https://www.clarity.ms/export-data/api/v1/project-insights?${params}`,
      { headers: { Authorization: `Bearer ${clarityToken ?? ''}` } },
    )
    claritySteps.httpStatus = cRes.status
    claritySteps.ok = cRes.ok
    if (!cRes.ok) {
      clarityRaw = { ...claritySteps, error: 'not ok → returns null' }
    } else {
      const text = await cRes.text()
      claritySteps.responseLength = text.length
      claritySteps.preview = text.slice(0, 300)
      const data = JSON.parse(text) as { MetricName?: string; metricName?: string; Information?: unknown[] }[]
      claritySteps.isArray = Array.isArray(data)
      claritySteps.itemCount = data.length
      claritySteps.firstItemKeys = data[0] ? Object.keys(data[0]) : []
      claritySteps.firstMetricName = data[0]?.MetricName ?? data[0]?.metricName ?? 'MISSING'
      // Try both cases
      const byNameLower: Record<string, unknown> = {}
      const byNamePascal: Record<string, unknown> = {}
      for (const m of data) {
        if ((m as Record<string, unknown>).metricName) byNameLower[(m as Record<string, unknown>).metricName as string] = true
        if ((m as Record<string, unknown>).MetricName) byNamePascal[(m as Record<string, unknown>).MetricName as string] = true
      }
      claritySteps.foundKeysLower  = Object.keys(byNameLower)
      claritySteps.foundKeysPascal = Object.keys(byNamePascal)
      const traffic = data.find(m => m.MetricName === 'Traffic' || m.metricName === 'Traffic')
      claritySteps.trafficInfo = traffic?.Information ?? (traffic as Record<string, unknown>)?.information ?? 'NOT FOUND'
      clarityRaw = claritySteps
    }
  } catch (e) { clarityRaw = { ...claritySteps, error: String(e) } }

  return NextResponse.json({ envCheck, tokenOk, tokenError, clarityRaw, ga4Raw })
}
