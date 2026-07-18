import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { KB_MICELIUM } from '@/lib/kb-micelium'
import { notifyNahuel } from '@/lib/notify'
import { diag, getHistorial, logClaudeUsage, hayMensajePosterior, textosDeLaRafaga, type Turno } from '@/lib/diag'
import { getEstadoAndreani } from '@/lib/andreani'
import { notifyNahuelAdjunto } from '@/lib/notify'
import { prisma } from '@/lib/prisma'

// Ventana de "debounce": si el cliente manda varios mensajes seguidos, esperamos este
// tiempo y solo la última invocación responde (a toda la ráfaga junta). Evita respuestas
// duplicadas/contradictorias cuando llegan 2-3 mensajes casi simultáneos.
const DEBOUNCE_MS = 7000

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
// Mail de la empresa donde Mateo recibe los comprobantes de pago para verificar.
const EMAIL_EMPRESA = process.env.EMAIL_EMPRESA ?? 'info.micelium@gmail.com'
// Números INTERNOS (no clientes): no pasan por el bot ni por CRM.
// Tío = encargado de despachar ventas apícolas; sus respuestas se reenvían a Nahuel.
const TIO_WA    = process.env.WA_TIO    ?? '5493563413104'
const NAHUEL_WA = process.env.WA_NAHUEL ?? '5493522412228'
const last10 = (s: string): string => (s || '').replace(/\D/g, '').slice(-10)
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
type Pedido = {
  encontrado: boolean
  pagado: boolean          // payment_status === 'paid' (si no, está pendiente de pago)
  manuales: ManualId[]
  numero?: number
  // Datos de envío (para seguimiento real):
  tracking?: string        // nº de seguimiento del correo
  correo?: string          // texto del correo/transportista (Andreani, Correo Argentino…)
  esAndreani?: boolean
  pickup?: boolean         // envío a sucursal (retiro) vs domicilio
  despachado?: boolean     // shipping_status ya salió del depósito
}

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

// Busca un pedido del cliente por teléfono o por un dato numérico del mensaje
// (nº de orden o DNI). Incluye pendientes de pago (devuelve `pagado`) para poder
// avisarle al cliente que su pago figura pendiente en vez de decir "no existe".
// Excluye órdenes canceladas (no son un pedido válido).
async function buscarPedido(phone: string, texto: string): Promise<Pedido> {
  if (!TN_TOKEN) return { encontrado: false, pagado: false, manuales: [] }
  const tel8 = soloDigitos(phone).slice(-8)
  const tokens = texto.match(/\d{3,9}/g) ?? [] // posible nº orden (4) o DNI (7-8)
  try {
    for (let page = 1; page <= 6; page++) {
      const url = `${TN_BASE}/${TN_STORE}/orders?status=any&per_page=50&page=${page}` +
        `&fields=number,status,payment_status,contact_phone,contact_identification,products,` +
        `shipping_tracking_number,shipping_option,shipping_pickup_type,shipping_status`
      const res = await fetch(url, { headers: { Authentication: `bearer ${TN_TOKEN}`, 'User-Agent': UA } })
      if (!res.ok) break
      const data = (await res.json()) as Array<{
        number: number; status?: string; payment_status?: string
        contact_phone?: string; contact_identification?: string; products?: Array<{ name?: unknown }>
        shipping_tracking_number?: string; shipping_option?: string; shipping_pickup_type?: string; shipping_status?: string
      }>
      if (!Array.isArray(data) || data.length === 0) break
      for (const o of data) {
        if (o.status === 'cancelled') continue // orden cancelada = no es un pedido válido
        const oPhone8 = soloDigitos(o.contact_phone ?? '').slice(-8)
        const matchTel = tel8.length >= 8 && oPhone8 === tel8
        const matchTok = tokens.some((t) => String(o.number) === t || soloDigitos(o.contact_identification ?? '') === t)
        if (matchTel || matchTok) {
          const correo = o.shipping_option ?? ''
          return {
            encontrado: true,
            pagado: o.payment_status === 'paid',
            manuales: manualesDeProductos(o.products ?? []),
            numero: o.number,
            tracking: o.shipping_tracking_number || undefined,
            correo: correo || undefined,
            esAndreani: /andreani/i.test(correo),
            pickup: o.shipping_pickup_type === 'pickup',
            despachado: o.shipping_status === 'shipped',
          }
        }
      }
      if (data.length < 50) break
    }
  } catch (e) {
    console.error('buscarPedido error:', e)
  }
  return { encontrado: false, pagado: false, manuales: [] }
}

// Mensaje para una compra que EXISTE pero figura pendiente de pago. No deriva a otro
// número: pide el comprobante en este mismo chat (el handler de imágenes lo reenvía a
// Mateo, que verifica el saldo acreditado y marca "pagado" en Tiendanube a mano).
function mensajePendientePago(numero?: number): string {
  const ref = numero ? `#${numero}` : ''
  return `Encontré tu pedido ${ref} 🙌 pero en el sistema todavía figura como PENDIENTE DE PAGO ` +
    `(a veces la transferencia tarda en impactar o falta adjuntar el comprobante). ` +
    `Si ya lo pagaste, mandanos acá mismo la foto o el PDF del comprobante y el equipo lo verifica ` +
    `y te confirma. Apenas quede confirmado, despachamos 👌`
}

// Arma un mensaje de seguimiento con el estado REAL del envío. Devuelve null si no se
// puede dar una respuesta certera (→ el caller deriva al equipo, nunca inventa).
async function mensajeSeguimiento(pedido: Pedido): Promise<string | null> {
  if (!pedido.encontrado) return null

  // Todavía sin nº de seguimiento: o no se despachó, o recién sale.
  if (!pedido.tracking) {
    if (pedido.despachado) return null // despachado sin tracking cargado → derivar, no arriesgar
    return `Tu pedido #${pedido.numero} está confirmado 🙌 Todavía no salió del depósito; ` +
      `normalmente se despacha al día siguiente hábil a la mañana. Apenas tenga seguimiento te lo paso.`
  }

  // Andreani: estado en vivo, certero.
  if (pedido.esAndreani) {
    const est = await getEstadoAndreani(pedido.tracking)
    if (!est.ok || est.orden == null) return null // sin dato certero → derivar
    const link = `https://www.andreani.com/envio/${pedido.tracking}`
    if (est.entregado) {
      return `Tu pedido #${pedido.numero} figura como ENTREGADO ✅ Si no lo recibiste, avisame y lo revisamos.\n\nSeguimiento: ${link}`
    }
    if (est.enSucursal) {
      return `¡Buena noticia! Tu pedido #${pedido.numero} ya está EN LA SUCURSAL para retirar 🙌 ` +
        `Llevá tu DNI. Te conviene pasar pronto: si queda muchos días sin retirar, el correo lo devuelve.\n\nSeguimiento: ${link}`
    }
    // En camino / ingresado / pendiente → NO decir "llegó a sucursal".
    return `Tu pedido #${pedido.numero} está EN CAMINO 🚚 (estado actual: ${est.titulo}). ` +
      `El plazo habitual es de 3 a 5 días hábiles.\n\nSeguílo acá: ${link}`
  }

  // Correo Argentino u otro: no hay estado en vivo → damos link + código (certero, sin inventar estado).
  return `Tu pedido #${pedido.numero} viaja por ${pedido.correo || 'el correo'} 📦 ` +
    `Seguilo con este código: ${pedido.tracking}\n` +
    `https://www.correoargentino.com.ar/formularios/ondnc`
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

SEGUIMIENTO DE ENVÍO: si el cliente pregunta dónde está su pedido / cuándo llega / por el estado del envío, NO derivés y NO inventes ningún estado ("ya está en sucursal", "salió hoy", etc. — NUNCA). Marcá [SEGUIMIENTO]. El SISTEMA consulta el estado REAL (Tiendanube + Andreani) y responde con datos ciertos, o deriva solo si no hay dato certero. En [RESPUESTA] poné una línea breve tipo "Dejame ver el estado de tu envío 👇" SIN afirmar nada del estado. Si el cliente todavía no dio con qué ubicar su compra (nº de orden o DNI) y no lo tenemos por su teléfono, pedíselo antes.
IMPORTANTE: si el cliente te da un NÚMERO DE ORDEN o un DNI para que ubiques su compra, pago o envío (ej. "mi pedido es el 1594", "DNI 35185724", "compré a nombre de X"), marcá SIEMPRE [SEGUIMIENTO] (el sistema resuelve: si el pago está pendiente, si está en camino, etc.). No respondas vos "ya tengo tus datos" sin marcar [SEGUIMIENTO] — sin la etiqueta el sistema no verifica nada.
PAGO PENDIENTE / COMPROBANTE: si el cliente dice que ya compró/pagó, que va a mandar o mandó el comprobante, o pregunta por qué su pedido figura sin pagar, marcá [SEGUIMIENTO] (el sistema detecta si la orden está pendiente de pago y le pide el comprobante). No afirmes vos que el pago está confirmado ni que no lo está.

FEEDBACK / QUEJA SOBRE EL PRODUCTO: si el cliente comenta una falla, defecto, crítica o problema de calidad del equipo (algo que llegó torcido/roto/mal, o una observación de mejora), marcá [FEEDBACK]. Respondé breve, agradecido y empático, pero NO des instrucciones de reparación ni le pidas que lo arregle/desarme él mismo (nada de "despegá y volvé a pegar", "ajustá", "cambiá vos"). Para cualquier arreglo o reposición lo ve el equipo. El sistema le avisa a Nahuel.
REGLA DURA ANTI-DIY (aplica en CUALQUIER turno, no solo el primero): NUNCA le confirmes, apruebes ni le sugieras al cliente desarmar, despegar, pegar, forzar, ajustar tornillos ni intervenir físicamente el equipo — AUNQUE sea ÉL quien lo proponga ("voy a despegarla y pegarla de nuevo"). En ese caso NO respondas "perfecto, hacelo": pedile que NO lo manipule, que lo dejamos que lo vea el equipo para no arriesgar el equipo ni su garantía, y marcá [FEEDBACK].

ACÁ NO TENÉS HERRAMIENTAS PARA RESOLVER. Por eso DERIVÁ (no lo resuelvas solo, no inventes datos) cuando el cliente pida: roturas/garantía/fallas que hay que gestionar, plata/reintegros/reembolsos, cambios de pedido (cuotas, dirección, cancelación), reclamos que escalan, temas legales/salud, o mayoristas/prensa.
PSILOCIBE / "MÁGICOS" / GOLDEN TEACHER: NO derivés por esto. Respondé SIEMPRE con esta única línea neutral y cerrá el tema: "La incubadora sirve para cualquier tipo de cultivo de hongos; controla temperatura y humedad de forma automática. Sobre especies puntuales no asesoramos, pero el equipo funciona igual para lo que quieras cultivar 🙌". No des instrucciones ni recomendaciones de cepas/dosis. Solo si el cliente INSISTE reiteradamente, ahí sí marcá DERIVAR.
Cuando DERIVES: en la RESPUESTA invitá al cliente, breve y cálido, a SEGUIR POR WHATSAPP con el equipo (ahí lo atienden mejor). NO escribas vos el número ni el link de WhatsApp: el sistema agrega el link automáticamente al final de tu respuesta. Ej. de cierre: "Para esto te ayudamos mejor con el equipo 👇". Y marcá DERIVAR.

FORMATO DE SALIDA OBLIGATORIO (respetá estas etiquetas EXACTAS, en este orden):
[RESPUESTA]
<el texto tal cual se le envía al cliente>
[DERIVAR] si|no
[MOTIVO] <motivo corto si derivás; si no derivás poné "no" en DERIVAR y dejá MOTIVO vacío>
[MANUAL] <inc101|pc400|? — SOLO si el cliente pide el manual de su compra; si no aplica, omití esta línea>
[SEGUIMIENTO] si — SOLO si el cliente pregunta por el estado/llegada de su envío; si no aplica, omití esta línea
[FEEDBACK] si — SOLO si el cliente reporta una falla/crítica/defecto del producto; si no aplica, omití esta línea

=== BASE DE CONOCIMIENTO ===
${KB_MICELIUM}
=== FIN ===`

// ─────────── Parseo de salida del cerebro ───────────
type Salida = {
  respuesta: string; derivar: boolean; motivo: string
  manual: ManualId | '?' | null; seguimiento: boolean; feedback: boolean
}

function parseSalida(raw: string): Salida {
  const mResp = raw.match(/\[RESPUESTA\]\s*([\s\S]*?)\s*(?:\[DERIVAR\]|\[MANUAL\]|\[SEGUIMIENTO\]|\[FEEDBACK\]|$)/i)
  const mDer  = raw.match(/\[DERIVAR\]\s*(si|sí|no)/i)
  const mMot  = raw.match(/\[MOTIVO\]\s*([\s\S]*?)\s*(?:\[MANUAL\]|\[SEGUIMIENTO\]|\[FEEDBACK\]|$)/i)
  const mMan  = raw.match(/\[MANUAL\]\s*(inc101|pc400|\?)/i)
  const mSeg  = raw.match(/\[SEGUIMIENTO\]\s*(si|sí)/i)
  const mFb   = raw.match(/\[FEEDBACK\]\s*(si|sí)/i)
  const respuesta = (mResp ? mResp[1] : raw).trim()
  const derivar = mDer ? /s[ií]/i.test(mDer[1]) : false
  const motivo = mMot ? mMot[1].trim() : ''
  const manual = mMan ? (mMan[1].toLowerCase() as ManualId | '?') : null
  return { respuesta, derivar, motivo, manual, seguimiento: !!mSeg, feedback: !!mFb }
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

// Reenvío por PLANTILLA (siempre entrega, aún fuera de ventana 24h). Devuelve true si salió.
async function reenviarPlantillaWA(to: string, tpl: string, params: string[]): Promise<boolean> {
  const res = await fetch(`${WA_API_URL}/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: tpl,
        language: { code: 'es_AR' },
        components: [{ type: 'body', parameters: params.map((t) => ({ type: 'text', text: t })) }],
      },
    }),
  })
  if (!res.ok) console.error('reenvío plantilla FALLO', res.status, (await res.text().catch(() => '')).slice(0, 300))
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Descarga un archivo (imagen/documento) recibido por WhatsApp Cloud API.
// Dos pasos: GET /{media_id} → url; luego GET url con Bearer. Devuelve null si falla.
async function descargarMediaWA(mediaId: string): Promise<{ buffer: Buffer; mime: string } | null> {
  try {
    const meta = await fetch(`${WA_API_URL}/${mediaId}`, { headers: { Authorization: `Bearer ${WA_TOKEN}` } })
    if (!meta.ok) return null
    const info = (await meta.json()) as { url?: string; mime_type?: string }
    if (!info.url) return null
    const bin = await fetch(info.url, { headers: { Authorization: `Bearer ${WA_TOKEN}` } })
    if (!bin.ok) return null
    const buf = Buffer.from(await bin.arrayBuffer())
    return { buffer: buf, mime: info.mime_type ?? 'application/octet-stream' }
  } catch (e) {
    console.error('descargarMediaWA error:', e)
    return null
  }
}

// Recibe un archivo del cliente (típicamente un comprobante de pago): acusa recibo,
// reenvía el archivo a Nahuel/Mateo por mail (adjunto) y NO llama al cerebro. Mateo
// verifica el saldo acreditado y marca "pagado" en Tiendanube a mano.
async function manejarArchivo(
  from: string, nombre: string | undefined, mediaId: string, kind: 'image' | 'document',
  caption: string, filenameHint: string | undefined,
): Promise<void> {
  await wdiag('recibido_archivo', from, { kind, caption: caption.slice(0, 200), nombre, mediaId })
  const media = await descargarMediaWA(mediaId)
  const ext = kind === 'document'
    ? (filenameHint?.split('.').pop() || (media?.mime.split('/')[1] ?? 'pdf'))
    : (media?.mime.split('/')[1] ?? 'jpg')
  const fname = `comprobante_${nombre?.replace(/[^\w]+/g, '_') || from}.${ext}`
  const cuerpo =
    `Un cliente envió un archivo por WhatsApp (probable comprobante de pago).\n\n` +
    `Número: ${from}\n` + (nombre ? `Nombre: ${nombre}\n` : '') +
    (caption ? `Texto: "${caption}"\n` : '') +
    `\nVerificá el saldo acreditado y, si está OK, marcá "pagado" en Tiendanube.`
  if (media) {
    await notifyNahuelAdjunto('🧾 WhatsApp: comprobante / archivo recibido', cuerpo, {
      filename: fname, content: media.buffer, contentType: media.mime,
    }, EMAIL_EMPRESA)
  } else {
    await notifyNahuel('🧾 WhatsApp: archivo recibido (no se pudo bajar)', cuerpo + `\n\n(No se pudo descargar el archivo; revisá el chat directo.)`)
  }
  const ack = kind === 'document' || /pago|comprob|transfer/i.test(caption)
    ? '¡Recibimos tu comprobante! 🙌 El equipo verifica el pago y te confirma a la brevedad. Apenas quede confirmado, despachamos 👌'
    : '¡Recibimos tu archivo! 🙌 Si es el comprobante de pago, el equipo lo verifica y te confirma. Si es una consulta, contame en un texto así te ayudo 👌'
  await enviarMensajeWA(from, ack)
  await wdiag('pensado', from, { derivar: false, accion: 'archivo_recibido', respuesta: ack.slice(0, 300) })
}

// Detecta respuestas AUTOMÁTICAS de otros negocios/bots (ej. el auto-responder de APIDAN)
// para no entrar en un loop bot-contra-bot. Si matchea, no respondemos.
function esAutoRespuesta(texto: string): boolean {
  const t = texto.toLowerCase()
  const patrones = [
    /te comunicaste con/, /horario de atenci[oó]n/, /a la brevedad (te )?responder/,
    /gracias por (tu mensaje|comunicarte|contactarnos)/, /mensaje autom[aá]tico/,
    /responderemos tu consulta/, /nuestro horario/, /fuera de horario/,
  ]
  return patrones.some((p) => p.test(t))
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
            image?: { id?: string; caption?: string; mime_type?: string }
            document?: { id?: string; caption?: string; filename?: string; mime_type?: string }
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
        const from = msg.from ?? ''
        if (!from) continue

        const nombre = value.contacts?.find((c) => c.wa_id === from)?.profile?.name
          ?? value.contacts?.[0]?.profile?.name

        // ─── Imágenes / documentos (típicamente comprobante de pago) ───
        // No pasan por el cerebro: se acusan y se reenvían a Mateo para verificar.
        // (Se excluyen los números internos: no mandan comprobantes.)
        const desde10Media = last10(from)
        if ((msg.type === 'image' || msg.type === 'document') &&
            desde10Media !== last10(TIO_WA) && desde10Media !== last10(NAHUEL_WA)) {
          const media = msg.type === 'image' ? msg.image : msg.document
          const mediaId = media?.id
          if (mediaId) {
            try {
              await manejarArchivo(from, nombre, mediaId, msg.type as 'image' | 'document',
                media?.caption ?? '', msg.type === 'document' ? msg.document?.filename : undefined)
            } catch (e) { console.error('manejarArchivo error:', e) }
          }
          continue
        }

        // Solo texto de acá en adelante; ignorar statuses, audio, etc.
        if (msg.type !== 'text') continue
        const texto = msg.text?.body?.trim()
        if (!texto) continue

        // ─── Números INTERNOS: NO pasan por el bot ni por CRM/leads ───
        const desde10 = last10(from)
        if (desde10 === last10(TIO_WA)) {
          // Respuesta del tío (despachos) → reenviar a Nahuel. Plantilla primero (siempre entrega),
          // email de respaldo. Nunca contesta el bot ni se crea lead.
          try {
            await wdiag('reenvio_tio', from, { texto: texto.slice(0, 500), wamid: msg.id, nombre })
            const limpio = texto.replace(/\s+/g, ' ').slice(0, 600)
            const ok = await reenviarPlantillaWA(NAHUEL_WA, 'aviso_mensaje_tio', [nombre || 'Tu tío', limpio])
            if (!ok) await notifyNahuel('📨 Mensaje de tu tío (despachos)', `Tu tío (${from}) escribió:\n\n"${texto}"`)
          } catch (e) {
            console.error('reenvío tío error:', e)
            try { await notifyNahuel('📨 Mensaje de tu tío (despachos)', `Tu tío (${from}) escribió:\n\n"${texto}"`) } catch {}
          }
          continue
        }
        if (desde10 === last10(NAHUEL_WA)) {
          // Mensajes del propio Nahuel al número: que NO responda el bot.
          await wdiag('interno_nahuel', from, { texto: texto.slice(0, 300), wamid: msg.id })
          continue
        }

        try {
          // 'recibido'/'pensado' son los kinds que getHistorial() consulta para reconstruir el hilo
          await wdiag('recibido', from, { texto: texto.slice(0, 300), wamid: msg.id, nombre })

          // Auto-responder de otro negocio/bot (ej. APIDAN) → no responder, cortar el loop.
          if (esAutoRespuesta(texto)) {
            await wdiag('auto_ignorado', from, { texto: texto.slice(0, 200) })
            continue
          }

          await capturarResenaSiCorresponde(from, texto)

          // ─── Debounce de ráfagas ───
          // Esperamos un momento; si llegó un mensaje más nuevo de este mismo número,
          // dejamos que la ÚLTIMA invocación responda por toda la ráfaga (esta se retira).
          await sleep(DEBOUNCE_MS)
          if (await hayMensajePosterior(from, msg.id ?? '')) continue
          const rafaga = await textosDeLaRafaga(from)
          const mensajeUsuario = rafaga.length > 1 ? rafaga.join('\n') : texto

          const [catalogo, historial] = await Promise.all([bloqueCatalogo(), getHistorial(from)])
          const { respuesta, derivar, motivo, manual, seguimiento, feedback } = await pensar(mensajeUsuario, catalogo, historial)

          // Estado final que se envía + se loguea (un solo 'pensado' por mensaje).
          let outText = respuesta
          let didDerivar = derivar
          let accion: string | undefined

          if (seguimiento) {
            // Estado REAL del envío (Tiendanube + Andreani). Nunca inventa: si no hay dato
            // certero, deriva al equipo.
            const pedido = await buscarPedido(from, mensajeUsuario)
            if (pedido.encontrado && !pedido.pagado) {
              // La compra existe pero figura pendiente de pago → no hay envío que rastrear.
              // Le pedimos el comprobante acá mismo y avisamos a Mateo (verifica y marca en TN).
              outText = mensajePendientePago(pedido.numero)
              didDerivar = false
              accion = 'pago_pendiente'
              await enviarMensajeWA(from, outText)
              await notifyNahuel(
                '💸 WhatsApp: compra con pago pendiente',
                `Un cliente pregunta por su pedido y en TN figura PENDIENTE DE PAGO.\n\n` +
                `Número: ${from}\n` + (nombre ? `Nombre: ${nombre}\n` : '') +
                `Pedido: #${pedido.numero ?? '?'}\n` +
                `Le pedí el comprobante por WhatsApp. Cuando lo mande, te llega el archivo por mail; ` +
                `verificá el saldo y marcá "pagado" en Tiendanube.`,
              )
            } else {
            const msgSeg = await mensajeSeguimiento(pedido)
            if (msgSeg) {
              outText = msgSeg
              didDerivar = false
              accion = pedido.esAndreani ? 'seguimiento_andreani' : 'seguimiento_ok'
              await enviarMensajeWA(from, outText)
            } else if (pedido.encontrado) {
              // Pedido hallado pero sin estado certero (sin tracking cargado / API sin dato) → equipo.
              outText = 'Encontré tu compra pero no tengo el estado del envío al día en este momento 🙌 Te paso con el equipo para que te confirme dónde está 👇'
              didDerivar = true
              accion = 'seguimiento_sin_dato'
              await derivarAlEquipo(from, outText)
            } else if (/\d{3,9}/.test(mensajeUsuario)) {
              // Dio un dato pero no matcheó ninguna compra.
              outText = 'No pude encontrar tu compra con ese dato 😕 Te paso con el equipo para que lo revise 👇'
              didDerivar = true
              accion = 'seguimiento_no_verificado'
              await derivarAlEquipo(from, outText)
            } else {
              // Falta con qué ubicar la compra: se lo pedimos (sin derivar aún).
              outText = respuesta || 'Para ver tu envío, pasame tu número de orden (está en el mail de compra) o el DNI con el que compraste 🙌'
              didDerivar = false
              accion = 'seguimiento_pide_dato'
              await enviarMensajeWA(from, outText)
            }
            }
          } else if (manual) {
            // Comprador pidió material → verificar compra por teléfono o dato numérico.
            const pedido = await buscarPedido(from, mensajeUsuario)
            if (pedido.encontrado && !pedido.pagado) {
              // Compró pero el pago aún no está confirmado → no mandamos material todavía.
              outText = mensajePendientePago(pedido.numero)
              didDerivar = false
              accion = 'pago_pendiente'
              await enviarMensajeWA(from, outText)
              await notifyNahuel(
                '💸 WhatsApp: pidió material con pago pendiente',
                `Un cliente pidió el material y su pedido figura PENDIENTE DE PAGO en TN.\n\n` +
                `Número: ${from}\n` + (nombre ? `Nombre: ${nombre}\n` : '') +
                `Pedido: #${pedido.numero ?? '?'}\n` +
                `Le pedí el comprobante por WhatsApp. Cuando lo mande te llega por mail; verificá y marcá pagado en TN.`,
              )
            } else if (pedido.encontrado) {
              const targets: ManualId[] =
                manual === 'inc101' || manual === 'pc400'
                  ? [manual]
                  : pedido.manuales.length ? pedido.manuales : ['inc101']
              const links = targets.map(linkDeManual).join('\n')
              outText = `${respuesta ? respuesta + '\n\n' : '📚 Acá tenés tu material 👇\n\n'}${links}\n\nCualquier duda del cultivo, escribime 🍄`
              didDerivar = false
              accion = 'manual_enviado'
              await enviarMensajeWA(from, outText)
            } else if (/\d{3,9}/.test(mensajeUsuario)) {
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
          } else if (feedback) {
            // Crítica/defecto del producto: respondemos cálido (sin instrucciones de arreglo)
            // y le avisamos a Nahuel. NO derivamos (no es un lead perdido, es info para él).
            outText = respuesta || '¡Gracias por comentárnoslo! Lo tomamos muy en cuenta para mejorar 🙌'
            accion = 'feedback'
            await enviarMensajeWA(from, outText)
          } else if (respuesta) {
            await enviarMensajeWA(from, respuesta)
          }

          await wdiag('pensado', from, {
            derivar: didDerivar, motivo, accion, feedback, respuesta: outText.slice(0, 300),
          })

          if (feedback) {
            await notifyNahuel(
              '📝 WhatsApp: feedback / crítica de producto',
              `Un cliente dejó feedback sobre el producto por WhatsApp.\n\n` +
              `Número: ${from}\n` +
              (nombre ? `Nombre: ${nombre}\n` : '') +
              `Mensaje: "${mensajeUsuario}"\n\n` +
              `El bot respondió sin dar instrucciones de arreglo. Revisá si conviene que lo contactes.`,
            )
          }

          if (didDerivar) {
            await notifyNahuel(
              '🔔 WhatsApp: lead derivado al equipo',
              `Un mensaje de WhatsApp fue derivado al equipo.\n\n` +
              `Número: ${from}\n` +
              (nombre ? `Nombre: ${nombre}\n` : '') +
              `Mensaje: "${mensajeUsuario}"\n` +
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
