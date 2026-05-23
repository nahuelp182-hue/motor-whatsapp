import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
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

  // Test Clarity
  try {
    const params = new URLSearchParams({
      projectId: process.env.CLARITY_PROJECT_ID ?? '',
      startDate: '2026-05-16',
      endDate: '2026-05-23',
    })
    const cRes = await fetch(
      `https://www.clarity.ms/export-data/api/v1/project-insights?${params}`,
      { headers: { Authorization: `Bearer ${process.env.CLARITY_TOKEN ?? ''}` } },
    )
    const cText = await cRes.text()
    clarityRaw = { status: cRes.status, preview: cText.slice(0, 200) }
  } catch (e) { clarityRaw = { error: String(e) } }

  return NextResponse.json({ envCheck, tokenOk, tokenError, clarityRaw, ga4Raw })
}
