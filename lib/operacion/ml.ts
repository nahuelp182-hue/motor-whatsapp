// MercadoLibre: la mitad del negocio que el panel no veía.
//
// El Resumen mostraba solo Tiendanube, así que "ventas del período" era una afirmación
// falsa por omisión: MICELIUMSTORE factura en paralelo y no aparecía por ningún lado. Peor
// que un número que falta es un número que parece completo.
//
// El refresh_token de ML lo rota el VPS en cada uso y es su dueño único: si Vercel
// consultara la API, invalidaría el token del autoresponder. Por eso el VPS empuja y acá
// solo se lee, igual que con el corte de caja.

import { prisma } from '@/lib/prisma'
import { CATALOGO } from '@/lib/cron-heartbeat'

export type Reputacion = {
  nivel: string
  completadas: number
  canceladas: number
  reclamos: number | null
  demoras: number | null
  leido: string
}

export type VentasMl = {
  ventas: number
  pedidos: number
  ticket: number | null
  /** Facturación de la ventana anterior del mismo largo, para la variación. */
  ventasPrev: number
  pedidosPrev: number
  porCanal: Array<{ canal: string; ventas: number; pedidos: number }>
  reputacion: Reputacion | null
  /** Última vez que el VPS empujó algo. Sin esto, "0 ventas" y "nadie miró" son iguales. */
  corte: string | null
  fresco: boolean
}

/**
 * Lee las ventas de una ventana y de la anterior del mismo largo.
 *
 * Las canceladas quedan afuera de la facturación: una orden cancelada no es plata que entró,
 * y sumarlas infla el ticket promedio justo cuando algo salió mal. Se guardan igual porque
 * la reputación se juega ahí.
 */
export async function leerMl(desde: Date, hasta: Date): Promise<VentasMl> {
  const largo = hasta.getTime() - desde.getTime()
  const prevDesde = new Date(desde.getTime() - largo)

  const [filas, previas, rep, ultima] = await Promise.all([
    prisma.ventaMl.findMany({ where: { fecha: { gte: desde, lte: hasta }, estado: 'paid' } }),
    prisma.ventaMl.findMany({ where: { fecha: { gte: prevDesde, lt: desde }, estado: 'paid' } }),
    prisma.reputacionMl.findFirst({ orderBy: { leido_at: 'desc' } }),
    prisma.ventaMl.findFirst({ orderBy: { creado_at: 'desc' }, select: { creado_at: true } }),
  ])

  const ventas = filas.reduce((s, f) => s + f.total, 0)

  const canales = new Map<string, { ventas: number; pedidos: number }>()
  for (const f of filas) {
    const c = canales.get(f.canal) ?? { ventas: 0, pedidos: 0 }
    c.ventas += f.total
    c.pedidos += 1
    canales.set(f.canal, c)
  }

  // La frescura se mide contra el push más reciente, no contra la venta más reciente: en
  // temporada baja (feb–sep) puede pasar una semana sin una sola venta apícola, y eso es el
  // negocio, no una falla. Lo que sí es una falla es que nadie haya preguntado.
  const corte = rep?.leido_at ?? ultima?.creado_at ?? null
  const horas = corte ? (Date.now() - corte.getTime()) / 3_600_000 : null

  return {
    ventas,
    pedidos: filas.length,
    ticket: filas.length ? ventas / filas.length : null,
    ventasPrev: previas.reduce((s, f) => s + f.total, 0),
    pedidosPrev: previas.length,
    porCanal: [...canales.entries()]
      .map(([canal, v]) => ({ canal, ...v }))
      .sort((a, b) => b.ventas - a.ventas),
    reputacion: rep
      ? {
          nivel: rep.nivel,
          completadas: rep.completadas,
          canceladas: rep.canceladas,
          reclamos: rep.reclamos,
          demoras: rep.demoras,
          leido: rep.leido_at.toISOString(),
        }
      : null,
    corte: corte?.toISOString() ?? null,
    fresco: horas !== null && horas <= (CATALOGO['operacion-ml']?.maxHoras ?? 3),
  }
}
