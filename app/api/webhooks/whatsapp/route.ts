import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { KB_MICELIUM } from '@/lib/kb-micelium'
import { notifyNahuel } from '@/lib/notify'
import { diag, getHistorial, logClaudeUsage, type Turno } from '@/lib/diag'

const MODELO = 'claude-haiku-4-5-20251001'

export const runtime = 'nodejs'
export const maxDuration = 60

const WA_TOKEN    = process.env.WHATSAPP_TOKEN           ?? ''
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN   ?? 'micelium_wa_webhook_2026'
const WA_API_URL   = 'https://graph.facebook.com/v21.0'

const TN_STORE = process.env.TN_STORE_ID    ?? '1957278'
const TN_TOKEN = process.env.TN_ACCESS_TOKEN ?? ''
const TN_BASE  = 'https://api.tiendanube.com/v1'
const UA       = 'Micelium/1.0 (nahuelp182@gmail.com)'

// Número empresa al que se deriva al cliente (NO el número dedicado a la Cloud API)
const EMPRESA_WA = process.env.WA_EMPRESA ?? '5493525623546'
// Texto que le llega a la empresa cuando el cliente toca el botón (para identificarlo en métricas)
const WA_LINK = `https://wa.me/${EMPRESA_WA}?text=${encodeURIComponent('Hola, vengo del asistente virtual')}`
const WA_BTN_TEXT = 'Chatear con equipo' // ≤20 chars (límite de botón cta_url)

// Tienda (para armar links de ficha de producto)
const TIENDA_BASE = 'https://infomicelium.com.ar/productos'

// ─────────── Precios en vivo desde Tiendanube ───────────
function tnName(name: unknown): string {
  if (typeof name === 'string') return name
  if (name && typeof name === 'object') {
    const o = name as Record<string, string>
    return o.es || o.pt || o.en || Object.values(o)[0] || ''
  }
  return ''
}

// Catálogo en vivo desde Tiendanube: nombre + link a la ficha (SIN precios).
// La escalera de precios/promos/cuotas se ve en la tienda, no la cotiza el bot.
async function bloqueCatalogo(): Promise<string> {
  const guia =
    'Cuando el cliente quiera precio/info de un producto, NO cotices números: mandá el LINK de su ficha (ahí ve precio, promos y cuotas). Usá EXACTAMENTE estos links, no los inventes.'
  if (!TN_TOKEN) {
    return `=== CATÁLOGO CON LINKS ===\n(No disponible ahora.) Si preguntan por un producto, remití a la tienda: https://infomicelium.com.ar`
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
      const nombre = tnName(p.name)
      const handle = tnName(p.handle)
      if (!nombre || !handle) continue
      lines.push(`${i}. ${nombre} → ${TIENDA_BASE}/${handle}/`)
      i++
    }
    return `=== CATÁLOGO CON LINKS (Tiendanube, en vivo) ===\n${guia}\n${lines.join('\n')}`
  } catch (e) {
    console.error('TN catálogo error:', e)
    return `=== CATÁLOGO CON LINKS ===\n(Error al cargar.) Remití a la tienda: https://infomicelium.com.ar`
  }
}

// ─────────── Preámbulo del asistente (WhatsApp) ───────────
const PREAMBULO = `Sos el ASISTENTE VIRTUAL de atención al cliente de Micelium Argentina (fabricante de incubadoras automáticas para cultivo de hongos). Atendés por WhatsApp. NO uses nombre de persona: te presentás como "el asistente virtual de Micelium". Sos TRANSPARENTE: nunca te hacés pasar por una persona.

CANAL WHATSAPP: si el mensaje parece el PRIMER contacto o un saludo suelto, presentate en UNA línea como "el asistente virtual de Micelium" antes de responder (mini-menú 1/2/3 solo si viene vago/ambiguo). En una charla ya iniciada, no re-saludes ni te re-presentes.

RESPUESTAS BREVES SIEMPRE (la gente lee poco): 1 a 3 líneas salvo tema técnico pedido en detalle. Máximo 1 emoji, natural (🙌👌🍄), evitá 😊 y 🙂. Español argentino, nunca palabras en inglés.

Seguí SIEMPRE la base de conocimiento de abajo (tono, reglas, seguridad, FAQ, menú). Respetá a rajatabla las reglas de seguridad y de derivación. NO inventes: si algo no está respaldado por la KB o por los datos que te doy acá, DERIVÁ (no improvises).

PRECIOS: NUNCA cotizás precios ni armás escaleras de precio (la escalera visual de precios, promos y cuotas se ve mejor en la tienda). No digas números de precio de memoria ni de ningún lado.
- Si piden "info y precios" EN GENERAL (sin decir qué producto) → listá los productos NUMERADOS por NOMBRE (¡SIN precios!) y preguntá cuál le interesa.
- Cuando ELIJAN o pregunten por un producto PUNTUAL (incluido su precio) → NO cotices: mandá el LINK de su ficha (del bloque "CATÁLOGO CON LINKS" de abajo, usá el link EXACTO, no lo inventes) con una línea breve. Ej.: "Mirá toda la info, el precio y las promos acá 👇 <link>". Podés sumar 1-2 datos clave del producto, pero el precio va SIEMPRE por el link.

ACÁ NO TENÉS HERRAMIENTAS DE PEDIDOS NI DE ENVÍOS. Por eso DERIVÁ (no lo resuelvas solo, no inventes datos) cuando el cliente pida: estado/seguimiento de su envío, buscar su pedido, manuales/guías (son solo para compradores verificados y acá no podés verificar la compra), roturas/garantía/fallas, plata/reintegros/reembolsos, reclamos que escalan, temas legales/salud/consumo de sustancias, psilocibe/"mágicos"/Golden Teacher, o mayoristas/prensa.
Cuando DERIVES: en la RESPUESTA invitá al cliente, breve y cálido, a SEGUIR POR WHATSAPP con el equipo (ahí lo atienden mejor). NO escribas vos el número ni el link de WhatsApp: el sistema agrega el link automáticamente al final de tu respuesta. Ej. de cierre: "Para esto te ayudamos mejor con el equipo 👇". Y marcá DERIVAR.

FORMATO DE SALIDA OBLIGATORIO (respetá estas etiquetas EXACTAS, en este orden):
[RESPUESTA]
<el texto tal cual se le envía al cliente>
[DERIVAR] si
[MOTIVO] <motivo corto si derivás; si no derivás poné "no" en DERIVAR y dejá MOTIVO vacío>

=== BASE DE CONOCIMIENTO ===
${KB_MICELIUM}
=== FIN ===`

// ─────────── Parseo de salida del cerebro ───────────
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

// ─────────── Cerebro de Ariel ───────────
async function pensar(mensaje: string, catalogo: string, historial: Turno[]): Promise<Salida> {
  const client = new Anthropic()
  const messages = [
    ...historial.map((t) => ({ role: t.role, content: t.content })),
    { role: 'user' as const, content: `Mensaje del cliente por WhatsApp: "${mensaje}"\n\nRespondé usando el formato de etiquetas.` },
  ]
  const response = await client.messages.create({
    model: MODELO,
    max_tokens: 500,
    system: [
      { type: 'text', text: PREAMBULO, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: catalogo },
    ],
    messages,
  })
  await logClaudeUsage('whatsapp', MODELO, response.usage)
  const block = response.content[0]
  const raw = block && block.type === 'text' ? block.text : ''
  return parseSalida(raw)
}

// ─────────── WA Cloud API send ───────────
async function enviarMensajeWA(to: string, texto: string): Promise<boolean> {
  const res = await fetch(`${WA_API_URL}/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: texto },
    }),
  })
  const bodyText = await res.text().catch(() => '')
  if (!res.ok) {
    console.error(`WA send FALLO ${res.status}:`, bodyText)
    await diag('wa_send_fail', to, { status: res.status, body: bodyText.slice(0, 1500), texto: texto.slice(0, 200) })
  } else {
    await diag('wa_send_ok', to, { status: res.status })
  }
  return res.ok
}

// Mensaje interactivo con botón (cta_url): muestra un botón limpio en vez de una URL larga.
async function enviarBotonWA(to: string, cuerpo: string, displayText: string, url: string): Promise<boolean> {
  const res = await fetch(`${WA_API_URL}/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'cta_url',
        body: { text: cuerpo },
        action: { name: 'cta_url', parameters: { display_text: displayText, url } },
      },
    }),
  })
  const bodyText = await res.text().catch(() => '')
  if (!res.ok) {
    console.error(`WA botón FALLO ${res.status}:`, bodyText)
    await diag('wa_send_fail', to, { status: res.status, body: bodyText.slice(0, 1500), texto: '[cta_url]' })
  } else {
    await diag('wa_send_ok', to, { status: res.status, kind: 'cta_url' })
  }
  return res.ok
}

// GET — verificación del webhook por Meta
export async function GET(req: NextRequest) {
  const mode      = req.nextUrl.searchParams.get('hub.mode')
  const token     = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// POST — mensajes entrantes de WhatsApp Cloud API
export async function POST(req: NextRequest) {
  let body: {
    object?: string
    entry?: Array<{
      id?: string
      changes?: Array<{
        field?: string
        value?: {
          messaging_product?: string
          metadata?: { display_phone_number?: string; phone_number_id?: string }
          contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>
          messages?: Array<{
            from?: string
            id?: string
            timestamp?: string
            type?: string
            text?: { body?: string }
          }>
          statuses?: Array<unknown>
        }
      }>
    }>
  }

  try { body = await req.json() } catch { return NextResponse.json({ ok: true }) }
  if (body.object !== 'whatsapp_business_account') return NextResponse.json({ ok: true })

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue
      const value = change.value
      if (!value) continue

      for (const msg of value.messages ?? []) {
        // Solo texto por ahora; ignorar statuses, audio, imagen, etc.
        if (msg.type !== 'text') continue
        const texto = msg.text?.body?.trim()
        if (!texto) continue

        const from = msg.from ?? ''
        if (!from) continue

        try {
          // 'recibido'/'pensado' son los kinds que getHistorial() consulta para reconstruir el hilo
          await diag('recibido', from, { texto: texto.slice(0, 300), wamid: msg.id })

          const [catalogo, historial] = await Promise.all([bloqueCatalogo(), getHistorial(from)])
          const { respuesta, derivar, motivo } = await pensar(texto, catalogo, historial)
          await diag('pensado', from, { derivar, motivo, respuesta: respuesta.slice(0, 300) })

          if (derivar) {
            // Botón limpio "Chatear con equipo" (cta_url) en vez de una URL larga.
            const cuerpo = respuesta || 'Te paso con una persona del equipo 👇'
            const okBtn = await enviarBotonWA(from, cuerpo, WA_BTN_TEXT, WA_LINK)
            if (!okBtn) await enviarMensajeWA(from, `${cuerpo}\n\n${WA_LINK}`)
          } else if (respuesta) {
            await enviarMensajeWA(from, respuesta)
          }

          if (derivar) {
            await notifyNahuel(
              '🔔 WhatsApp: lead derivado al equipo',
              `Un mensaje de WhatsApp fue derivado al equipo.\n\n` +
              `Número: ${from}\n` +
              `Mensaje: "${texto}"\n` +
              `Motivo: ${motivo || '(sin especificar)'}\n\n` +
              `Se le pasó el link a wa.me/${EMPRESA_WA}. Si no escribe, contactalo desde WhatsApp.`,
            )
          }
        } catch (err) {
          console.error('WA webhook error:', err)
          await diag('wa_error', from, { error: String(err).slice(0, 1000) })
          try {
            await enviarMensajeWA(from, '¡Hola! 👋 Gracias por escribirnos, en un ratito te respondemos 🍄')
          } catch {}
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}
