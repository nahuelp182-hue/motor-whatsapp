import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const secret = process.env.AUTH_SECRET

  // Si no hay secreto configurado (dev local sin .env.local) → pasar
  if (!secret) return NextResponse.next()

  // Rutas siempre permitidas
  if (pathname.startsWith('/api/auth'))     return NextResponse.next()
  if (pathname.startsWith('/api/cron'))     return NextResponse.next()
  if (pathname.startsWith('/api/webhooks')) return NextResponse.next()
  if (pathname.startsWith('/login'))        return NextResponse.next()

  // Verificar cookie
  const authCookie = request.cookies.get('dash-auth')?.value
  if (authCookie === secret) return NextResponse.next()

  // API routes → 401 JSON (no redirect, para no romper fetch desde el dashboard)
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
    // Protege todo excepto archivos estáticos y _next interno
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.png|.*\\.svg|.*\\.ico).*)',
  ],
}
