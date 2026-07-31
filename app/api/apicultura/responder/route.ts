// Escribirle al tío desde el panel.
//
// Intenta primero un mensaje libre, que es lo natural cuando él escribió hace poco.
// Fuera de la ventana de 24 h ese camino NO entrega (error 131047: la API contesta 200
// y el mensaje muere después), así que cae a una plantilla aprobada que lleva el texto
// como variable. Si ninguno sale, lo dice — nunca finge que se envió.
import { NextResponse } from 'next/server'
import { diag } from '@/lib/diag'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WA_TOKEN = process.env.WHATSAPP_TOKEN ?? ''
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''
const WA_API = 'https://graph.facebook.com/v21.0'
const TIO_WA = process.env.WA_TIO ?? '5493563413104'
const TPL_LIBRE = 'mensaje_para_tio'

async function postWA(body: unknown): Promise<{ ok: boolean; detalle: string }> {
  const res = await fetch(`${WA_API}/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const txt = await res.text()
  return { ok: res.ok, detalle: txt.slice(0, 300) }
}

export async function POST(req: Request) {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    return NextResponse.json({ error: 'WhatsApp no configurado' }, { status: 503 })
  }

  let texto = ''
  try {
    texto = String(((await req.json()) as { texto?: string }).texto ?? '').trim()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  if (!texto) return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })
  if (texto.length > 900) texto = texto.slice(0, 900)

  // 1) libre (solo entrega dentro de la ventana de 24 h)
  let via = 'libre'
  let r = await postWA({
    messaging_product: 'whatsapp',
    to: TIO_WA,
    type: 'text',
    text: { body: texto },
  })

  // 2) plantilla (entrega siempre, pero con el envoltorio del template)
  if (!r.ok) {
    via = 'plantilla'
    r = await postWA({
      messaging_product: 'whatsapp',
      to: TIO_WA,
      type: 'template',
      template: {
        name: TPL_LIBRE,
        language: { code: 'es_AR' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: texto }] }],
      },
    })
  }

  if (!r.ok) {
    console.error('responder al tío falló:', r.detalle)
    return NextResponse.json(
      { error: 'No se pudo enviar', detalle: r.detalle, ayuda: 'Si la plantilla todavía está en revisión, esperá a que Meta la apruebe.' },
      { status: 502 },
    )
  }

  // Queda en el hilo del panel, junto a lo que contesta el tío.
  await diag('mensaje_a_tio', TIO_WA, { texto, via, ch: 'wa' }).catch(() => {})

  return NextResponse.json({ ok: true, via })
}
