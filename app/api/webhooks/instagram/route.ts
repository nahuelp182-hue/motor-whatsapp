import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const IG_ID   = process.env.IG_ACCOUNT_ID ?? '17841475593696785'
const PAGE_TOKEN = process.env.FB_PAGE_TOKEN ?? ''

// Preguntas frecuentes que la IA puede responder sola
const CONTEXTO_MICELIUM = `
Sos el asistente de ventas de Micelium Argentina, fabricantes de incubadoras automáticas para cultivo de hongos.

PRODUCTOS Y PRECIOS:
- INC101 V2: incubadora automática. Controla temperatura, humedad y ventilación. 20W consumo. Precio: consultá en infomicelium.com.ar
- Kits y accesorios: disponibles en la tienda online

POLÍTICAS:
- Envíos a todo el país (Andreani)
- 1 año de garantía
- 30 días de devolución
- Soporte por WhatsApp

IMPORTANTE: NO vendemos hongos, sustratos ni esporas. Solo equipos de cultivo.
Siempre invitá a ver la tienda: infomicelium.com.ar

Respondé en tono amigable, informal (tuteo), con emojis ocasionales. Máximo 3 líneas.
Si te piden precio exacto, decí que lo ven en la tienda online o que te dejen el teléfono para enviarlo por WhatsApp.
`

const FAQ_KEYWORDS = [
  /precio|cuanto sale|cuánto sale|costo|vale|\$|oferta|descuento|cuota/i,
  /envio|envío|despacho|manda|llegada|andreani|correo/i,
  /garantia|garantía|devoluc/i,
  /como funciona|cómo funciona|que hace|qué hace|para qué/i,
  /disponible|stock|tiene/i,
  /info|informacion|información|quiero saber|contame/i,
]

function esFAQ(texto: string): boolean {
  return FAQ_KEYWORDS.some(re => re.test(texto))
}

async function generarRespuestaIA(mensaje: string): Promise<string> {
  const client = new Anthropic()
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [
      { role: 'user', content: `${CONTEXTO_MICELIUM}\n\nMensaje del cliente: "${mensaje}"\n\nRespondé:` }
    ],
  })
  const block = response.content[0]
  return block.type === 'text' ? block.text.trim() : ''
}

async function enviarMensajeIG(recipientId: string, texto: string) {
  await fetch(`https://graph.facebook.com/v21.0/${IG_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAGE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: texto },
      messaging_type: 'RESPONSE',
    }),
  })
}

async function notificarNahuel(senderIgId: string, mensaje: string) {
  // Notificación vía WhatsApp API si hay WABA configurado
  const waPhoneId = process.env.WA_PHONE_NUMBER_ID
  const waToken   = process.env.WA_TOKEN
  const nahuelWa  = process.env.NAHUEL_WA_PHONE ?? '5493522412228'

  if (!waPhoneId || !waToken) return

  const texto = `🔔 *DM de Instagram sin respuesta automática*\n\nID usuario: ${senderIgId}\nMensaje: "${mensaje.slice(0, 200)}"\n\n👉 Respondé desde Meta Business Suite o business.facebook.com`

  await fetch(`https://graph.facebook.com/v21.0/${waPhoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${waToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: nahuelWa,
      type: 'text',
      text: { body: texto },
    }),
  }).catch(console.error)
}

// GET — verificación del webhook por Meta
export async function GET(req: NextRequest) {
  const mode      = req.nextUrl.searchParams.get('hub.mode')
  const token     = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')

  const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN ?? 'micelium_ig_webhook_2026'
  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// POST — mensajes entrantes de Instagram
export async function POST(req: NextRequest) {
  let body: {
    object?: string
    entry?: Array<{
      id?: string
      messaging?: Array<{
        sender: { id: string }
        recipient: { id: string }
        message?: { text?: string; is_echo?: boolean; mid?: string }
        timestamp?: number
      }>
    }>
  }

  try { body = await req.json() } catch { return NextResponse.json({ ok: true }) }

  if (body.object !== 'instagram') return NextResponse.json({ ok: true })

  for (const entry of body.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      // Ignorar mensajes propios
      if (event.message?.is_echo) continue
      if (event.sender.id === IG_ID) continue
      const texto = event.message?.text?.trim()
      if (!texto) continue

      const senderId = event.sender.id

      try {
        if (esFAQ(texto)) {
          // IA responde directamente
          const respuesta = await generarRespuestaIA(texto)
          if (respuesta) await enviarMensajeIG(senderId, respuesta)
        } else {
          // Mensaje complejo: respuesta genérica + notificación a Nahuel
          await enviarMensajeIG(
            senderId,
            '¡Hola! 👋 Gracias por escribirnos. En breve te respondemos personalmente 🍄'
          )
          await notificarNahuel(senderId, texto)
        }
      } catch (err) {
        console.error('IG webhook error:', err)
        // Fallback silencioso para no romper el 200
      }
    }
  }

  return NextResponse.json({ ok: true })
}
