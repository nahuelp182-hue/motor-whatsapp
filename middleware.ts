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

// Capa pública de contenido: indexable y sin login a propósito. El conocimiento general es
// lo que construye confianza antes de la compra; lo privado (manuales del equipo, pedidos)
// va en rutas aparte que sí piden sesión.
const PREFIJOS_PUBLICOS = ['/guia']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Lo público se resuelve ANTES de mirar la contraseña: no protege nada, así que no puede
  // depender de que esa variable exista. Si dependiera, un env var faltante dejaría sin
  // servicio a los scripts embebidos en la tienda (geogate, tracking, lead magnet) y a las
  // guías, que es justo lo contrario de lo que se quiere.
  if (PUBLICOS.has(pathname)) return NextResponse.next()
  if (PREFIJOS_PUBLICOS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }
  if (pathname === '/login') return NextResponse.next()
  if (API_ABIERTAS.some(p => pathname.startsWith(p))) return NextResponse.next()

  // De acá para abajo, todo es privado. FALLA CERRADO: antes, si faltaba DASHBOARD_PASSWORD
  // se dejaba pasar TODO, así que un deploy sin esa variable publicaba el dashboard
  // (facturación, clientes, conversaciones) sin que nada fallara a la vista.
  const password = process.env.DASHBOARD_PASSWORD
  if (!password) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Servicio mal configurado' }, { status: 503 })
    }
    return NextResponse.next()
  }

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
