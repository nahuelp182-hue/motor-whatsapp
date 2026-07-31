import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { porSlug, configPorDefecto, sanearConfig, sanearReglas, TIPOS, type Contexto } from '@/lib/widgets/tipos'
import { GUIAS_PUBLICAS } from '@/lib/guias'
import { productosTN } from '@/lib/widgets/productos'
import { resenasPublicas } from '@/lib/widgets/datos'

// CRUD del panel. NO figura en API_ABIERTAS del middleware, así que exige sesión de
// dashboard como cualquier otra ruta privada.

const TN_STORE_ID = process.env.TN_STORE_ID ?? '1957278'
const CONTEXTOS: Contexto[] = ['guias', 'tienda', 'producto']

// Páginas reales donde se puede acotar un widget. Se manda al panel para que la regla de
// rutas se elija con casillas y no escribiendo direcciones a mano.
const PAGINAS = [
  { ruta: '/guia', titulo: 'Índice de guías' },
  ...GUIAS_PUBLICAS.map(g => ({ ruta: `/guia/${g.slug}`, titulo: g.titulo })),
  // El blog de Tiendanube (/blog/posts/...) corre como contexto "tienda" (LS.template =
  // "blog-post"). Prefijo /blog = todos los posts. Es el tráfico orgánico de alta intención
  // (51% de las impresiones del sitio) que hoy no se deriva al producto.
  { ruta: '/blog', titulo: 'Blog (todos los posts)' },
  { ruta: '/contacto', titulo: 'Contacto' },
]

/**
 * Las fichas de producto también son páginas donde acotar un widget, y son las únicas que
 * importan para los tipos del contexto "producto". Faltaban: la lista traía solo guías, así
 * que acotar un widget a un producto era imposible desde el panel.
 */
function paginasCon(productos: { nombre: string; ruta: string | null }[]) {
  return [
    ...PAGINAS,
    ...productos
      .filter(p => p.ruta)
      .map(p => ({ ruta: p.ruta as string, titulo: `Ficha: ${p.nombre}` })),
  ]
}

async function storeId(): Promise<string | null> {
  const s = await prisma.store.findFirst({
    where: { tiendanube_store_id: TN_STORE_ID },
    select: { id: true },
  })
  return s?.id ?? null
}

/** Lista los widgets con su rendimiento de los últimos 30 días. */
export async function GET() {
  const sid = await storeId()
  if (!sid)
    return NextResponse.json({
      widgets: [],
      tipos: TIPOS,
      paginas: PAGINAS,
      productos: [],
      resenas: { items: [], promedio: null, total: 0 },
    })

  const widgets = await prisma.widget.findMany({
    where: { store_id: sid },
    orderBy: [{ contexto: 'asc' }, { orden: 'asc' }],
  })

  const desde = new Date(Date.now() - 30 * 86400_000)
  const eventos = await prisma.widgetEvent.groupBy({
    by: ['widget_id', 'tipo'],
    where: { widget_id: { in: widgets.map(w => w.id) }, createdAt: { gte: desde } },
    _count: { _all: true },
  })

  const metricas: Record<string, { impresion: number; interaccion: number; conversion: number }> = {}
  for (const w of widgets) metricas[w.id] = { impresion: 0, interaccion: 0, conversion: 0 }
  for (const e of eventos) {
    const m = metricas[e.widget_id]
    if (m && e.tipo in m) m[e.tipo as keyof typeof m] = e._count._all
  }

  const productos = await productosTN()
  // Las reseñas publicadas viajan al panel para que la vista previa del widget de reseñas
  // dibuje las de verdad —las mismas que va a ver un visitante— y no un relleno de ejemplo.
  const resenas = await resenasPublicas(sid, 8, { modo: 'todas' })

  return NextResponse.json({
    widgets,
    metricas,
    tipos: TIPOS,
    paginas: paginasCon(productos),
    productos,
    resenas,
  })
}

/** Crea un widget con los valores por defecto del tipo. Nace APAGADO a propósito. */
export async function POST(req: NextRequest) {
  const sid = await storeId()
  if (!sid) return NextResponse.json({ error: 'tienda no encontrada' }, { status: 400 })

  const b = (await req.json()) as { tipo?: string; contexto?: string; nombre?: string }
  const tipo = porSlug(String(b.tipo ?? ''))
  if (!tipo) return NextResponse.json({ error: 'tipo desconocido' }, { status: 400 })

  const contexto = String(b.contexto ?? '')
  if (!CONTEXTOS.includes(contexto as Contexto) || !tipo.contextos.includes(contexto as Contexto)) {
    return NextResponse.json({ error: 'contexto no admitido por este tipo' }, { status: 400 })
  }

  const ultimo = await prisma.widget.findFirst({
    where: { store_id: sid, contexto },
    orderBy: { orden: 'desc' },
    select: { orden: true },
  })

  const widget = await prisma.widget.create({
    data: {
      store_id: sid,
      tipo: tipo.slug,
      nombre: String(b.nombre ?? tipo.nombre).slice(0, 120),
      contexto,
      config: configPorDefecto(tipo) as object,
      reglas: sanearReglas({}) as object,
      activo: false,
      orden: (ultimo?.orden ?? 0) + 1,
    },
  })

  return NextResponse.json({ widget })
}

/** Guarda cambios. Todo lo que entra pasa por el saneador del tipo. */
export async function PATCH(req: NextRequest) {
  const sid = await storeId()
  if (!sid) return NextResponse.json({ error: 'tienda no encontrada' }, { status: 400 })

  const b = (await req.json()) as {
    id?: string
    nombre?: string
    activo?: boolean
    orden?: number
    config?: unknown
    reglas?: unknown
  }

  const id = String(b.id ?? '')
  // El where lleva store_id: sin eso, un id de otra tienda se podría editar desde acá.
  const actual = await prisma.widget.findFirst({ where: { id, store_id: sid } })
  if (!actual) return NextResponse.json({ error: 'no existe' }, { status: 404 })

  const tipo = porSlug(actual.tipo)
  if (!tipo) return NextResponse.json({ error: 'tipo retirado del código' }, { status: 409 })

  const datos: Record<string, unknown> = {}
  if (b.nombre !== undefined) datos.nombre = String(b.nombre).slice(0, 120)
  if (b.activo !== undefined) datos.activo = b.activo === true
  if (b.orden !== undefined) datos.orden = Number(b.orden) || 0
  if (b.config !== undefined) datos.config = sanearConfig(tipo, b.config)
  if (b.reglas !== undefined) datos.reglas = sanearReglas(b.reglas)

  const widget = await prisma.widget.update({ where: { id }, data: datos })
  return NextResponse.json({ widget })
}

export async function DELETE(req: NextRequest) {
  const sid = await storeId()
  const id = req.nextUrl.searchParams.get('id') ?? ''
  const actual = await prisma.widget.findFirst({ where: { id, store_id: sid ?? '' } })
  if (!actual) return NextResponse.json({ error: 'no existe' }, { status: 404 })

  await prisma.widget.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
