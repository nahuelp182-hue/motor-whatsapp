// Adquisición: ¿la plata que entra, vuelve?
//
// El CAC que decide es el INCREMENTAL: cuántas compras hay de más los días que Meta está
// prendido, contra el piso orgánico. El CPA que reporta Meta no contesta eso, y el gasto
// dividido por los pedidos tampoco. Ninguno de los dos se puede convertir en el otro con
// una cuenta — hace falta un holdout medido.
//
// Así que esta pantalla muestra lo que sí se puede sostener (gasto real, pedidos reales,
// atribución de Tiendanube, frecuencia por adset) y deja el incremental declarado como lo
// que falta, en vez de disfrazar el CPA de CAC.

import { fetchTNOrdersClassified, aggregateByChannel, CHANNEL_LABEL, CHANNEL_COLOR, type TNClass } from '@/lib/attribution'
import { totalesMeta, frecuenciaPorAdset, type Adset } from '@/lib/meta-insights'
import {
  TECHO_CAC, UMBRAL_FRECUENCIA, ELASTICIDAD_CAC, MIX_INCUBADORA,
  margenPonderado, ltv, retornoSobreCac,
} from '@/lib/supuestos'

const DIA = 86_400_000
const iso = (d: Date) => d.toISOString().slice(0, 10)

export type Canal = { key: string; label: string; color: string; orders: number; revenue: number }

export type Escenario = {
  gastoDia: number
  cac: number
  ventasMes: number
  margenMes: number
  estado: 'actual' | 'en curso' | 'el techo' | 'fuera'
}

export type Adquisicion = {
  periodo: { since: string; until: string; dias: number }
  gasto: number
  metaOk: boolean
  pedidos: number
  facturacion: number
  /** Gasto ÷ pedidos del período. Es un piso, no el CAC incremental. */
  costoPorPedido: number | null
  techoCac: number
  retorno: number | null
  margenPorPedido: number
  ltv: number
  /** Cómo cambia el retorno si el mix no es el que se supone. */
  sensibilidadMix: Array<{ mix: number; etiqueta: string; retorno: number | null; actual: boolean }>
  canales: Canal[]
  adsets: Adset[]
  umbralFrecuencia: number
  escenarios: Escenario[]
  elasticidad: number
}

/**
 * Escenarios de escalado.
 *
 * HIPÓTESIS, no predicción: se asume que el CAC sube `ELASTICIDAD_CAC` cada vez que se
 * duplica el gasto diario, porque los públicos baratos se agotan primero. La curva real no
 * está medida. Sirve para ver el ORDEN de magnitud de dónde queda el techo, no para
 * comprometerse con una fila.
 */
function escenarios(gastoDiaActual: number, cacActual: number): Escenario[] {
  if (gastoDiaActual <= 0 || cacActual <= 0) return []
  const margen = margenPonderado()
  // Múltiplos del gasto actual y no montos fijos ($20.000, $30.000…). Con montos fijos, en
  // cuanto el gasto real superaba el primero, la tabla salía desordenada y proyectaba hacia
  // ATRÁS: log2 daba negativo, se clampeaba a cero y la fila decía que gastar menos cuesta
  // lo mismo por venta. El modelo solo sabe extrapolar hacia arriba, así que solo se
  // muestran escalones hacia arriba.
  return [1, 1.5, 2, 3].map(f => {
    const g = gastoDiaActual * f
    const cac = cacActual * Math.pow(1 + ELASTICIDAD_CAC, Math.log2(f))
    const ventasMes = (g * 30) / cac
    return {
      gastoDia: Math.round(g),
      cac: Math.round(cac),
      ventasMes,
      margenMes: ventasMes * margen,
      estado:
        f === 1 ? 'actual'
        : cac > TECHO_CAC ? 'fuera'
        : cac >= TECHO_CAC * 0.95 ? 'el techo'
        : 'en curso',
    }
  })
}

export async function leerAdquisicion(dias = 30): Promise<Adquisicion> {
  const hoy = new Date()
  const since = iso(new Date(hoy.getTime() - (dias - 1) * DIA))
  const until = iso(hoy)

  const [ordenes, meta, adsets] = await Promise.all([
    fetchTNOrdersClassified(since, until),
    totalesMeta(since, until),
    frecuenciaPorAdset(since, until),
  ])

  const porCanal = aggregateByChannel(ordenes)
  const canales: Canal[] = (Object.keys(porCanal) as TNClass[]).map(k => ({
    key: k,
    label: CHANNEL_LABEL[k],
    color: CHANNEL_COLOR[k],
    orders: porCanal[k].orders,
    revenue: porCanal[k].revenue,
  }))

  const pedidos = ordenes.length
  const facturacion = ordenes.reduce((s, o) => s + o.total, 0)
  const costoPorPedido = pedidos > 0 && meta.spend > 0 ? meta.spend / pedidos : null
  const gastoDia = meta.spend / dias

  return {
    periodo: { since, until, dias },
    gasto: meta.spend,
    metaOk: meta.ok,
    pedidos,
    facturacion,
    costoPorPedido,
    techoCac: TECHO_CAC,
    retorno: costoPorPedido ? retornoSobreCac(costoPorPedido) : null,
    margenPorPedido: margenPonderado(),
    ltv: ltv(),
    sensibilidadMix: [0.2, 0.4, 0.6, 0.8].map(mix => ({
      mix,
      etiqueta: `${Math.round(mix * 100)}/${Math.round((1 - mix) * 100)}`,
      retorno: costoPorPedido ? retornoSobreCac(costoPorPedido, mix) : null,
      actual: Math.abs(mix - MIX_INCUBADORA) < 0.001,
    })),
    canales: canales.filter(c => c.orders > 0).sort((a, b) => b.revenue - a.revenue),
    // Solo los que entregaron: un adset sin gasto en el período no tiene frecuencia que
    // vigilar, y llenar la tabla de ceros esconde a los dos que sí importan.
    adsets: adsets.filter(a => a.spend > 0).sort((a, b) => (b.frecuencia ?? 0) - (a.frecuencia ?? 0)),
    umbralFrecuencia: UMBRAL_FRECUENCIA,
    escenarios: costoPorPedido ? escenarios(gastoDia, costoPorPedido) : [],
    elasticidad: ELASTICIDAD_CAC,
  }
}
