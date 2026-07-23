import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Métricas del motor de widgets: cuánto se vio, cuánto se tocó y cuánta plata movió cada
// uno. Es la razón principal para tener motor propio en vez de una app de terceros —
// permite apagar lo que no sirve en vez de acumular widgets por las dudas.
//
// Detrás de la sesión del dashboard: el middleware protege todo /api/widgets salvo config
// y evento.

const TN_STORE_ID = process.env.TN_STORE_ID ?? '1957278'

type Fila = { widget_id: string; tipo: string; createdAt: Date; meta: unknown }

/** Día en horario argentino. Sin esto, todo lo de la noche cae en el día siguiente. */
function diaLocal(d: Date): string {
  return new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10)
}

function montoDe(meta: unknown): number {
  const v = (meta as { valor?: unknown } | null)?.valor
  return typeof v === 'number' && isFinite(v) ? v : 0
}

export async function GET(req: NextRequest) {
  const dias = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get('dias') ?? 7)))

  const store = await prisma.store.findFirst({
    where: { tiendanube_store_id: TN_STORE_ID },
    select: { id: true },
  })
  if (!store) return NextResponse.json({ error: 'tienda no encontrada' }, { status: 400 })

  const widgets = await prisma.widget.findMany({
    where: { store_id: store.id },
    select: { id: true, nombre: true, tipo: true, activo: true, contexto: true },
  })

  const desde = new Date()
  desde.setHours(0, 0, 0, 0)
  desde.setDate(desde.getDate() - (dias - 1))

  const eventos = (await prisma.widgetEvent.findMany({
    where: { widget_id: { in: widgets.map(w => w.id) }, createdAt: { gte: desde } },
    select: { widget_id: true, tipo: true, createdAt: true, meta: true },
  })) as Fila[]

  const vacio = () => ({ impresion: 0, interaccion: 0, conversion: 0, monto: 0 })

  const total = vacio()
  const porDia: Record<string, ReturnType<typeof vacio>> = {}
  const porWidget: Record<string, ReturnType<typeof vacio>> = {}

  // Todos los días del período van en la serie, incluso los que no tuvieron nada: un
  // gráfico que se saltea los días vacíos hace parecer constante algo que se cortó.
  for (let i = 0; i < dias; i++) {
    const d = new Date(desde)
    d.setDate(d.getDate() + i)
    porDia[diaLocal(d)] = vacio()
  }
  for (const w of widgets) porWidget[w.id] = vacio()

  for (const e of eventos) {
    const clave = e.tipo as 'impresion' | 'interaccion' | 'conversion'
    if (!(clave in total)) continue
    const monto = montoDe(e.meta)
    const dia = porDia[diaLocal(e.createdAt)]
    const wid = porWidget[e.widget_id]

    total[clave]++
    total.monto += monto
    if (dia) {
      dia[clave]++
      dia.monto += monto
    }
    if (wid) {
      wid[clave]++
      wid.monto += monto
    }
  }

  return NextResponse.json({
    dias,
    total,
    activos: widgets.filter(w => w.activo).length,
    serie: Object.entries(porDia).map(([fecha, v]) => ({ fecha, ...v })),
    porWidget: widgets
      .map(w => ({ ...w, ...porWidget[w.id] }))
      .sort((a, b) => b.impresion - a.impresion),
  })
}
