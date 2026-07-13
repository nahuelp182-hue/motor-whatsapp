// Lead magnet: valida el email (formato + MX real) y envia la guia por correo.
// Solo mails con dominio de correo real reciben -> lista limpia, entrega verificada.
// Best-effort: tambien suscribe a Tiendanube (de ahi el cron sube el lead a Meta).
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { promises as dns } from 'dns'

export const runtime = 'nodejs'

const GMAIL_USER = process.env.GMAIL_USER ?? 'nahuelp182@gmail.com'
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD ?? ''
const TN_TOKEN = process.env.TN_TOKEN ?? ''
const TN_STORE = process.env.TN_STORE ?? ''
const TN_UA = 'MiceliumApp (nahuelp182@gmail.com)'
const PDF_URL = 'https://mw-micelium.vercel.app/guia-primer-cultivo.pdf'

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

async function domainHasMx(email: string): Promise<boolean> {
  const domain = email.split('@')[1]
  if (!domain) return false
  try {
    const mx = await dns.resolveMx(domain)
    if (mx && mx.length > 0) return true
  } catch {}
  // fallback: dominios que reciben mail via A record
  try { await dns.resolve(domain); return true } catch { return false }
}

async function addToTiendanube(email: string): Promise<void> {
  if (!TN_TOKEN || !TN_STORE) return
  try {
    await fetch(`https://api.tiendanube.com/v1/${TN_STORE}/customers`, {
      method: 'POST',
      headers: { Authentication: `bearer ${TN_TOKEN}`, 'User-Agent': TN_UA, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: email.split('@')[0], email, accepts_marketing: true }),
    })
  } catch {}
}

function emailHtml(): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#2b2622">
    <div style="background:#1c1a17;padding:26px 28px;text-align:center;border-radius:12px 12px 0 0">
      <div style="color:#d8cfc6;font-weight:bold;letter-spacing:3px;font-size:13px">MICELIUM</div>
      <div style="height:3px;width:44px;background:#b0341d;margin:10px auto"></div>
      <div style="color:#fff;font-size:20px;font-weight:bold;margin-top:6px">Tu primer cultivo de hongos en casa</div>
    </div>
    <div style="background:#fff;padding:28px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
      <p style="font-size:15px;line-height:1.6">¡Gracias por sumarte! Acá tenés tu guía gratuita para lograr tu primer cultivo <b>sin experiencia</b> y sin frustrarte en el intento.</p>
      <div style="text-align:center;margin:26px 0">
        <a href="${PDF_URL}" style="background:#b0341d;color:#fff;text-decoration:none;padding:15px 34px;border-radius:9px;font-size:16px;font-weight:bold;display:inline-block">📥 Descargar mi guía</a>
      </div>
      <p style="font-size:13px;color:#6a6157;line-height:1.6">Adentro vas a encontrar las 4 etapas del cultivo, las 3 razones por las que la mayoría fracasa, las variedades más fáciles y 3 recetas para tu primera cosecha.</p>
      <p style="font-size:13px;color:#6a6157;margin-top:18px">Cualquier duda, escribinos por WhatsApp al +54 351 214 5521.</p>
      <p style="font-size:12px;color:#a89c8e;margin-top:20px;border-top:1px solid #eee;padding-top:14px">Micelium · infomicelium.com.ar · @incubadoras_micelium</p>
    </div>
  </div>`
}

async function sendGuide(email: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 587, secure: false,
    auth: { user: GMAIL_USER, pass: GMAIL_PASS },
  })
  await transporter.sendMail({
    from: `Micelium <${GMAIL_USER}>`,
    to: email,
    subject: '🍄 Tu guía: Tu primer cultivo de hongos en casa',
    html: emailHtml(),
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const email = String(body?.email ?? '').trim().toLowerCase()

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: 'formato' }, { status: 400, headers: CORS })
    }
    if (!(await domainHasMx(email))) {
      return NextResponse.json({ ok: false, error: 'dominio' }, { status: 400, headers: CORS })
    }
    if (!GMAIL_PASS) {
      return NextResponse.json({ ok: false, error: 'config' }, { status: 500, headers: CORS })
    }

    try {
      await sendGuide(email)
    } catch (e) {
      const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
      return NextResponse.json({ ok: false, error: 'send', detail }, { status: 500, headers: CORS })
    }
    void addToTiendanube(email) // best-effort, no bloquea la respuesta

    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch (e) {
    const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    return NextResponse.json({ ok: false, error: 'server', detail }, { status: 500, headers: CORS })
  }
}
