import { NextRequest, NextResponse } from 'next/server'
import {
  COOKIE_SESION,
  verificarSesion,
  COOKIE_CLIENTE_NOMBRE,
  verificarSesionCliente,
} from '@/lib/session'
import { MARCA } from '@/lib/marca'

// Assets del storefront que se sirven a cualquiera (van embebidos en Tiendanube).
const PUBLICOS = new Set([
  '/mvtrk.js',                // tracker video GA4
  '/cnc.js',                  // widget "¿cómo nos conociste?"
  '/geogate.js',              // geo-bloqueo por radio
  '/ldschema.js',             // JSON-LD schema.org
  '/leadmagnet.js',           // popup/botón lead magnet
  '/curiosos.js',             // tracker de curiosos
  '/sitios.js',               // bloque "Nuestros sitios" en el pie de la tienda
  '/mic.js',                  // motor de widgets (config y contenido vienen de la base)
  '/guia-primer-cultivo.pdf', // lead magnet: público a propósito
  '/logo-micelium.webp',      // logo de la capa pública de guías
])

// APIs que por diseño reciben tráfico no autenticado. Cada una valida lo suyo: los webhooks
// por firma HMAC, los crons por CRON_SECRET, el resto por rate limit.
// OJO: el prefijo se compara con startsWith. Por eso acá van las dos rutas concretas del
// motor de widgets y NO '/api/widgets': ese prefijo dejaría abierto también
// /api/widgets/admin, que es el CRUD del panel.
// '/api/despacho' lo llama el VPS de ventas apícola (latido y consulta de acuses de
// entrega). No tiene sesión de dashboard; ambas rutas validan con chequearCron.
// '/api/jobs/ingest' lo llaman run_job.sh (VPS) y heartbeat.ps1 (Windows) para reportar
// cómo les fue. Va la ruta COMPLETA y no '/api/jobs' por la misma razón que los widgets:
// el prefijo dejaría abierta cualquier ruta futura bajo /api/jobs, incluida una de lectura
// que expondría el estado entero del sistema. La ruta valida con chequearCron.
// '/api/ml-preguntas/sync' lo llama el autoresponder de ML (VPS) en cada ciclo de cron, sin
// sesión de dashboard; valida con chequearCron. Va la ruta COMPLETA y no '/api/ml-preguntas'
// para no abrir también el GET de lectura del panel, que sí debe pedir sesión.
const API_ABIERTAS = ['/api/track', '/api/lead', '/api/cnc', '/api/auth', '/api/cron', '/api/webhooks', '/api/asistente', '/api/acceso', '/api/contacto', '/api/widgets/config', '/api/widgets/evento', '/api/widgets/resena', '/api/presencia', '/api/despacho', '/api/jobs/ingest', '/api/auditoria/ingest', '/api/ia/uso', '/api/ml-preguntas/sync']

// Capa pública de contenido: indexable y sin login a propósito. El conocimiento general es
// lo que construye confianza antes de la compra; lo privado (manuales del equipo, pedidos)
// va en rutas aparte que sí piden sesión.
// '/e' es la entrada pre-autenticada: llega sin sesión por definición (el token ES la
// credencial) y se valida sola, así que no puede quedar detrás de la contraseña del panel.
const PREFIJOS_PUBLICOS = ['/guia', '/acceso', '/contacto', '/e']

// ── Recorte por marca ────────────────────────────────────────────────────────
// El mismo repo se despliega en varios proyectos de Vercel. Una instancia acotada
// (Osamayor) solo debe poder llegar a SUS secciones: el resto del panel muestra datos de
// Micelium (Meta Ads, MercadoLibre, apicultura, conversaciones) y no puede quedar accesible
// escribiendo la URL a mano, aunque quien lo intente tenga la clave de esa instancia.
//
// Es una ALLOWLIST y no una lista de bloqueo a propósito: una ruta nueva del panel nace
// bloqueada en las instancias acotadas en vez de nacer expuesta y depender de que alguien
// se acuerde de agregarla acá.
//
// La comprobación va DESPUÉS de validar la sesión (más abajo), así que un visitante sin
// clave ve exactamente lo mismo que antes y no puede sondear qué rutas existen.
const PREFIJOS_MARCA: readonly string[] | null = MARCA.secciones === null
  ? null
  : [
      ...MARCA.secciones,
      // APIs que consumen esas pantallas. Va '/api/widgets' entero y no una lista de
      // sub-rutas: enumerarlas a mano ya dejó afuera /metricas y /media (la pantalla
      // quedaba en "Cargando…" y no se podían subir imágenes), y toda ruta futura del
      // motor de widgets tendría el mismo problema. Todas son del motor de widgets, que
      // es justamente lo que esta instancia sí administra.
      '/api/widgets',
      '/api/resenas',
      // Infraestructura común, no específica de una tienda.
      '/api/auth',
      '/api/tiendanube',
    ]

function permitidoParaLaMarca(pathname: string): boolean {
  if (PREFIJOS_MARCA === null) return true          // Micelium: panel completo.
  // '/404-marca' es el destino del rewrite de más abajo: si no estuviera exento, el propio
  // corte lo bloquearía y el rewrite entraría en bucle.
  if (pathname === '/' || pathname === '/login' || pathname === '/404-marca') return true
  return PREFIJOS_MARCA.some(p => pathname === p || pathname.startsWith(p + '/'))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // En el subdominio de guías, la raíz lleva directo al índice de guías (no a la home del
  // proyecto). Así guias.infomicelium.com.ar/ es la portada de contenido, no la plantilla.
  //
  // Contempla las dos formas: el dominio en uso es `guias.` (con ese) y la comparación
  // anterior solo aceptaba `guia.`, de modo que la raíz del subdominio real nunca redirigía.
  const host = request.headers.get('host') ?? ''
  const esSubdominioGuias = host.startsWith('guia.') || host.startsWith('guias.')
  if (esSubdominioGuias && (pathname === '/' || pathname === '')) {
    return NextResponse.redirect(new URL('/guia', request.url))
  }

  // Lo público se resuelve ANTES de mirar la contraseña: no protege nada, así que no puede
  // depender de que esa variable exista. Si dependiera, un env var faltante dejaría sin
  // servicio a los scripts embebidos en la tienda (geogate, tracking, lead magnet) y a las
  // guías, que es justo lo contrario de lo que se quiere.
  if (PUBLICOS.has(pathname)) return NextResponse.next()
  // Metadatos que leen los buscadores y las apps al compartir un link: van sin login, son
  // justo lo que se consulta antes de que exista una sesión. El robots.txt y el sitemap.xml
  // viven en la raíz; la OG de la portada se sirve en /opengraph-image (las de cada guía caen
  // bajo /guia y ya pasan por PREFIJOS_PUBLICOS).
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml') return NextResponse.next()
  if (pathname.startsWith('/opengraph-image')) return NextResponse.next()
  if (PREFIJOS_PUBLICOS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }
  if (pathname === '/login') return NextResponse.next()
  if (API_ABIERTAS.some(p => pathname.startsWith(p))) return NextResponse.next()

  // Área privada del CLIENTE: identidad y cookie propias, separadas del dashboard interno.
  // Sin sesión de cliente → a /acceso (no al login del panel). El secreto de firma es el
  // mismo del server; solo se usa para integridad de la cookie, no da acceso al dashboard.
  if (pathname === '/mi-equipo' || pathname.startsWith('/mi-equipo/')) {
    const secreto = process.env.DASHBOARD_PASSWORD
    const cli = secreto
      ? await verificarSesionCliente(request.cookies.get(COOKIE_CLIENTE_NOMBRE)?.value, secreto)
      : null
    if (cli) return NextResponse.next()
    return NextResponse.redirect(new URL('/acceso', request.url))
  }

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
  if (sesion) {
    // Sesión válida, pero la instancia puede no tener habilitada esta sección.
    // 404 y no 403: para esta instancia la ruta directamente no existe.
    if (!permitidoParaLaMarca(pathname)) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
      }
      return NextResponse.rewrite(new URL('/404-marca', request.url), { status: 404 })
    }
    return NextResponse.next()
  }

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
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|.*\\.png|.*\\.svg|.*\\.ico|.*\\.webp|.*\\.jpg|.*\\.jpeg).*)'],
}
