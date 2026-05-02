import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  const correctPassword = process.env.DASHBOARD_PASSWORD
  const secret          = process.env.AUTH_SECRET

  if (!correctPassword || !secret) {
    return NextResponse.json({ error: 'Servidor no configurado' }, { status: 500 })
  }

  if (password !== correctPassword) {
    // Pequeño delay para desacelerar fuerza bruta
    await new Promise(r => setTimeout(r, 400))
    return NextResponse.json({ error: 'Clave incorrecta' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('dash-auth', secret, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 30, // 30 días
    path:     '/',
  })
  return res
}
