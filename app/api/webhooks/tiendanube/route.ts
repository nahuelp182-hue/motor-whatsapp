import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { prisma } from '@/lib/prisma'
import { CampaignService } from '@/services/CampaignService'

function verifyHmac(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  return expected === signature
}

export async function POST(req: NextRequest) {
  const tnStoreId = req.headers.get('x-linkedstore')
  const event = req.headers.get('x-tiendanube-topic') ?? req.headers.get('x-nuvemshop-topic')
  const hmac = req.headers.get('x-hmac-sha256')

  if (!tnStoreId || !event) {
    return NextResponse.json({ error: 'Missing headers' }, { status: 400 })
  }

  const rawBody = await req.text()

  const clientSecret = process.env.TN_CLIENT_SECRET
  if (clientSecret && !verifyHmac(rawBody, hmac, clientSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const store = await prisma.store.findFirst({
    where: { tiendanube_store_id: tnStoreId, is_active: true },
  })

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  const body = JSON.parse(rawBody)
  const service = new CampaignService(store)

  switch (event) {
    case 'checkout/abandoned':
      service.handleAbandonedCart(body).catch(console.error)
      break
    case 'order/paid':
      service.handleOrderPaid(body).catch(console.error)
      break
    default:
      break
  }

  return NextResponse.json({ received: true })
}
