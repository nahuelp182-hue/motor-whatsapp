import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CampaignService } from '@/services/CampaignService'

export async function POST(req: NextRequest) {
  const storeToken = req.headers.get('x-store-token')
  const event = req.headers.get('x-tiendanube-topic') ?? req.headers.get('x-nuvemshop-topic')

  if (!storeToken || !event) {
    return NextResponse.json({ error: 'Missing headers' }, { status: 400 })
  }

  const store = await prisma.store.findFirst({
    where: { tiendanube_access_token: storeToken, is_active: true },
  })

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  }

  const body = await req.json()

  // Responder 200 inmediatamente — procesamos async
  const service = new CampaignService(store)

  switch (event) {
    case 'checkout/abandoned':
      service.handleAbandonedCart(body).catch(console.error)
      break
    case 'order/paid':
      service.handleOrderPaid(body).catch(console.error)
      break
    default:
      // Evento no manejado — ignorar silenciosamente
      break
  }

  return NextResponse.json({ received: true })
}
