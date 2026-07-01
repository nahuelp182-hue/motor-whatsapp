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

async function viaEmail(subject: string, body: string) {
  if (!GMAIL_PASS) return
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  })
  await transporter.sendMail({
    from: GMAIL_USER,
    to: ALERT_EMAIL,
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
