// Lead magnet: valida el email (formato + MX real) y envia la guia por correo.
// Solo mails con dominio de correo real reciben -> lista limpia, entrega verificada.
// Best-effort: tambien suscribe a Tiendanube (de ahi el cron sube el lead a Meta).
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { promises as dns } from 'dns'
import { consumirLimite, ipDe, limpiarVencidos, respuesta429 } from '@/lib/ratelimit'
import { p, plantilla } from '@/lib/mails-cliente'

export const runtime = 'nodejs'

const GMAIL_USER = process.env.GMAIL_USER ?? 'info.micelium@gmail.com'
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD ?? ''
const TN_TOKEN = process.env.TN_ACCESS_TOKEN ?? ''
const TN_STORE = process.env.TN_STORE_ID ?? ''
const TN_UA = 'MiceliumApp (nahuelp182@gmail.com)'
const PDF_URL = 'https://mw-micelium.vercel.app/guia-primer-cultivo.pdf'

// Solo el storefront puede llamar acá. Antes era `*`, así que cualquier página podía usar
// este endpoint como relay de correo saliente desde la casilla de Micelium.
const ORIGENES = [
  'https://infomicelium.com.ar',
  'https://www.infomicelium.com.ar',
  'https://micelium2.mitiendanube.com', // dominio original de Tiendanube: sigue sirviendo la tienda
  'https://mw-micelium.vercel.app',
  'https://guias.infomicelium.com.ar', // capa pública de guías: de ahí llama el widget de captura
  'https://guia.infomicelium.com.ar',
]

function cors(req: NextRequest): Record<string, string> {
  const origen = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ORIGENES.includes(origen) ? origen : ORIGENES[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) })
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

// Usa la misma plantilla que el resto de los mails (paleta de marca, firma de Mateo).
// Antes tenía su propio diseño en negro y terracota: era el PRIMER mail que recibía una
// persona y no se parecía a ninguno de los que venían después.
function emailHtml(): string {
  return plantilla(
    'Acá está tu guía',
    p(
      'Gracias por sumarte. Adentro está lo necesario para lograr un primer cultivo sin experiencia previa: las cuatro etapas, las tres razones por las que la mayoría fracasa, las variedades que más perdonan y tres recetas para la primera cosecha.',
    ) +
      p(
        'Si vas a leer una sola parte, que sea la de contaminación: es lo que decide el resultado antes de que empiece nada.',
      ),
    { texto: 'Descargar mi guía', url: PDF_URL },
  )
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
  const CORS = cors(req)
  try {
    // Doble tope: por IP (evita el loop de un atacante) y por casilla (evita que alguien
    // use el endpoint para bombardear a un tercero con mails desde nuestro dominio).
    const porIp = await consumirLimite(`lead:ip:${ipDe(req)}`, 5, 60 * 60)
    if (!porIp.permitido) return respuesta429(porIp, CORS)
    void limpiarVencidos()

    const body = await req.json().catch(() => ({}))
    const email = String(body?.email ?? '').trim().toLowerCase()

    // Honeypot: campo oculto que un humano nunca completa y un bot sí.
    if (String(body?.website ?? '').trim() !== '') {
      return NextResponse.json({ ok: true }, { headers: CORS }) // silencioso a propósito
    }

    if (!EMAIL_RE.test(email) || email.length > 160) {
      return NextResponse.json({ ok: false, error: 'formato' }, { status: 400, headers: CORS })
    }

    const porEmail = await consumirLimite(`lead:em:${email}`, 2, 24 * 60 * 60)
    if (!porEmail.permitido) return respuesta429(porEmail, CORS)

    if (!(await domainHasMx(email))) {
      return NextResponse.json({ ok: false, error: 'dominio' }, { status: 400, headers: CORS })
    }
    if (!GMAIL_PASS) {
      return NextResponse.json({ ok: false, error: 'config' }, { status: 500, headers: CORS })
    }

    try {
      await sendGuide(email)
    } catch {
      return NextResponse.json({ ok: false, error: 'send' }, { status: 500, headers: CORS })
    }
    void addToTiendanube(email) // best-effort, no bloquea la respuesta

    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch {
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500, headers: CORS })
  }
}
