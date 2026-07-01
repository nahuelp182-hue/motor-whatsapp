import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { KB_MICELIUM } from '@/lib/kb-micelium'
import { notifyNahuel } from '@/lib/notify'

export const runtime = 'nodejs'

const IG_ID      = process.env.IG_ACCOUNT_ID ?? '17841475593696785'
const PAGE_TOKEN = process.env.FB_PAGE_TOKEN  ?? ''
const PAGE_ID    = process.env.FB_PAGE_ID     ?? '239953909199103'

const TN_STORE = process.env.TN_STORE_ID    ?? '1957278'
const TN_TOKEN = process.env.TN_ACCESS_TOKEN ?? ''
const TN_BASE  = 'https://api.tiendanube.com/v1'
const UA       = 'Micelium/1.0 (nahuelp182@gmail.com)'
const TRANSFER_DISCOUNT = 0.13

// WhatsApp de la empresa (a donde se deriva a los clientes de Instagram). Configurable por env.
const EMPRESA_WA = process.env.WA_EMPRESA ?? '5493525623546'
const WA_LINK = `https://wa.me/${EMPRESA_WA}?text=${encodeURIComponent('Hola! Escribo desde Instagram 🍄')}`

// Respuestas a postbacks (botones del menú / ice breakers) — se mantienen
const POSTBACK_RESPONSES: Record<string, string> = {
  GET_STARTED:  '👋 ¡Hola! Soy el asistente virtual de Micelium 🍄\n\nTe ayudo con:\n1️⃣ Info y precios\n2️⃣ Seguimiento de tu envío\n3️⃣ Dudas de uso o cultivo\n\nDecime qué necesitás (o el número). Si preferís, te paso con una persona 🙌',
  PRECIO:       'Contame qué producto te interesa y te paso el precio y las formas de pago 🙌',
  ENVIOS:       '🚚 Enviamos a todo el país. El plazo depende de tu zona (AMBA 1-2 días hábiles, interior 3-5). El costo se calcula al finalizar la compra en infomicelium.com.ar',
  GARANTIA:     '🛡️ Todos nuestros equipos tienen 1 año de garantía + soporte. ¿Alguna otra duda?',
  COMO_FUNCIONA:'La incubadora controla temperatura, humedad y ventilación de forma automática 🍄 Vos ponés el sustrato y la máquina hace el resto. ¿Querés que te cuente más?',
  HUMANO:       `👤 Dale, seguí con el equipo por WhatsApp así te ayudamos mejor 👇\n${WA_LINK}`,
}

// ─────────── Preámbulo del asistente (adaptado a Instagram, sin herramientas de pedidos) ───────────
const PREAMBULO = `Sos el ASISTENTE VIRTUAL de atención al cliente de Micelium Argentina (fabricante de incubadoras automáticas para cultivo de hongos). Atendés por Instagram (mensajes directos). NO uses nombre de persona: te presentás como "el asistente virtual de Micelium". Sos TRANSPARENTE: nunca te hacés pasar por una persona.

CANAL INSTAGRAM DM: si el mensaje parece el PRIMER contacto o un saludo suelto, presentate en UNA línea como "el asistente virtual de Micelium" antes de responder (mini-menú 1/2/3 solo si viene vago/ambiguo). En una charla ya iniciada, no re-saludes ni te re-presentes.

RESPUESTAS BREVES SIEMPRE (la gente lee poco): 1 a 3 líneas salvo tema técnico pedido en detalle. Máximo 1 emoji, natural (🙌👌🍄), evitá 😊 y 🙂. Español argentino, nunca palabras en inglés.

Seguí SIEMPRE la base de conocimiento de abajo (tono, reglas, seguridad, FAQ, menú). Respetá a rajatabla las reglas de seguridad y de derivación. NO inventes: si algo no está respaldado por la KB o por los datos que te doy acá, DERIVÁ (no improvises).

PRECIOS: usá SOLO el bloque "PRECIOS EN VIVO" de más abajo, nunca precios de memoria.
- Si piden "info y precio" EN GENERAL (sin decir qué producto) → listá los productos NUMERADOS por NOMBRE (¡SIN precios!) y preguntá cuál le interesa.
- Cuando ELIJAN o pregunten por un producto PUNTUAL → recién ahí el precio, y SIEMPRE en ESCALERA para que la promo se lea como rebaja: lista (el más alto, "antes") → promo ("6 cuotas sin interés con tarjeta") → transferencia (el más bajo). Formato AR: $246.209,13.

ACÁ NO TENÉS HERRAMIENTAS DE PEDIDOS NI DE ENVÍOS. Por eso DERIVÁ (no lo resuelvas solo, no inventes datos) cuando el cliente pida: estado/seguimiento de su envío, buscar su pedido, manuales/guías (son solo para compradores verificados y acá no podés verificar la compra), roturas/garantía/fallas, plata/reintegros/reembolsos, reclamos que escalan, temas legales/salud/consumo de sustancias, psilocibe/"mágicos"/Golden Teacher, o mayoristas/prensa.
Cuando DERIVES: en la RESPUESTA invitá al cliente, breve y cálido, a SEGUIR POR WHATSAPP con el equipo (ahí lo atienden mejor). NO escribas vos el número ni el link de WhatsApp: el sistema agrega el link automáticamente al final de tu respuesta. Ej. de cierre: "Para esto te ayudamos mejor por WhatsApp 👇". Y marcá DERIVAR.

FORMATO DE SALIDA OBLIGATORIO (respetá estas etiquetas EXACTAS, en este orden):
[RESPUESTA]
<el texto tal cual se le envía al cliente>
[DERIVAR] si
[MOTIVO] <motivo corto si derivás; si no derivás poné "no" en DERIVAR y dejá MOTIVO vacío>

=== BASE DE CONOCIMIENTO ===
${KB_MICELIUM}
=== FIN ===`

// ─────────── Precios en vivo desde Tiendanube ───────────
function tnName(name: unknown): string {
  if (typeof name === 'string') return name
  if (name && typeof name === 'object') {
    const o = name as Record<string, string>
    return o.es || o.pt || o.en || Object.values(o)[0] || ''
  }
  return ''
}

function fmtAR(n: number): string {
  return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

async function bloquePreciosEnVivo(): Promise<string> {
  if (!TN_TOKEN) {
    return '=== PRECIOS EN VIVO ===\n(No disponible ahora.) Si preguntan precio, pedí disculpas y ofrecé pasar con una persona o remitir a infomicelium.com.ar.'
  }
  try {
    const res = await fetch(`${TN_BASE}/${TN_STORE}/products?per_page=15&published=true`, {
      headers: { Authentication: `bearer ${TN_TOKEN}`, 'User-Agent': UA, 'Content-Type': 'application/json' },
    })
    if (!res.ok) throw new Error(`TN ${res.status}`)
    const prods = (await res.json()) as Array<Record<string, unknown>>
    const lines: string[] = []
    let i = 1
    for (const p of prods) {
      const variants = (p.variants as Array<Record<string, unknown>>) ?? [{}]
      const v = variants[0] ?? {}
      const lista = Number(p.price ?? v.price ?? 0)
      const promoRaw = (p.promotional_price ?? v.promotional_price) as string | number | null
      const promo = promoRaw ? Number(promoRaw) : null
      const vigente = promo ?? lista
      const transfer = Math.round(vigente * (1 - TRANSFER_DISCOUNT) * 100) / 100
      const nombre = tnName(p.name)
      if (!nombre || !lista) continue
      lines.push(`${i}. ${nombre} | lista ${fmtAR(lista)} | promo ${promo ? fmtAR(promo) + ' (6 cuotas sin interés)' : '—'} | transferencia ${fmtAR(transfer)}`)
      i++
    }
    if (!lines.length) throw new Error('sin productos')
    return `=== PRECIOS EN VIVO (Tiendanube) ===\n${lines.join('\n')}\n\nRecordá: lista general SIN precios (solo nombres numerados); precio en escalera SOLO cuando elijan un producto.`
  } catch {
    return '=== PRECIOS EN VIVO ===\n(No pude traer precios ahora.) Si preguntan precio, ofrecé pasar con una persona o remitir a infomicelium.com.ar.'
  }
}

// ─────────── Cerebro ───────────
type Salida = { respuesta: string; derivar: boolean; motivo: string }

function parseSalida(raw: string): Salida {
  const mResp = raw.match(/\[RESPUESTA\]\s*([\s\S]*?)\s*(?:\[DERIVAR\]|$)/i)
  const mDer  = raw.match(/\[DERIVAR\]\s*(si|sí|no)/i)
  const mMot  = raw.match(/\[MOTIVO\]\s*([\s\S]*?)\s*$/i)
  const respuesta = (mResp ? mResp[1] : raw).trim()
  const derivar = mDer ? /s[ií]/i.test(mDer[1]) : false
  const motivo = mMot ? mMot[1].trim() : ''
  return { respuesta, derivar, motivo }
}

async function pensar(mensaje: string, precios: string): Promise<Salida> {
  const client = new Anthropic()
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    system: [
      { type: 'text', text: PREAMBULO, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: precios },
    ],
    messages: [{ role: 'user', content: `Mensaje del cliente por Instagram: "${mensaje}"\n\nRespondé usando el formato de etiquetas.` }],
  })
  const block = response.content[0]
  const raw = block && block.type === 'text' ? block.text : ''
  return parseSalida(raw)
}

// ─────────── IG send ───────────
async function enviarMensajeIG(recipientId: string, texto: string) {
  await fetch(`https://graph.facebook.com/v21.0/${IG_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAGE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text: texto }, messaging_type: 'RESPONSE' }),
  })
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
        postback?: { payload?: string }
        timestamp?: number
      }>
    }>
  }

  try { body = await req.json() } catch { return NextResponse.json({ ok: true }) }
  if (body.object !== 'instagram' && body.object !== 'page') return NextResponse.json({ ok: true })

  for (const entry of body.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      if (event.message?.is_echo) continue
      const senderId = event.sender.id
      if (senderId === IG_ID || senderId === PAGE_ID) continue

      try {
        // Postback (botón del menú o ice breaker)
        const payload = event.postback?.payload
        if (payload) {
          const respuesta = POSTBACK_RESPONSES[payload]
          if (respuesta) await enviarMensajeIG(senderId, respuesta)
          continue
        }

        const texto = event.message?.text?.trim()
        if (!texto) continue

        // Cerebro de Ariel: precios en vivo + KB + derivación
        const precios = await bloquePreciosEnVivo()
        const { respuesta, derivar, motivo } = await pensar(texto, precios)

        // Al derivar, mandamos al cliente a WhatsApp de la empresa (link agregado por código, no por la IA)
        let salidaCliente = respuesta
        if (derivar) salidaCliente += (respuesta ? '\n\n' : '') + `👉 ${WA_LINK}`
        if (salidaCliente) await enviarMensajeIG(senderId, salidaCliente)

        if (derivar) {
          await notifyNahuel(
            '🔔 Instagram: lead derivado a WhatsApp',
            `Un DM de Instagram fue derivado a WhatsApp de la empresa.\n\n` +
            `Usuario IG (id): ${senderId}\n` +
            `Mensaje: "${texto}"\n` +
            `Motivo: ${motivo || '(sin especificar)'}\n\n` +
            `Se le pasó el link a wa.me/${EMPRESA_WA}. Si no escribe, podés contactarlo desde la app de Instagram.`,
          )
        }
      } catch (err) {
        console.error('IG webhook error:', err)
        // fallback humano para no dejar al cliente en visto
        try { await enviarMensajeIG(event.sender.id, '¡Hola! 👋 Gracias por escribirnos, en un ratito te respondemos 🍄') } catch {}
      }
    }
  }

  return NextResponse.json({ ok: true })
}
