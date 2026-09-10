// Notificador multicanal a Nahuel (fuera de banda). Todo best-effort: nunca tira si un canal falla.
// Canales: email (Gmail SMTP, ya configurado) + Telegram (si hay token) + WhatsApp Cloud API (cuando el chip/WABA esté listo).
import nodemailer from 'nodemailer'

const GMAIL_USER  = process.env.GMAIL_USER          ?? 'nahuelp182@gmail.com'
const GMAIL_PASS  = process.env.GMAIL_APP_PASSWORD  ?? ''
const ALERT_EMAIL = process.env.ALERT_EMAIL         ?? 'nahuelp182@gmail.com'

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const TG_CHAT  = process.env.TELEGRAM_CHAT_ID   ?? ''

// WA_TOKEN/WA_PHONE_NUMBER_ID nunca se cargaron en producción — el webhook manda mensajes
// con otros nombres (WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID). Resultado real, verificado
// contra `vercel env ls`: este canal estuvo muerto desde que se escribió, sin tirar error
// (el guard de abajo lo deja pasar en silencio). Reusa esas credenciales como fallback: son
// el mismo número, no hace falta un token aparte para avisarte a vos.
const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID ?? process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''
const WA_TOKEN    = process.env.WA_TOKEN           ?? process.env.WHATSAPP_TOKEN           ?? ''
const NAHUEL_WA   = process.env.NAHUEL_WA_PHONE    ?? '5493522412228'

// Un solo transporter para todo el proceso, en vez de uno nuevo en cada mensaje.
//
// SIN `pool: true`, a propósito. La versión con pool reusa la conexión SMTP entre envíos,
// que suena mejor —y en un servidor de larga vida lo sería—, pero acá cada invocación es
// una lambda que se congela apenas responde: un socket abierto esperando el próximo mail
// queda colgando de un proceso que puede no despertarse nunca, y el modo de falla es que
// se cuelgue un aviso. Romper el canal de alertas mientras se construye el sistema de
// alertas es el peor intercambio posible.
//
// Lo que esto ahorra, entonces, es solo la creación del objeto: sigue habiendo una conexión
// por mail. Eso es aceptable porque el diseño ya manda POCOS mails — solo cuando algo está
// mal. Si alguna vez el volumen de avisos importa, la solución es agrupar avisos, no
// reusar sockets.
let transporter: nodemailer.Transporter | null = null
function getTransporter(): nodemailer.Transporter | null {
  if (!GMAIL_PASS) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    })
  }
  return transporter
}

async function viaEmail(subject: string, body: string, to: string = ALERT_EMAIL) {
  const t = getTransporter()
  if (!t) return
  await t.sendMail({
    from: GMAIL_USER,
    to,
    subject,
    text: body,
  })
}

async function viaTelegram(text: string) {
  if (!TG_TOKEN || !TG_CHAT) return
  await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text, disable_web_page_preview: true }),
  })
}

// Plantilla aprobada por Meta (categoría UTILITY, id 2272352020233100, enviada a revisión
// el 20/08/2026) con dos variables: {{1}} asunto, {{2}} detalle. Existe porque un mensaje de
// TEXTO común solo entrega si hay una ventana de 24h abierta con el número del bot — y
// Nahuel casi nunca le escribe a ese número, así que en la práctica esa ventana nunca está
// abierta y el aviso urgente (el que más importa: bot caído, saldo agotado) es justo el que
// más fallaba en silencio.
const WA_TEMPLATE_NAME = 'bot_alerta_falla'
const WA_TEMPLATE_LANG = 'es_AR'

/** Los parámetros de plantilla de WhatsApp rechazan saltos de línea y tienen un largo
 *  razonable: sin este recorte, un body con \n de sobra devuelve error y cae al fallback. */
function paramSeguro(s: string, max: number): string {
  return s.replace(/\s*\n+\s*/g, ' · ').slice(0, max)
}

/**
 * Wamid del mensaje que Meta acaba de aceptar, si la respuesta trae uno y trae `.json()`.
 * Se lee de `text()` (ya consumido por el caller para loguear) en vez de `.json()`/`.clone()`
 * directo sobre `r`: los tests de este archivo mockean fetch con `{ ok, text }` sin `.json`
 * ni `.clone`, y una llamada real a un método ausente rompería el mock en vez de degradar
 * a null. Nunca lanza — sin wamid, el cierre informal por respuesta simplemente no aplica
 * a ese aviso puntual; el resto de los canales sigue funcionando igual.
 */
function wamidDeTexto(bodyText: string): string | null {
  try {
    const j = JSON.parse(bodyText) as { messages?: Array<{ id?: string }> }
    return j.messages?.[0]?.id ?? null
  } catch {
    return null
  }
}

/** `ok: true` si Meta aceptó el mensaje; `wamid` puede venir null igual (respuesta sin
 *  cuerpo parseable, o de un mock de test) sin que eso signifique que no entregó. */
type EnvioWa = { ok: boolean; wamid: string | null }

async function viaWhatsAppPlantilla(subject: string, body: string): Promise<EnvioWa> {
  const r = await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: NAHUEL_WA,
      type: 'template',
      template: {
        name: WA_TEMPLATE_NAME,
        language: { code: WA_TEMPLATE_LANG },
        components: [{
          type: 'body',
          parameters: [
            { type: 'text', text: paramSeguro(subject, 200) },
            { type: 'text', text: paramSeguro(body, 600) },
          ],
        }],
      },
    }),
  })
  if (!r.ok) return { ok: false, wamid: null }
  const texto = await r.text().catch(() => '')
  return { ok: true, wamid: wamidDeTexto(texto) }
}

async function viaWhatsAppTexto(text: string): Promise<EnvioWa> {
  const r = await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: NAHUEL_WA, type: 'text', text: { body: text } }),
  })
  if (!r.ok) return { ok: false, wamid: null }
  const texto = await r.text().catch(() => '')
  return { ok: true, wamid: wamidDeTexto(texto) }
}

/**
 * Prueba primero la plantilla (entrega siempre, aprobada o no la ventana de 24h). Si Meta la
 * rechaza —todavía PENDING, o algo cambió en la revisión— cae a texto plano, que entrega
 * solo si la ventana está abierta. Nunca deja el aviso sin intentar por las dos vías.
 *
 * Devuelve el wamid del mensaje efectivamente enviado (o null si entregó pero no se pudo
 * leer el wamid de la respuesta, o si ninguna vía entregó), para que el caller pueda
 * correlacionar una futura respuesta ("listo", citando este mensaje) con la alerta que la
 * originó — ver `respuestaCierraAlerta` en lib/diag.ts. Ojo: el chequeo para decidir el
 * fallback a texto plano es `ok`, NO la presencia de wamid — una plantilla que entregó bien
 * pero cuya respuesta no trajo wamid (ej. un mock de test) no debe reintentar por texto.
 */
async function viaWhatsApp(subject: string, body: string): Promise<string | null> {
  if (!WA_PHONE_ID || !WA_TOKEN) return null
  const plantilla = await viaWhatsAppPlantilla(subject, body).catch((): EnvioWa => ({ ok: false, wamid: null }))
  if (plantilla.ok) return plantilla.wamid
  const texto = await viaWhatsAppTexto(`${subject}\n\n${body}`).catch((): EnvioWa => ({ ok: false, wamid: null }))
  return texto.wamid
}

export type Adjunto = { filename: string; content: Buffer; contentType?: string }

/** Envía un mail con un archivo adjunto (ej. comprobante de pago). `to` override el destino. Nunca lanza. */
export async function notifyNahuelAdjunto(subject: string, body: string, adjunto: Adjunto, to: string = ALERT_EMAIL): Promise<void> {
  try {
    const transporter = getTransporter()
    if (!transporter) { await viaTelegram(`${subject}\n\n${body}\n(no se pudo adjuntar: sin credencial de mail)`); return }
    await transporter.sendMail({
      from: GMAIL_USER, to, subject, text: body,
      attachments: [{ filename: adjunto.filename, content: adjunto.content, contentType: adjunto.contentType }],
    })
    // Ping fuera de banda para que lo vea al toque (el adjunto va por mail).
    await Promise.allSettled([viaTelegram(`${subject}\n\n${body}`), viaWhatsApp(subject, body)])
  } catch (e) {
    console.error('notifyNahuelAdjunto falló:', e)
  }
}

/**
 * Avisa a Nahuel por todos los canales disponibles. Nunca lanza.
 *
 * Devuelve el wamid del mensaje de WhatsApp efectivamente enviado (null si ese canal no
 * entregó o no está configurado). Es opt-in: los ~20 callers existentes ignoran el
 * resultado (`await notifyNahuel(...)` sin destructurar) y siguen funcionando igual; solo
 * el watchdog de atención lo usa, para poder reconocer un "listo" que responde a esta
 * alerta puntual — ver `respuestaCierraAlerta` en lib/diag.ts.
 */
export async function notifyNahuel(subject: string, body: string): Promise<{ wamidWa: string | null }> {
  const full = `${subject}\n\n${body}`
  const results = await Promise.allSettled([
    viaEmail(subject, body),
    viaTelegram(full),
    viaWhatsApp(subject, body),
  ])
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`notifyNahuel canal ${i} falló:`, r.reason)
  })
  const waResult = results[2]
  const wamidWa = waResult.status === 'fulfilled' ? waResult.value : null
  return { wamidWa }
}
