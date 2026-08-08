import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Métricas del motor de widgets: cuánto se vio, cuánto se tocó y cuánta plata movió cada
// uno. Es la razón principal para tener motor propio en vez de una app de terceros —
// permite apagar lo que no sirve en vez de acumular widgets por las dudas.
//
// Detrás de la sesión del dashboard: el middleware protege todo /api/widgets salvo config
// y evento.

const TN_STORE_ID = process.env.TN_STORE_ID ?? '1957278'

type Fila = { widget_id: string; tipo: string; createdAt: Date; meta: unknown; vid: string | null }

/** Día en horario argentino. Sin esto, todo lo de la noche cae en el día siguiente. */
function diaLocal(d: Date): string {
  return new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10)
}

function montoDe(meta: unknown): number {
  const v = (meta as { valor?: unknown } | null)?.valor
  return typeof v === 'number' && isFinite(v) ? v : 0
}

// Ventana de cosido: mismo criterio que curiosos_cosido.py (WINDOW_H=48h + SLACK_MIN=30min
// hacia atrás desde el pago). Acá se mide desde el evento hacia adelante, así que se usa el
// máximo de esa ventana para no perder compras que tardaron en concretarse.
const VENTANA_COSIDO_MS = 48.5 * 3600_000

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
    select: { widget_id: true, tipo: true, createdAt: true, meta: true, vid: true },
  })) as Fila[]

  // Valor REAL movido: cruza las conversiones (vid) contra Visitor.total_orden, que
  // curiosos_cosido.py sella cuando esa persona termina comprando. Es un proxy más fiel
  // que meta.valor (lo que el widget agregó) porque cuenta la orden completa que esa
  // sesión terminó pagando — no distingue línea de producto porque WidgetEvent no la
  // guarda. Ver prisma/sql/visitor_total_orden.sql.
  const vidsConversion = Array.from(
    new Set(eventos.filter(e => e.tipo === 'conversion' && e.vid).map(e => e.vid as string))
  )
  const visitors = vidsConversion.length
    ? await prisma.visitor.findMany({
        where: { store_id: store.id, vid: { in: vidsConversion }, purchased_at: { not: null } },
        select: { vid: true, total_orden: true, purchased_at: true },
      })
    : []
  // Solo cuenta si la compra quedó sellada dentro de la ventana de cosido a partir del
  // evento — sin esto, un vid reciclado meses después podría cruzarse con una conversión
  // vieja sin relación real.
  const eventoPorVid = new Map(
    eventos.filter(e => e.tipo === 'conversion' && e.vid).map(e => [e.vid as string, e.createdAt])
  )
  const totalOrdenPorVid = new Map(
    visitors
      .filter(v => {
        const evtAt = eventoPorVid.get(v.vid)
        if (!evtAt || !v.purchased_at) return false
        const delta = v.purchased_at.getTime() - evtAt.getTime()
        // delta negativo = compró ANTES de este evento (ej. cliente que ya compró y
        // vuelve a tocar un widget, como el de reseñas post-entrega) — no es la venta
        // que originó esta conversión, no se le atribuye.
        return delta >= 0 && delta <= VENTANA_COSIDO_MS
      })
      .map(v => [v.vid, v.total_orden ? Number(v.total_orden) : 0])
  )

  const vacio = () => ({ impresion: 0, interaccion: 0, conversion: 0, monto: 0, montoReal: 0 })

  const total = vacio()
  const porDia: Record<string, ReturnType<typeof vacio>> = {}
  const porWidget: Record<string, ReturnType<typeof vacio>> = {}
  // Un mismo vid puede convertir en más de un widget en la ventana (ej. cross-sell +
  // upsell en la misma sesión); no se puede sumar dos veces la misma orden al total
  // general sin inflar "Movido" — sí puede sumarse a cada widget individualmente
  // (cada uno de hecho contribuyó a esa venta).
  const vidsYaContadosEnTotal = new Set<string>()

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

    if (clave === 'conversion' && e.vid && totalOrdenPorVid.has(e.vid)) {
      const real = totalOrdenPorVid.get(e.vid) ?? 0
      if (wid) wid.montoReal += real
      if (dia) dia.montoReal += real
      if (!vidsYaContadosEnTotal.has(e.vid)) {
        vidsYaContadosEnTotal.add(e.vid)
        total.montoReal += real
      }
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
