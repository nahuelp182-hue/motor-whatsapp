import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const TN_APP_ID = process.env.TN_APP_ID!
const TN_CLIENT_SECRET = process.env.TN_CLIENT_SECRET!
const WA_WEBHOOK_URL = 'https://mw-micelium.vercel.app/api/webhooks/tiendanube'

/** La tienda de esta instancia. Todo lo que no sea ella entra como tienda de terceros. */
const TN_STORE_ID = process.env.TN_STORE_ID ?? ''

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
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
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

  const data = await res.json() as Record<string, unknown>
  const storeId = String(data.user_id ?? data.store_id ?? data.id ?? '')
  const token = String(data.access_token ?? '')

  if (!storeId || !token) {
    return NextResponse.json({ error: 'Missing fields', raw: data }, { status: 500 })
  }

  // Guardar el token. Antes era un `updateMany` a secas: si la tienda no estaba cargada,
  // afectaba CERO filas y el token se perdía en silencio —el flujo devolvía ok:true igual—.
  // Con una sola tienda nunca se notó porque la fila existía desde el principio; con una
  // segunda tienda ese silencio es justo el primer paso del alta.
  const existente = await prisma.store.findFirst({
    where: { tiendanube_store_id: storeId },
    select: { id: true },
  })

  if (existente) {
    await prisma.store.update({
      where: { id: existente.id },
      data: { tiendanube_access_token: token },
    })
  } else {
    // Alta de una tienda nueva. `nombre` es provisorio: el de verdad se completa desde el
    // panel. Los tokens de WhatsApp quedan vacíos a propósito —esta tienda no tiene bot— y
    // `is_active` en true porque una tienda que acaba de autorizar la app quiere usarla.
    await prisma.store.create({
      data: {
        nombre: `Tienda ${storeId}`,
        tiendanube_store_id: storeId,
        tiendanube_access_token: token,
        whatsapp_api_token: '',
      },
    })
  }

  // Los webhooks de pedidos alimentan el bot de WhatsApp y el carrito abandonado, que son
  // de Micelium: apuntan a mw-micelium.vercel.app. Registrarlos en una tienda de terceros
  // haría que SUS pedidos y SUS carritos abandonados entren al bot de Micelium —datos de
  // clientes de otra persona en un sistema que no es el suyo, y mensajes de WhatsApp
  // saliendo a nombre equivocado. Por eso solo se registran en la tienda propia.
  const esTiendaPropia = !!TN_STORE_ID && storeId === TN_STORE_ID
  if (esTiendaPropia) {
    await registerWebhooks(storeId, token)
  }

  return NextResponse.json({
    ok: true,
    store_id: storeId,
    creada: !existente,
    webhooks: esTiendaPropia,
  })
}
