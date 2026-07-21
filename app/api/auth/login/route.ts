import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_SESION, MAX_AGE_SESION, crearSesion } from '@/lib/session'
import { consumirLimite, ipDe, limpiarVencidos, respuesta429 } from '@/lib/ratelimit'

export const runtime = 'nodejs'

// 10 intentos por hora y por IP. Antes solo había un delay de 400 ms, o sea que la clave
// del dashboard se podía probar indefinidamente.
const INTENTOS = 10
const VENTANA = 60 * 60

export async function POST(req: NextRequest) {
  const limite = await consumirLimite(`login:${ipDe(req)}`, INTENTOS, VENTANA)
  if (!limite.permitido) return respuesta429(limite)
  void limpiarVencidos()

  const { password } = await req.json().catch(() => ({ password: '' }))
  const correctPassword = process.env.DASHBOARD_PASSWORD

  // Falla cerrado, igual que el middleware: sin clave configurada no se emite sesión.
  if (!correctPassword) {
    return NextResponse.json({ error: 'Servicio mal configurado' }, { status: 503 })
  }

  if (password !== correctPassword) {
    await new Promise(r => setTimeout(r, 400))
    return NextResponse.json({ error: 'Clave incorrecta' }, { status: 401 })
  }

  // La cookie ya NO guarda la contraseña: guarda un token firmado con vencimiento propio.
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_SESION, await crearSesion('dashboard', correctPassword), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE_SESION,
    path: '/',
  })
  return res
}
