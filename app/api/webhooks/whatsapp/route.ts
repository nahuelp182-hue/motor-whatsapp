import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { KB_MICELIUM } from '@/lib/kb-micelium'
import { notifyNahuel } from '@/lib/notify'
import { diag, getHistorial, logClaudeUsage, type Turno } from '@/lib/diag'
import { prisma } from '@/lib/prisma'

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

// Material por comprador verificado (link, no PDF). Coincide con el bot del VPS.
const MANUAL_INC101 = process.env.MANUAL_INC101 ?? 'https://drive.google.com/drive/folders/1jTrnlfAGvPp1qkw5ZBBTtIdIXB-g2DOv'
const MANUAL_PC400  = process.env.MANUAL_PC400  ?? 'https://www.youtube.com/watch?v=Un_uMpa30so'

// diag con canal 'wa' para separar de Instagram en la vista de conversaciones.
function wdiag(kind: string, sender: string, detail: Record<string, unknown>): Promise<void> {
  return diag(kind, sender, { ...detail, ch: 'wa' })
}

// Si "from" respondió después de un review_request enviado (ventana 14 días) y todavía
// no guardamos su reseña, se guarda el texto tal cual. No interfiere con la respuesta
// normal del bot — el cliente igual recibe una respuesta conversacional.
async function capturarResenaSiCorresponde(from: string, texto: string): Promise<void> {
  try {
    const suf = from.replace(/\D/g, '').slice(-10)
    if (suf.length < 10) return

    const desde = new Date(Date.now() - 14 * 86_400_000)
    const pedidos = await prisma.messageLog.findMany({
      where: { tipo_evento: 'review_request', estado: 'SENT', createdAt: { gte: desde } },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
    })
    const match = pedidos.find((p) => p.customer.telefono.replace(/\D/g, '').endsWith(suf))
    if (!match) return

    const yaTiene = await prisma.review.findFirst({ where: { customer_id: match.customer_id } })
    if (yaTiene) return

    await prisma.review.create({
      data: { store_id: match.store_id, customer_id: match.customer_id, texto: texto.slice(0, 1000) },
    })
  } catch {
    // no romper el flujo del bot si falla la captura de reseña
  }
}

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

// ─────────── Verificación de compra (para mandar manuales) ───────────
type ManualId = 'inc101' | 'pc400'
type Pedido = { encontrado: boolean; manuales: ManualId[]; numero?: number }

const soloDigitos = (s: string): string => (s || '').replace(/\D/g, '')

function manualesDeProductos(prods: Array<{ name?: unknown }>): ManualId[] {
  const set = new Set<ManualId>()
  for (const p of prods) {
    const n = tnName(p.name).toLowerCase()
    if (/inc101|incubadora/.test(n)) set.add('inc101')
    if (/pc400|tableta/.test(n)) set.add('pc400')
  }
  return [...set]
}

// Busca un pedido PAGADO del cliente por teléfono o por un dato numérico del mensaje
// (nº de orden o DNI). Sirve para verificar la compra antes de mandar material.
async function buscarPedido(phone: string, texto: string): Promise<Pedido> {
  if (!TN_TOKEN) return { encontrado: false, manuales: [] }
  const tel8 = soloDigitos(phone).slice(-8)
  const tokens = texto.match(/\d{3,9}/g) ?? [] // posible nº orden (4) o DNI (7-8)
  try {
    for (let page = 1; page <= 6; page++) {
      const url = `${TN_BASE}/${TN_STORE}/orders?payment_status=paid&per_page=50&page=${page}` +
        `&fields=number,contact_phone,contact_identification,products`
      const res = await fetch(url, { headers: { Authentication: `bearer ${TN_TOKEN}`, 'User-Agent': UA } })
      if (!res.ok) break
      const data = (await res.json()) as Array<{
        number: number; contact_phone?: string; contact_identification?: string; products?: Array<{ name?: unknown }>
      }>
      if (!Array.isArray(data) || data.length === 0) break
      for (const o of data) {
        const oPhone8 = soloDigitos(o.contact_phone ?? '').slice(-8)
        const matchTel = tel8.length >= 8 && oPhone8 === tel8
        const matchTok = tokens.some((t) => String(o.number) === t || soloDigitos(o.contact_identification ?? '') === t)
        if (matchTel || matchTok) {
          return { encontrado: true, manuales: manualesDeProductos(o.products ?? []), numero: o.number }
        }
      }
      if (data.length < 50) break
    }
  } catch (e) {
    console.error('buscarPedido error:', e)
  }
  return { encontrado: false, manuales: [] }
}

function linkDeManual(m: ManualId): string {
  return m === 'pc400'
    ? `Tableta PC400 (video de uso): ${MANUAL_PC400}`
    : `Incubadora INC101 (manual + guías): ${MANUAL_INC101}`
}

// ─────────── Preámbulo del asistente (WhatsApp) ───────────
const PREAMBULO = `Sos el ASISTENTE VIRTUAL de atención al cliente de Micelium Argentina (fabricante de incubadoras automáticas para cultivo de hongos). Atendés por WhatsApp. NO uses nombre de persona: te presentás como "el asistente virtual de Micelium". Sos TRANSPARENTE: nunca te hacés pasar por una persona.

CANAL WHATSAPP: si el mensaje parece el PRIMER contacto o un saludo suelto, presentate en UNA línea como "el asistente virtual de Micelium" antes de responder (mini-menú 1/2/3 solo si viene vago/ambiguo). En una charla ya iniciada, no re-saludes ni te re-presentes.

RESPUESTAS BREVES SIEMPRE (la gente lee poco): 1 a 3 líneas salvo tema técnico pedido en detalle. Máximo 1 emoji, natural (🙌👌🍄), evitá 😊 y 🙂. Español argentino, nunca palabras en inglés.

Seguí SIEMPRE la base de conocimiento de abajo (tono, reglas, seguridad, FAQ, menú). Respetá a rajatabla las reglas de seguridad y de derivación. NO inventes: si algo no está respaldado por la KB o por los datos que te doy acá, DERIVÁ (no improvises).

PRECIOS: NUNCA cotizás precios ni armás escaleras de precio (la escalera visual de precios, promos y cuotas se ve mejor en la tienda). No digas números de precio de memoria ni de ningún lado.
- Si piden "info y precios" EN GENERAL (sin decir qué producto) → listá los productos NUMERADOS por NOMBRE (¡SIN precios!) y preguntá cuál le interesa.
- Cuando ELIJAN o pregunten por un producto PUNTUAL (incluido su precio) → NO cotices: mandá el LINK de su ficha (del bloque "CATÁLOGO CON LINKS" de abajo, usá el link EXACTO, no lo inventes) con una línea breve. Ej.: "Mirá toda la info, el precio y las promos acá 👇 <link>". Podés sumar 1-2 datos clave del producto, pero el precio va SIEMPRE por el link.

MANUALES / GUÍAS / MATERIAL (solo para quien YA compró): si el cliente pide el manual, la guía, el instructivo o el material de uso de su equipo, NO derivés: marcá [MANUAL] con el producto (inc101 = incubadora, pc400 = tableta; si no queda claro cuál, poné ?). En [RESPUESTA] poné algo breve y cálido tipo "¡Genial! Te dejo el material 👇" — el SISTEMA verifica la compra y adjunta el link (no escribas vos ningún link de manual). Si es una preventa (todavía no compró) y pide el manual, NO marques [MANUAL]: explicale breve que el material viene con la compra.

ACÁ NO TENÉS HERRAMIENTAS DE ENVÍOS. Por eso DERIVÁ (no lo resuelvas solo, no inventes datos) cuando el cliente pida: estado/seguimiento de su envío, buscar su pedido, roturas/garantía/fallas, plata/reintegros/reembolsos, reclamos que escalan, temas legales/salud/consumo de sustancias, psilocibe/"mágicos"/Golden Teacher, o mayoristas/prensa.
Cuando DERIVES: en la RESPUESTA invitá al cliente, breve y cálido, a SEGUIR POR WHATSAPP con el equipo (ahí lo atienden mejor). NO escribas vos el número ni el link de WhatsApp: el sistema agrega el link automáticamente al final de tu respuesta. Ej. de cierre: "Para esto te ayudamos mejor con el equipo 👇". Y marcá DERIVAR.

FORMATO DE SALIDA OBLIGATORIO (respetá estas etiquetas EXACTAS, en este orden):
[RESPUESTA]
<el texto tal cual se le envía al cliente>
[DERIVAR] si|no
[MOTIVO] <motivo corto si derivás; si no derivás poné "no" en DERIVAR y dejá MOTIVO vacío>
[MANUAL] <inc101|pc400|? — SOLO si el cliente pide el manual de su compra; si no aplica, omití esta línea>

=== BASE DE CONOCIMIENTO ===
${KB_MICELIUM}
=== FIN ===`

// ─────────── Parseo de salida del cerebro ───────────
type Salida = { respuesta: string; derivar: boolean; motivo: string; manual: ManualId | '?' | null }

function parseSalida(raw: string): Salida {
  const mResp = raw.match(/\[RESPUESTA\]\s*([\s\S]*?)\s*(?:\[DERIVAR\]|\[MANUAL\]|$)/i)
  const mDer  = raw.match(/\[DERIVAR\]\s*(si|sí|no)/i)
  const mMot  = raw.match(/\[MOTIVO\]\s*([\s\S]*?)\s*(?:\[MANUAL\]|$)/i)
  const mMan  = raw.match(/\[MANUAL\]\s*(inc101|pc400|\?)/i)
  const respuesta = (mResp ? mResp[1] : raw).trim()
  const derivar = mDer ? /s[ií]/i.test(mDer[1]) : false
  const motivo = mMot ? mMot[1].trim() : ''
  const manual = mMan ? (mMan[1].toLowerCase() as ManualId | '?') : null
  return { respuesta, derivar, motivo, manual }
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
    await wdiag('wa_send_fail', to, { status: res.status, body: bodyText.slice(0, 1500), texto: texto.slice(0, 200) })
  } else {
    await wdiag('wa_send_ok', to, { status: res.status })
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
    await wdiag('wa_send_fail', to, { status: res.status, body: bodyText.slice(0, 1500), texto: '[cta_url]' })
  } else {
    await wdiag('wa_send_ok', to, { status: res.status, kind: 'cta_url' })
  }
  return res.ok
}

// Deriva al equipo: botón limpio con fallback a link en texto.
async function derivarAlEquipo(to: string, cuerpo: string): Promise<void> {
  const okBtn = await enviarBotonWA(to, cuerpo, WA_BTN_TEXT, WA_LINK)
  if (!okBtn) await enviarMensajeWA(to, `${cuerpo}\n\n${WA_LINK}`)
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

        const nombre = value.contacts?.find((c) => c.wa_id === from)?.profile?.name
          ?? value.contacts?.[0]?.profile?.name

        try {
          // 'recibido'/'pensado' son los kinds que getHistorial() consulta para reconstruir el hilo
          await wdiag('recibido', from, { texto: texto.slice(0, 300), wamid: msg.id, nombre })
          await capturarResenaSiCorresponde(from, texto)

          const [catalogo, historial] = await Promise.all([bloqueCatalogo(), getHistorial(from)])
          const { respuesta, derivar, motivo, manual } = await pensar(texto, catalogo, historial)

          // Estado final que se envía + se loguea (un solo 'pensado' por mensaje).
          let outText = respuesta
          let didDerivar = derivar
          let accion: string | undefined

          if (manual) {
            // Comprador pidió material → verificar compra por teléfono o dato numérico.
            const pedido = await buscarPedido(from, texto)
            if (pedido.encontrado) {
              const targets: ManualId[] =
                manual === 'inc101' || manual === 'pc400'
                  ? [manual]
                  : pedido.manuales.length ? pedido.manuales : ['inc101']
              const links = targets.map(linkDeManual).join('\n')
              outText = `${respuesta ? respuesta + '\n\n' : '📚 Acá tenés tu material 👇\n\n'}${links}\n\nCualquier duda del cultivo, escribime 🍄`
              didDerivar = false
              accion = 'manual_enviado'
              await enviarMensajeWA(from, outText)
            } else if (/\d{3,9}/.test(texto)) {
              // Dio un dato pero no matcheó ninguna compra → lo pasa al equipo.
              outText = 'No pude encontrar tu compra con ese dato 😕 Te paso con el equipo para que te ayude 👇'
              didDerivar = true
              accion = 'manual_no_verificado'
              await derivarAlEquipo(from, outText)
            } else {
              // Todavía no dio con qué verificar → se lo pedimos (sin derivar aún).
              outText = 'Con gusto te mando el material 🙌 Para confirmar tu compra, pasame tu número de orden (está en el mail de compra) o el DNI con el que compraste.'
              didDerivar = false
              accion = 'manual_pide_orden'
              await enviarMensajeWA(from, outText)
            }
          } else if (derivar) {
            outText = respuesta || 'Te paso con una persona del equipo 👇'
            await derivarAlEquipo(from, outText)
          } else if (respuesta) {
            await enviarMensajeWA(from, respuesta)
          }

          await wdiag('pensado', from, {
            derivar: didDerivar, motivo, accion, respuesta: outText.slice(0, 300),
          })

          if (didDerivar) {
            await notifyNahuel(
              '🔔 WhatsApp: lead derivado al equipo',
              `Un mensaje de WhatsApp fue derivado al equipo.\n\n` +
              `Número: ${from}\n` +
              (nombre ? `Nombre: ${nombre}\n` : '') +
              `Mensaje: "${texto}"\n` +
              `Motivo: ${accion === 'manual_no_verificado' ? 'comprador no verificado (pidió manual)' : (motivo || '(sin especificar)')}\n\n` +
              `Se le pasó el link a wa.me/${EMPRESA_WA}. Si no escribe, contactalo desde WhatsApp.`,
            )
          }
        } catch (err) {
          console.error('WA webhook error:', err)
          await wdiag('wa_error', from, { error: String(err).slice(0, 1000) })
          try {
            await enviarMensajeWA(from, '¡Hola! 👋 Gracias por escribirnos, en un ratito te respondemos 🍄')
          } catch {}
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}
