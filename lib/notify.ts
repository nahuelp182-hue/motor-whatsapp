// Notificador multicanal a Nahuel (fuera de banda). Todo best-effort: nunca tira si un canal falla.
// Canales: email (Gmail SMTP, ya configurado) + Telegram (si hay token) + WhatsApp Cloud API (cuando el chip/WABA esté listo).
import nodemailer from 'nodemailer'

const GMAIL_USER  = process.env.GMAIL_USER          ?? 'nahuelp182@gmail.com'
const GMAIL_PASS  = process.env.GMAIL_APP_PASSWORD  ?? ''
const ALERT_EMAIL = process.env.ALERT_EMAIL         ?? 'nahuelp182@gmail.com'

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? ''
const TG_CHAT  = process.env.TELEGRAM_CHAT_ID   ?? ''

const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID ?? ''
const WA_TOKEN    = process.env.WA_TOKEN           ?? ''
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

async function viaWhatsApp(text: string) {
  if (!WA_PHONE_ID || !WA_TOKEN) return
  await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: NAHUEL_WA, type: 'text', text: { body: text } }),
  })
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
    await Promise.allSettled([viaTelegram(`${subject}\n\n${body}`), viaWhatsApp(`${subject}\n\n${body}`)])
  } catch (e) {
    console.error('notifyNahuelAdjunto falló:', e)
  }
}

/** Avisa a Nahuel por todos los canales disponibles. Nunca lanza. */
export async function notifyNahuel(subject: string, body: string): Promise<void> {
  const full = `${subject}\n\n${body}`
  const results = await Promise.allSettled([
    viaEmail(subject, body),
    viaTelegram(full),
    viaWhatsApp(full),
  ])
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error(`notifyNahuel canal ${i} falló:`, r.reason)
  })
}
