// Google Ads Offline Conversion Upload — server-side
// Documentación: https://developers.google.com/google-ads/api/docs/conversions/upload-clicks

const CUSTOMER_ID = '5307718423'
const CONVERSION_ACTION_ID = '6918753596' // Tiendanube Backend purchases
const DEVELOPER_TOKEN = process.env.GADS_DEVELOPER_TOKEN ?? ''
const OAUTH_REFRESH_TOKEN = process.env.GADS_REFRESH_TOKEN ?? ''
const OAUTH_CLIENT_ID = process.env.GADS_CLIENT_ID ?? ''
const OAUTH_CLIENT_SECRET = process.env.GADS_CLIENT_SECRET ?? ''

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET,
      refresh_token: OAUTH_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`OAuth failed: ${res.status}`)
  const data = await res.json() as { access_token: string }
  return data.access_token
}

// Formato requerido por Google Ads: "yyyy-mm-dd hh:mm:ss+tz"
function formatConversionDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const mo = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const h = pad(date.getHours())
  const mi = pad(date.getMinutes())
  const s = pad(date.getSeconds())
  return `${y}-${mo}-${d} ${h}:${mi}:${s}-03:00`
}

export async function uploadClickConversion(params: {
  gclid: string
  orderTotal: number
  conversionDateTime: Date
  orderId: string
}): Promise<{ ok: boolean; error?: string }> {
  if (!DEVELOPER_TOKEN || !OAUTH_REFRESH_TOKEN) {
    return { ok: false, error: 'Google Ads credentials not configured' }
  }

  try {
    const accessToken = await getAccessToken()
    const conversionActionRn = `customers/${CUSTOMER_ID}/conversionActions/${CONVERSION_ACTION_ID}`

    const payload = {
      conversions: [
        {
          gclid: params.gclid,
          conversion_action: conversionActionRn,
          conversion_date_time: formatConversionDateTime(params.conversionDateTime),
          conversion_value: params.orderTotal,
          currency_code: 'ARS',
          order_id: String(params.orderId),
        },
      ],
      partial_failure: true,
    }

    const res = await fetch(
      `https://googleads.googleapis.com/v18/customers/${CUSTOMER_ID}:uploadClickConversions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'developer-token': DEVELOPER_TOKEN,
          'login-customer-id': CUSTOMER_ID,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    )

    const data = await res.json() as {
      results?: { gclid: string }[]
      partialFailureError?: { message: string }
    }

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(data)}` }
    }
    if (data.partialFailureError) {
      return { ok: false, error: data.partialFailureError.message }
    }

    return { ok: true }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}
