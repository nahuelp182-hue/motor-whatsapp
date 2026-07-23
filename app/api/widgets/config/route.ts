import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { porSlug, type Contexto } from '@/lib/widgets/tipos'
import { resenasPublicas } from '@/lib/widgets/datos'
import { productosTN } from '@/lib/widgets/productos'

// Config que consume public/mic.js. Pública y con CORS abierto: la pide el storefront de
// Tiendanube, que es otro origen. Devuelve SOLO widgets activos y solo lo que se dibuja
// (nada de reglas internas ni ids de tienda).

const TN_STORE_ID = process.env.TN_STORE_ID ?? '1957278'
const CONTEXTOS: Contexto[] = ['guias', 'tienda', 'producto']

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET(req: NextRequest) {
  const ctx = req.nextUrl.searchParams.get('ctx') ?? ''
  if (!CONTEXTOS.includes(ctx as Contexto)) {
    return NextResponse.json({ error: 'contexto inválido' }, { status: 400, headers: CORS })
  }

  const store = await prisma.store.findFirst({
    where: { tiendanube_store_id: TN_STORE_ID, is_active: true },
    select: { id: true },
  })
  if (!store) return NextResponse.json({ widgets: [] }, { headers: CORS })

  const filas = await prisma.widget.findMany({
    where: { store_id: store.id, contexto: ctx, activo: true },
    orderBy: { orden: 'asc' },
    select: { id: true, tipo: true, config: true, reglas: true },
  })

  const ahora = Date.now()
  const widgets = []

  for (const w of filas) {
    const tipo = porSlug(w.tipo)
    if (!tipo) continue // tipo retirado del código: no se sirve, pero la fila sobrevive

    // La ventana de fechas se evalúa acá y no en el navegador: si el widget venció, ni
    // siquiera viaja. Un widget vencido que llega al cliente es un widget que alguien
    // puede ver mirando el tráfico de red.
    const r = (w.reglas ?? {}) as { desde?: string | null; hasta?: string | null }
    if (r.desde && Date.parse(r.desde) > ahora) continue
    if (r.hasta && Date.parse(r.hasta) < ahora) continue

    const salida: Record<string, unknown> = {
      id: w.id,
      tipo: w.tipo,
      config: w.config,
      reglas: { rutas: (w.reglas as { rutas?: string[] })?.rutas ?? [], dispositivo: (w.reglas as { dispositivo?: string })?.dispositivo ?? 'todos' },
    }

    if (tipo.datosVivos === 'productos') {
      // Nombre, precio e imagen se resuelven acá contra el catálogo real. El widget guarda
      // solo el id: así un cambio de precio en Tiendanube se ve en la página sin que nadie
      // toque el widget.
      const catalogo = await productosTN()
      const items = ((w.config as Record<string, unknown>)?.items ?? []) as Array<Record<string, unknown>>
      salida.datos = items
        .map(i => {
          const p = catalogo.find(x => x.id === String(i.producto ?? ''))
          return p ? { ...p, nota: String(i.nota ?? '') } : null
        })
        .filter(Boolean)
    }

    if (tipo.datosVivos === 'resenas') {
      const cantidad = Number((w.config as Record<string, unknown>)?.cantidad ?? 6)
      salida.datos = await resenasPublicas(store.id, cantidad)
    }

    widgets.push(salida)
  }

  return NextResponse.json(
    { widgets },
    {
      headers: {
        ...CORS,
        // Un minuto en el borde: un cambio en el panel se ve casi enseguida, y una ráfaga
        // de tráfico no se traduce en una ráfaga de consultas a la base.
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    },
  )
}
