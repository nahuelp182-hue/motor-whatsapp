import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { KB_MICELIUM } from '@/lib/kb-micelium'
import { notifyNahuel } from '@/lib/notify'
import { diag, getHistorial, logClaudeUsage, comentarioYaRespondido, type Turno, type Canal } from '@/lib/diag'
import { verificarFirmaMeta } from '@/lib/meta-signature'
import { DESCUENTO_TRANSFERENCIA } from '@/lib/tienda'

const MODELO = 'claude-haiku-4-5-20251001'

export const runtime = 'nodejs'
export const maxDuration = 60

const IG_ID      = process.env.IG_ACCOUNT_ID ?? '17841475593696785'
const PAGE_TOKEN = process.env.FB_PAGE_TOKEN  ?? ''
const PAGE_ID    = process.env.FB_PAGE_ID     ?? '239953909199103'

const TN_STORE = process.env.TN_STORE_ID    ?? '1957278'
const TN_TOKEN = process.env.TN_ACCESS_TOKEN ?? ''
const TN_BASE  = 'https://api.tiendanube.com/v1'
const UA       = 'Micelium/1.0 (nahuelp182@gmail.com)'
// Importado de lib/tienda para que el bot y el portal digan SIEMPRE el mismo precio.
const TRANSFER_DISCOUNT = DESCUENTO_TRANSFERENCIA

// WhatsApp público de la marca: el mismo que muestran el portal, las guías, la tienda y el
// pie de los mails. Hasta el 25/07/2026 acá se derivaba al número humano (5493525623546),
// así que Micelium mostraba DOS números distintos según por dónde llegara la persona —
// justo la señal que dispara la desconfianza que ya está medida.
//
// Derivar al número del bot no deja a nadie sin atención: ese bot resuelve seguimiento de
// envío y estado de pedido (que es la mitad de lo que se deriva desde Instagram) y, cuando
// no puede, escala a una persona con su propia lógica. La escalada vive en un solo lugar.
const EMPRESA_WA = process.env.WA_EMPRESA ?? '5493512145521'
const WA_LINK = `https://wa.me/${EMPRESA_WA}?text=${encodeURIComponent('Hola! Escribo desde Instagram 🍄')}`
// IG bloquea los links wa.me en DMs → al cliente se le da el WhatsApp en TEXTO PLANO.
// Si cambia EMPRESA_WA, actualizar este display. (WA_LINK se sigue usando en el aviso interno a Nahuel.)
const WA_PLAIN = 'Escribinos por WhatsApp al +54 9 351 214-5521 🍄'

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

async function pensar(mensaje: string, precios: string, historial: Turno[]): Promise<Salida> {
  const client = new Anthropic()
  const messages = [
    ...historial.map((t) => ({ role: t.role, content: t.content })),
    { role: 'user' as const, content: `Mensaje del cliente por Instagram: "${mensaje}"\n\nRespondé usando el formato de etiquetas.` },
  ]
  const response = await client.messages.create({
    model: MODELO,
    max_tokens: 500,
    system: [
      { type: 'text', text: PREAMBULO, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: precios },
    ],
    messages,
  })
  await logClaudeUsage('instagram', MODELO, response.usage)
  const block = response.content[0]
  const raw = block && block.type === 'text' ? block.text : ''
  return parseSalida(raw)
}

// Instagram RECHAZA los DMs con enlaces (error 508/2534122 "Link can't be shared") en conexiones
// de mensajería nuevas. La KB comparte links (producto, wa.me, correos) que en WhatsApp SÍ sirven,
// así que acá los neutralizamos SOLO para el envío por IG. Si no, el mensaje entero no se entrega
// y el cliente cree que el bot dejó de responder.
function sanitizeIGText(t: string): string {
  if (!t) return t
  // markdown [texto](url) -> texto
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  // tienda propia (con o sin http) -> CTA plano
  t = t.replace(/(https?:\/\/)?(www\.)?infomicelium\.com\.ar\S*/gi, 'el link de nuestra bio 🛒')
  // seguimiento de correos -> texto plano
  t = t.replace(/(https?:\/\/)?(www\.)?andreani\.com\S*/gi, 'la web de Andreani')
  t = t.replace(/(https?:\/\/)?(www\.)?correoargentino\.com\.ar\S*/gi, 'la web de Correo Argentino')
  // wa.me -> mención plana
  t = t.replace(/(https?:\/\/)?wa\.me\/\S+/gi, 'nuestro WhatsApp')
  // cualquier URL restante -> fuera
  t = t.replace(/https?:\/\/\S+/gi, '')
  // limpiar espacios dobles y espacios antes de puntuación
  t = t.replace(/[ \t]{2,}/g, ' ').replace(/ +([.,!?])/g, '$1').trim()
  return t
}

// ─────────── IG send ───────────
/**
 * Manda un DM. Sirve para Instagram y para Messenger: la Send API es la misma y en los dos
 * casos se envía por el ID de la PÁGINA.
 *
 * La diferencia está en los links: la restricción del error 508 es de INSTAGRAM. Messenger
 * los acepta sin problema, así que sanitizar ahí le rompía al cliente el link de la tienda
 * y el de seguimiento sin ninguna razón.
 */
async function enviarMensajeIG(recipientId: string, texto: string, canal: Canal = 'ig') {
  if (canal === 'ig') texto = sanitizeIGText(texto)
  // OJO: el envío va por el ID de la PÁGINA de Facebook (no el del usuario IG) — con IG_ID Meta devuelve "(#3) no capability"
  const res = await fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAGE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text: texto }, messaging_type: 'RESPONSE' }),
  })
  const bodyText = await res.text().catch(() => '')
  if (!res.ok) {
    console.error(`IG send FALLO ${res.status}:`, bodyText)
    await diag('send_fail', recipientId, { status: res.status, body: bodyText.slice(0, 1500), texto: texto.slice(0, 200) }, canal)
  } else {
    await diag('send_ok', recipientId, { status: res.status }, canal)
  }
  return res.ok
}

// ─────────── Comentarios en publicaciones ───────────
// Reemplaza la automatización nativa de Meta (que Nahuel apagó). Enfoque elegido: respuesta PÚBLICA
// breve que invita al DM + DM PRIVADO con la respuesta completa del cerebro de Ariel (donde precio/
// specs/derivaciones se resuelven bien y en privado).
const PUBLIC_ACKS = [
  '¡Hola! 🍄 Te escribimos por privado con toda la info 🙌',
  '¡Gracias por escribir! Te pasamos los detalles por DM 🙌',
  '¡Buenísimo! Te respondemos por privado 🍄',
  '¡Hola! Te mandamos la info por mensaje directo 🙌',
]
function hashIdx(s: string, n: number): number {
  let h = 0
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h % n
}
// Comentario trivial (solo emoji/mención/muy corto) → no spamear con público+DM.
function comentarioTrivial(text: string): boolean {
  const limpio = text
    .replace(/@[\w.]+/g, '')
    .replace(/[\p{Extended_Pictographic}]/gu, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .trim()
  return limpio.length < 4
}

async function responderComentarioPublico(commentId: string, texto: string): Promise<boolean> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${commentId}/replies`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAGE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: sanitizeIGText(texto) }),
  })
  const b = await res.text().catch(() => '')
  if (!res.ok) { console.error('IG coment público FALLO', res.status, b); await diag('coment_pub_fail', commentId, { status: res.status, body: b.slice(0, 800) }) }
  return res.ok
}

// Respuesta privada a un comentario = DM al autor referenciando su comentario (recipient.comment_id).
// Permitida 1 vez por comentario y dentro de los 7 días.
async function enviarPrivateReply(commentId: string, texto: string): Promise<boolean> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAGE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text: sanitizeIGText(texto) } }),
  })
  const b = await res.text().catch(() => '')
  if (!res.ok) { console.error('IG private reply FALLO', res.status, b); await diag('coment_dm_fail', commentId, { status: res.status, body: b.slice(0, 800) }) }
  return res.ok
}

type ComentValue = { id?: string; text?: string; from?: { id?: string; username?: string } }
async function manejarComentario(value: ComentValue) {
  const commentId = value?.id
  const text = (value?.text ?? '').trim()
  const fromId = value?.from?.id
  const username = value?.from?.username ?? ''
  if (!commentId || !fromId) return
  if (fromId === IG_ID || fromId === PAGE_ID) return   // nuestro propio comentario/respuesta
  if (!text || comentarioTrivial(text)) return         // reacción/emoji/tag → no responder
  if (await comentarioYaRespondido(commentId)) return  // dedup (Meta reenvía a veces)

  await diag('coment_recibido', String(fromId), { comment_id: commentId, username, texto: text.slice(0, 300) })

  // DM: respuesta completa del cerebro (precio en escalera, derivación, etc.)
  let dm = ''
  let derivar = false
  let motivo = ''
  try {
    const precios = await bloquePreciosEnVivo()
    const s = await pensar(text, precios, [])
    dm = s.respuesta; derivar = s.derivar; motivo = s.motivo
  } catch {
    dm = '¡Hola! 🍄 Soy el asistente virtual de Micelium. Contame qué necesitás y te ayudo 🙌'
  }
  if (derivar) dm += (dm ? '\n\n' : '') + `👉 ${WA_PLAIN}`

  const pub = PUBLIC_ACKS[hashIdx(commentId, PUBLIC_ACKS.length)]
  await responderComentarioPublico(commentId, pub)
  await enviarPrivateReply(commentId, dm)
  await diag('coment_ok', String(fromId), { comment_id: commentId, derivar, publico: pub, dm: dm.slice(0, 300) })

  if (derivar) {
    await notifyNahuel(
      '🔔 Instagram: comentario derivado',
      `Comentario de @${username}: "${text}"\nMotivo: ${motivo || '(sin especificar)'}\nSe le respondió por DM invitando a WhatsApp de la empresa.`,
    )
  }
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
      changes?: Array<{
        field?: string
        value?: { id?: string; text?: string; from?: { id?: string; username?: string } }
      }>
    }>
  }

  // Firma HMAC de Meta antes de procesar nada: sin esto cualquiera puede simular un DM o un
  // comentario y hacer que el bot responda (y gaste) por cuenta ajena. Ver lib/meta-signature.
  const firma = await verificarFirmaMeta(req, process.env.META_APP_SECRET)
  if (!firma.ok) {
    console.error('[ig] webhook rechazado:', firma.motivo)
    return NextResponse.json({ error: firma.motivo }, { status: firma.status })
  }

  try { body = JSON.parse(firma.body) } catch { return NextResponse.json({ ok: true }) }
  if (body.object !== 'instagram' && body.object !== 'page') return NextResponse.json({ ok: true })

  // De qué plataforma vino. Meta manda `instagram` para DMs y comentarios de IG, y `page`
  // para Messenger. Se registra en columna porque sin esto los dos canales quedan mezclados
  // en ig_diag y un canal mudo es indistinguible de un canal sin demanda — que es
  // exactamente cómo Instagram estuvo tres semanas sin recibir un mensaje sin que saltara nada.
  const canal: Canal = body.object === 'page' ? 'messenger' : 'ig'

  for (const entry of body.entry ?? []) {
    // Comentarios en publicaciones (reemplaza la automatización nativa de Meta)
    for (const change of entry.changes ?? []) {
      if (change.field !== 'comments' || !change.value) continue
      try { await manejarComentario(change.value) }
      catch (err) { console.error('IG comment error:', err); await diag('coment_error', 'sys', { error: String(err).slice(0, 500) }, canal) }
    }

    for (const event of entry.messaging ?? []) {
      if (event.message?.is_echo) continue
      const senderId = event.sender.id
      if (senderId === IG_ID || senderId === PAGE_ID) continue

      try {
        // Postback (botón del menú o ice breaker)
        const payload = event.postback?.payload
        if (payload) {
          const respuesta = POSTBACK_RESPONSES[payload]
          if (respuesta) await enviarMensajeIG(senderId, respuesta, canal)
          continue
        }

        const texto = event.message?.text?.trim()
        if (!texto) continue

        await diag('recibido', senderId, { texto: texto.slice(0, 300) }, canal)

        // Cerebro de Ariel: precios en vivo + KB + derivación, con memoria del hilo (evita re-presentarse)
        const [precios, historial] = await Promise.all([bloquePreciosEnVivo(), getHistorial(senderId)])
        const { respuesta, derivar, motivo } = await pensar(texto, precios, historial)
        await diag('pensado', senderId, { derivar, motivo, respuesta: respuesta.slice(0, 300) }, canal)

        // Al derivar, mandamos al cliente a WhatsApp de la empresa (link agregado por código, no por la IA)
        let salidaCliente = respuesta
        if (derivar) salidaCliente += (respuesta ? '\n\n' : '') + `👉 ${WA_PLAIN}`
        if (salidaCliente) await enviarMensajeIG(senderId, salidaCliente, canal)

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
        await diag('error', senderId, { error: String(err).slice(0, 1000) }, canal)
        // fallback humano para no dejar al cliente en visto
        try { await enviarMensajeIG(event.sender.id, '¡Hola! 👋 Gracias por escribirnos, en un ratito te respondemos 🍄', canal) } catch {}
      }
    }
  }

  return NextResponse.json({ ok: true })
}
