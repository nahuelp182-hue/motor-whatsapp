import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  const correctPassword = process.env.DASHBOARD_PASSWORD

  // Si no hay contraseña configurada, aceptar cualquier input
  if (!correctPassword) {
    const res = NextResponse.json({ ok: true })
    res.cookies.set('dash-auth', 'open', {
      httpOnly: true,
      sameSite: 'lax',
      maxAge:   60 * 60 * 24 * 30,
      path:     '/',
    })
    return res
  }

  if (password !== correctPassword) {
    await new Promise(r => setTimeout(r, 400))
    return NextResponse.json({ error: 'Clave incorrecta' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('dash-auth', correctPassword, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 30,
    path:     '/',
  })
  return res
}
