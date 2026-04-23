import { NextRequest, NextResponse } from 'next/server'

const MY_IG_ID = '26396251790068157'
const WA_LINK = 'https://wa.me/5493525623546'
const AUTO_REPLY = `¡Hola! 👋 Para atenderte mejor y más rápido, escribinos por WhatsApp: ${WA_LINK} — ¡Te respondemos enseguida! 🍄`

// GET — verificación del webhook por Meta
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode')
  const token = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// POST — mensajes entrantes
export async function POST(req: NextRequest) {
  const body = await req.json() as {
    entry?: Array<{
      messaging?: Array<{
        sender: { id: string }
        recipient: { id: string }
        message?: { text?: string; is_echo?: boolean }
      }>
    }>
  }

  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  if (!token) return NextResponse.json({ ok: true })

  for (const entry of body.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      // Ignorar mensajes propios (echo)
      if (event.sender.id === MY_IG_ID) continue
      if (event.message?.is_echo) continue
      if (!event.message?.text) continue

      const recipientId = event.sender.id

      // Responder con el link de WhatsApp
      await fetch(`https://graph.facebook.com/v21.0/${MY_IG_ID}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: AUTO_REPLY },
          messaging_type: 'RESPONSE',
        }),
      }).catch(console.error)
    }
  }

  return NextResponse.json({ ok: true })
}
