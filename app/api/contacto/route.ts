import { NextRequest, NextResponse } from 'next/server'
import { notifyNahuel } from '@/lib/notify'
import { diag } from '@/lib/diag'
import { consumirLimite, ipDe, limpiarVencidos, respuesta429 } from '@/lib/ratelimit'
import { COOKIE_CLIENTE_NOMBRE, verificarSesionCliente } from '@/lib/session'

export const runtime = 'nodejs'

// Formulario público: mismo criterio que /api/lead. Sin tope, sería un canal directo para
// inundar la casilla del equipo.
const LIM_IP = { n: 5, ventana: 60 * 60 }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  const limite = await consumirLimite(`contacto:${ipDe(req)}`, LIM_IP.n, LIM_IP.ventana)
  if (!limite.permitido) return respuesta429(limite)
  void limpiarVencidos()

  const body = await req.json().catch(() => ({}))

  // Honeypot: campo oculto que sólo completan los bots.
  if (String(body?.website ?? '').trim() !== '') {
    return NextResponse.json({ ok: true }) // silencioso a propósito
  }

  const nombre = String(body?.nombre ?? '').trim().slice(0, 80)
  const email = String(body?.email ?? '').trim().toLowerCase().slice(0, 160)
  const mensaje = String(body?.mensaje ?? '').trim().slice(0, 3000)

  if (!nombre || !EMAIL_RE.test(email) || mensaje.length < 10) {
    return NextResponse.json(
      { error: 'Revisá los datos: hace falta tu nombre, un email válido y tu consulta.' },
      { status: 400 },
    )
  }

  // Si además es cliente identificado, se adjunta su pedido: el equipo responde con contexto
  // sin tener que preguntarle nada. Sale de la cookie firmada, nunca de lo que mande el form.
  let contexto = ''
  const secreto = process.env.DASHBOARD_PASSWORD
  if (secreto) {
    const ses = await verificarSesionCliente(req.cookies.get(COOKIE_CLIENTE_NOMBRE)?.value, secreto)
    if (ses) contexto = `\n\nCLIENTE VERIFICADO — pedido #${ses.num} (${ses.nom}), equipo: ${ses.eq.join(', ')}`
  }

  // Se registra ANTES de notificar: notifyNahuel es best-effort por 3 canales (mail, Telegram,
  // WhatsApp) y no informa si alguno falló, así que el log es la red que evita perder una
  // consulta si los tres se caen.
  await diag('contacto_web', email, { nombre, mensaje: mensaje.slice(0, 500), contexto })

  await notifyNahuel(
    `Consulta del portal — ${nombre}`,
    `${mensaje}\n\n—\nDe: ${nombre} <${email}>${contexto}\n\nRespondé directo a ese correo.`,
  )

  return NextResponse.json({ ok: true })
}
