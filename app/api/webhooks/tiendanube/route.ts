import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { prisma } from '@/lib/prisma'
import { CampaignService } from '@/services/CampaignService'
import { igualSeguro } from '@/lib/meta-signature'

// Comparación de tiempo constante, igual que en los webhooks de Meta y en /api/cron: `===`
// corta apenas encuentra un byte distinto, y esa diferencia de tiempo alcanza para ir
// adivinando la firma byte por byte.
function verifyHmac(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false
  const expected = createHmac('sha256', secret).update(body).digest('hex')
  return igualSeguro(expected, signature)
}

export async function POST(req: NextRequest) {
  const tnStoreId = req.headers.get('x-linkedstore')
  const event = req.headers.get('x-tiendanube-topic') ?? req.headers.get('x-nuvemshop-topic')
  const hmac = req.headers.get('x-hmac-sha256')

  if (!tnStoreId || !event) {
    return NextResponse.json({ error: 'Missing headers' }, { status: 400 })
  }

  const rawBody = await req.text()

  // FALLA CERRADO. Antes era `if (clientSecret && !verifyHmac(...))`: sin TN_CLIENT_SECRET
  // configurado se aceptaba CUALQUIER cuerpo sin firmar, y este webhook dispara mensajes de
  // WhatsApp desde el número oficial (riesgo de baneo del WABA) además de escribir en la
  // base. Un webhook mudo se nota y se arregla; uno abierto no se nota hasta que es tarde.
  // Es el mismo criterio que ya estaba en lib/cron-auth.ts y lib/meta-signature.ts.
  const clientSecret = process.env.TN_CLIENT_SECRET
  if (!clientSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[webhook tn] TN_CLIENT_SECRET no configurado: se rechaza por seguridad')
      return NextResponse.json({ error: 'Servicio mal configurado' }, { status: 503 })
    }
    console.warn('[webhook tn] sin TN_CLIENT_SECRET: firma no verificada (solo fuera de producción)')
  } else if (!verifyHmac(rawBody, hmac, clientSecret)) {
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
      await service.handleAbandonedCart(body)
      break
    case 'order/created':
      // Pedidos por transferencia/depósito → datos bancarios al instante por WhatsApp.
      await service.handleOrderCreated(body)
      break
    case 'order/paid':
      await service.handleOrderPaid(body)
      break
    default:
      break
  }

  return NextResponse.json({ received: true })
}
