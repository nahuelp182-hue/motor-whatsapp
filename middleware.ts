import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_SESION, verificarSesion } from '@/lib/session'

// Assets del storefront que se sirven a cualquiera (van embebidos en Tiendanube).
const PUBLICOS = new Set([
  '/mvtrk.js',                // tracker video GA4
  '/cnc.js',                  // widget "¿cómo nos conociste?"
  '/geogate.js',              // geo-bloqueo por radio
  '/ldschema.js',             // JSON-LD schema.org
  '/leadmagnet.js',           // popup/botón lead magnet
  '/curiosos.js',             // tracker de curiosos
  '/guia-primer-cultivo.pdf', // lead magnet: público a propósito
])

// APIs que por diseño reciben tráfico no autenticado. Cada una valida lo suyo: los webhooks
// por firma HMAC, los crons por CRON_SECRET, el resto por rate limit.
const API_ABIERTAS = ['/api/track', '/api/lead', '/api/cnc', '/api/auth', '/api/cron', '/api/webhooks']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const password = process.env.DASHBOARD_PASSWORD

  // FALLA CERRADO. Antes, si faltaba DASHBOARD_PASSWORD se dejaba pasar TODO: un deploy sin
  // esa variable dejaba el dashboard (facturación, clientes, conversaciones) público sin que
  // nada fallara a la vista. En producción eso ahora es un error explícito.
  if (!password) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Servicio mal configurado' }, { status: 503 })
    }
    return NextResponse.next()
  }

  if (PUBLICOS.has(pathname)) return NextResponse.next()
  if (pathname === '/login') return NextResponse.next()
  if (API_ABIERTAS.some(p => pathname.startsWith(p))) return NextResponse.next()

  const sesion = await verificarSesion(request.cookies.get(COOKIE_SESION)?.value, password)
  if (sesion) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // OJO: acá NO se excluyen archivos por extensión. La versión anterior tenía `.*\.pdf` en
  // la exclusión, así que CUALQUIER PDF se servía sin pasar por el middleware. Con manuales
  // de clientes en juego eso es una fuga: los archivos privados se sirven por route handler
  // que valida sesión, y los públicos se listan uno por uno en PUBLICOS.
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.png|.*\\.svg|.*\\.ico).*)'],
}
