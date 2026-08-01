// Responder a un cliente por WhatsApp DESDE el panel, con el número oficial de la marca.
//
// Por qué existe: hasta ahora el panel era de solo lectura y ofrecía un link `wa.me/` para
// contestar desde el celular. Eso significaba que el cliente hablaba con Micelium en un
// número (el del bot, 351 214-5521) y le respondía una persona desde OTRO (el personal).
// Dos números para la misma conversación es exactamente la señal que dispara la
// desconfianza que ya está medida en la base de clientes.
//
// Límite de la plataforma que hay que respetar: WhatsApp Cloud API solo deja mandar texto
// libre dentro de las 24 h desde el último mensaje DEL CLIENTE. Fuera de esa ventana hace
// falta una plantilla aprobada. Por eso acá se chequea la ventana ANTES de intentar el
// envío: si ya venció, se dice con todas las letras en vez de fallar con un error de Meta
// que no se entiende.
//
// Autenticación: la da el middleware. Todo lo que no está en PUBLICOS exige la cookie de
// sesión del dashboard, así que esta ruta ya llega protegida (mismo criterio que el resto
// de /api/conversaciones).
import { NextRequest, NextResponse } from 'next/server'
import { diag, getPool } from '@/lib/diag'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WA_TOKEN = process.env.WHATSAPP_TOKEN ?? ''
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''
const WA_API_URL = 'https://graph.facebook.com/v21.0'

/** Horas desde el último mensaje entrante de ese número, o null si no hay ninguno. */
async function horasDesdeUltimoEntrante(sender: string): Promise<number | null> {
  const p = getPool()
  if (!p) return null
  const r = await p.query(
    `SELECT ts FROM ig_diag
      WHERE sender = $1 AND kind = 'recibido' AND canal = 'wa'
      ORDER BY id DESC LIMIT 1`,
    [sender],
  )
  if (!r.rows.length) return null
  return (Date.now() - new Date(r.rows[0].ts as string).getTime()) / 3_600_000
}

export async function POST(req: NextRequest) {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    return NextResponse.json({ ok: false, error: 'WhatsApp sin configurar' }, { status: 503 })
  }

  const body = (await req.json().catch(() => ({}))) as { sender?: string; texto?: string }
  const sender = String(body.sender ?? '').replace(/\D/g, '')
  const texto = String(body.texto ?? '').trim()

  if (!sender || !texto) {
    return NextResponse.json({ ok: false, error: 'falta el número o el texto' }, { status: 400 })
  }
  if (texto.length > 4000) {
    return NextResponse.json({ ok: false, error: 'el mensaje es demasiado largo' }, { status: 400 })
  }

  const horas = await horasDesdeUltimoEntrante(sender)
  if (horas === null) {
    return NextResponse.json(
      { ok: false, error: 'Esta persona nunca escribió a este número, así que no se le puede iniciar una charla desde acá.' },
      { status: 409 },
    )
  }
  if (horas >= 24) {
    return NextResponse.json(
      {
        ok: false,
        error: `Pasaron ${Math.floor(horas)} h desde su último mensaje. WhatsApp solo permite responder texto libre dentro de las 24 h; para reabrir hace falta una plantilla aprobada.`,
      },
      { status: 409 },
    )
  }

  const res = await fetch(`${WA_API_URL}/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: sender,
      type: 'text',
      text: { preview_url: false, body: texto },
    }),
  })
  const detalle = await res.text().catch(() => '')

  if (!res.ok) {
    await diag('wa_send_fail', sender, { origen: 'panel', status: res.status, body: detalle.slice(0, 1000) }, 'wa')
    return NextResponse.json({ ok: false, error: `WhatsApp rechazó el envío (${res.status})` }, { status: 502 })
  }

  // Se registra como 'pensado' con accion 'humano' para que el hilo del panel lo muestre en
  // orden junto con lo que dijo el bot, y para que quede claro quién escribió cada cosa.
  await diag('pensado', sender, { respuesta: texto, accion: 'humano', derivar: false }, 'wa')
  return NextResponse.json({ ok: true })
}
