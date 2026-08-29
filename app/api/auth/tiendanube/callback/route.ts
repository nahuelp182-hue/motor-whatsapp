import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const TN_APP_ID = process.env.TN_APP_ID!
const TN_CLIENT_SECRET = process.env.TN_CLIENT_SECRET!

async function registerWebhooks(storeId: string, token: string, webhookUrl: string) {
  const events = ['checkout/abandoned', 'order/paid']
  for (const event of events) {
    await fetch(`https://api.tiendanube.com/v1/${storeId}/webhooks`, {
      method: 'POST',
      headers: {
        Authentication: `bearer ${token}`,
        'User-Agent': `MotorWhatsApp (info.micelium@gmail.com)`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event, url: webhookUrl }),
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

  // Los webhooks de pedidos disparan CampaignService: mensajes de WhatsApp desde el número
  // oficial y escritura en la cola de campañas. Es lógica de UN producto (el bot de
  // Micelium), no del motor de widgets — una instancia sin bot (como Osamayor) no tiene que
  // registrarlos, ni siquiera contra su propio dominio: dispararía lógica de WhatsApp que
  // no tiene sentido ahí y fallaría sin WHATSAPP_TOKEN configurado.
  //
  // Antes esto comparaba `storeId === TN_STORE_ID` para decidir "tienda propia", pero esa
  // comparación asumía una sola instancia posible (Micelium). Con dos instancias, cada una
  // tiene SU PROPIO TN_STORE_ID en el entorno —en Osamayor apunta a OSA MAYOR—, así que la
  // comparación daba `true` ahí también y registraba los webhooks apuntando a
  // mw-micelium.vercel.app (hardcodeado): los pedidos de OSA MAYOR le habrían pegado al
  // servidor de Micelium. La firma HMAC los habría rechazado con 401 —los client secret
  // de las dos apps son distintos, así que no hubo fuga de datos— pero igual era ruido en
  // los logs de Micelium y una funcionalidad rota en la instancia nueva.
  //
  // La pregunta correcta no es "¿es la tienda de Micelium?" sino "¿esta instancia tiene
  // bot de WhatsApp?". Eso lo dice si el token está configurado, no un ID de tienda.
  const tieneWhatsapp = !!process.env.WHATSAPP_TOKEN
  if (tieneWhatsapp) {
    const webhookUrl = new URL('/api/webhooks/tiendanube', req.nextUrl.origin).toString()
    await registerWebhooks(storeId, token, webhookUrl)
  }

  return NextResponse.json({
    ok: true,
    store_id: storeId,
    creada: !existente,
    webhooks: tieneWhatsapp,
  })
}
