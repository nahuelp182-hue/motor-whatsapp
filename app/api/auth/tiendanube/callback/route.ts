import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const TN_APP_ID = process.env.TN_APP_ID!
const TN_CLIENT_SECRET = process.env.TN_CLIENT_SECRET!
const WA_WEBHOOK_URL = 'https://mw-micelium.vercel.app/api/webhooks/tiendanube'

async function registerWebhooks(storeId: string, token: string) {
  const events = ['checkout/abandoned', 'order/paid']
  for (const event of events) {
    await fetch(`https://api.tiendanube.com/v1/${storeId}/webhooks`, {
      method: 'POST',
      headers: {
        Authentication: `bearer ${token}`,
        'User-Agent': `MotorWhatsApp (info.micelium@gmail.com)`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event, url: WA_WEBHOOK_URL }),
    })
  }
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

  // Intercambiar code por access_token
  const res = await fetch('https://www.tiendanube.com/apps/authorize/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: TN_APP_ID,
      client_secret: TN_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: 500 })
  }

  const data = await res.json() as { access_token: string; user_id: number }
  const storeId = String(data.user_id)
  const token = data.access_token

  // Guardar token en el Store
  await prisma.store.updateMany({
    where: { tiendanube_store_id: storeId },
    data: { tiendanube_access_token: token },
  })

  // Registrar webhooks en TN
  await registerWebhooks(storeId, token)

  return NextResponse.json({ ok: true, store_id: storeId })
}
