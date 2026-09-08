// Resumen: qué está pasando ahora.
//
// Es la vista de arranque, así que la tentación es meterle todo. La regla acá es la
// contraria: cada número del Resumen tiene que existir en su sección con la derivación
// completa. Si un dato no vive en ninguna sección, no entra — un indicador sin pantalla
// donde discutirlo es un número que nadie puede auditar.
//
// Lo que todavía no tiene fuente (MercadoLibre, stock, MercadoPago, conversión web) NO se
// devuelve con ceros: se devuelve `null` y la pantalla lo dice. Un cero en "ventas de
// MercadoLibre" se lee como "no vendimos", que es una afirmación falsa sobre el negocio.

import { fetchTNOrdersClassified } from '@/lib/attribution'
import { totalesMeta } from '@/lib/meta-insights'
import { leerLogistica } from '@/lib/operacion/envios'
import { retornoSobreCac, margenPonderado, TECHO_CAC } from '@/lib/supuestos'

const DIA = 86_400_000

export type Rango = '24h' | '7d' | '30d'

const DIAS: Record<Rango, number> = { '24h': 1, '7d': 7, '30d': 30 }

const iso = (d: Date) => d.toISOString().slice(0, 10)

/** Ventana del rango y la ventana inmediatamente anterior, del mismo largo, para comparar. */
function ventanas(rango: Rango) {
  const n = DIAS[rango]
  const hoy = new Date()
  const desde = new Date(hoy.getTime() - (n - 1) * DIA)
  const previoHasta = new Date(desde.getTime() - DIA)
  const previoDesde = new Date(previoHasta.getTime() - (n - 1) * DIA)
  return {
    since: iso(desde), until: iso(hoy),
    pSince: iso(previoDesde), pUntil: iso(previoHasta),
  }
}

/** Variación porcentual contra el período anterior. Null si no hay base con qué comparar. */
function variacion(actual: number, previo: number): number | null {
  if (!previo) return null
  return ((actual - previo) / previo) * 100
}

export type Resumen = {
  rango: Rango
  periodo: { since: string; until: string }
  /** Lo que sí se pudo leer. */
  ventasTN: number
  pedidos: number
  ticket: number | null
  varVentas: number | null
  varPedidos: number | null
  gastoMeta: number
  metaOk: boolean
  /** Gasto de Meta sobre los pedidos del período. NO es el CAC incremental. */
  cacBruto: number | null
  retorno: number | null
  margenPorPedido: number
  techoCac: number
  envios: { frenados: number; enTransito: number; sinDespachar: number; promedioDias: number | null }
  /** Lo que todavía no tiene fuente, con el motivo. La pantalla lo muestra tal cual. */
  sinFuente: Record<string, string>
}

export async function leerResumen(rango: Rango = '7d'): Promise<Resumen> {
  const v = ventanas(rango)

  const [ordenes, previas, meta, logistica] = await Promise.all([
    fetchTNOrdersClassified(v.since, v.until),
    fetchTNOrdersClassified(v.pSince, v.pUntil),
    totalesMeta(v.since, v.until),
    leerLogistica(21),
  ])

  const ventasTN = ordenes.reduce((s, o) => s + o.total, 0)
  const ventasPrev = previas.reduce((s, o) => s + o.total, 0)
  const pedidos = ordenes.length

  // CAC bruto: todo el gasto de Meta dividido por TODOS los pedidos del período, vengan de
  // donde vengan. No es el costo de adquirir un cliente por Meta ni el incremental: es el
  // piso más honesto que se puede calcular sin holdout, y se rotula así en la pantalla.
  const cacBruto = pedidos > 0 && meta.spend > 0 ? meta.spend / pedidos : null

  return {
    rango,
    periodo: { since: v.since, until: v.until },
    ventasTN,
    pedidos,
    ticket: pedidos ? ventasTN / pedidos : null,
    varVentas: variacion(ventasTN, ventasPrev),
    varPedidos: variacion(pedidos, previas.length),
    gastoMeta: meta.spend,
    metaOk: meta.ok,
    cacBruto,
    retorno: cacBruto ? retornoSobreCac(cacBruto) : null,
    margenPorPedido: margenPonderado(),
    techoCac: TECHO_CAC,
    envios: {
      frenados: logistica.kpis.frenados,
      enTransito: logistica.kpis.enTransito,
      sinDespachar: logistica.kpis.sinDespachar,
      promedioDias: logistica.kpis.promedioDias,
    },
    sinFuente: {
      'Ventas de MercadoLibre':
        'El token de ML lo rota el VPS, que es su dueño único: Vercel no puede consultarlo sin invalidarlo. Entra cuando el VPS empuje sus ventas a un endpoint propio.',
      'Reputación de MercadoLibre':
        'Misma razón que las ventas de ML: se resuelve con el mismo push del VPS.',
      'Stock de INC101':
        'El stock se cuenta a mano y todavía no hay dónde cargarlo. Lo habilita la pantalla de Producción.',
      'Disponible en MercadoPago':
        'El corte quincenal lo calcula un script fuera de esta app. Entra cuando el VPS lo empuje, junto con la pantalla de Caja.',
      'Conversión web':
        'El tracking propio no ve el checkout de Tiendanube (lo ejecuta su servidor, no el navegador), así que la tasa que saldría de acá estaría mal. La fuente buena es GA4 y todavía no está conectada.',
    },
  }
}
