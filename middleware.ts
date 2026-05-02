import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const password = process.env.DASHBOARD_PASSWORD

  // Sin contraseña configurada → acceso libre (dev local o sin configurar)
  if (!password) return NextResponse.next()

  // Rutas siempre permitidas
  if (pathname.startsWith('/api/auth'))     return NextResponse.next()
  if (pathname.startsWith('/api/cron'))     return NextResponse.next()
  if (pathname.startsWith('/api/webhooks')) return NextResponse.next()
  if (pathname.startsWith('/login'))        return NextResponse.next()

  // Verificar cookie
  const authCookie = request.cookies.get('dash-auth')?.value
  if (authCookie === password) return NextResponse.next()

  // APIs → 401 JSON
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Páginas → redirigir al login
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.png|.*\\.svg|.*\\.ico).*)',
  ],
}
