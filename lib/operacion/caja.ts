// Caja: ¿estamos donde queríamos?
//
// Cobrado NO es lo mismo que disponible. MercadoPago retiene una parte del neto y la
// libera después; tratar el neto como plata en mano es lo que hace creer que hay fondos
// que todavía no están. Por eso `liberado` y `pendiente` viajan separados en todos lados.
//
// El cálculo lo hace el VPS (tiene los tokens de MercadoPago que Vercel no tiene) y empuja
// el resultado. Acá solo se guarda y se lee.

import { prisma } from '@/lib/prisma'
import { leerProduccion } from '@/lib/operacion/produccion'
import { RETENCION_MP_DIAS, PLAZO_PROVEEDORES_DIAS } from '@/lib/supuestos'

export type LineaCaja = { nombre: string; bruto: number; neto: number; liberado: number; pendiente: number }

export type Corte = {
  id: string
  desde: string
  hasta: string
  bruto: number
  neto: number
  liberado: number
  pendiente: number
  lineas: LineaCaja[]
}

export type Caja = {
  actual: Corte | null
  previo: Corte | null
  /** Variación de cada concepto contra la quincena anterior. Vacío si no hay con qué comparar. */
  comparacion: Array<{ concepto: string; actual: number; previo: number; variacion: number }>
  /**
   * Cuánto se llevan MercadoPago y Tiendanube: (bruto − neto) / bruto.
   *
   * NO es el margen bruto y no se compara contra el objetivo del 60%. El margen bruto
   * necesita el costo de la mercadería vendida, que no viene en el corte: mezclarlos daba
   * ~94% contra un objetivo de 60%, o sea verde permanente por construcción — un indicador
   * que no puede ponerse en rojo no es un indicador.
   */
  comisiones: number | null
  /** Días de inventario + días hasta cobrar − días para pagar. Negativo = el proveedor financia. */
  ciclo: { inventario: number | null; cobro: number; pago: number; total: number | null }
  retencionDias: number
}

/**
 * Días que el stock tarda en venderse: la primera pata del ciclo de efectivo.
 *
 * Es exactamente la cobertura que calcula Producción, y sale de ahí a propósito. Calcularla
 * de nuevo con otra consulta daría dos números distintos para la misma cosa en cuanto una de
 * las dos cambie de criterio, y el ciclo de efectivo quedaría discutiendo con la pantalla de
 * al lado.
 */
async function diasInventario(): Promise<number | null> {
  const { coberturaDias } = await leerProduccion()
  return coberturaDias
}

function aCorte(r: {
  id: string; desde: Date; hasta: Date; bruto: number; neto: number; liberado: number; pendiente: number; lineas: unknown
}): Corte {
  return {
    id: r.id,
    desde: r.desde.toISOString(),
    hasta: r.hasta.toISOString(),
    bruto: r.bruto,
    neto: r.neto,
    liberado: r.liberado,
    pendiente: r.pendiente,
    // `lineas` es JSON libre porque lo escribe el VPS: se valida al entrar (ver la ruta),
    // no al salir. Si viniera algo raro, mejor una lista vacía que una pantalla rota.
    lineas: Array.isArray(r.lineas) ? (r.lineas as LineaCaja[]) : [],
  }
}

const variacion = (a: number, p: number) => (p ? ((a - p) / p) * 100 : 0)

export async function leerCaja(): Promise<Caja> {
  const cortes = await prisma.corteCaja.findMany({ orderBy: { desde: 'desc' }, take: 2 })
  const actual = cortes[0] ? aCorte(cortes[0]) : null
  const previo = cortes[1] ? aCorte(cortes[1]) : null

  const comparacion =
    actual && previo
      ? ([
          ['Neto cobrado', actual.neto, previo.neto],
          ['Bruto', actual.bruto, previo.bruto],
          ['Liberado', actual.liberado, previo.liberado],
          ['Pendiente', actual.pendiente, previo.pendiente],
        ] as const).map(([concepto, a, p]) => ({ concepto, actual: a, previo: p, variacion: variacion(a, p) }))
      : []

  const comisiones = actual && actual.bruto ? (actual.bruto - actual.neto) / actual.bruto : null
  const inv = await diasInventario()

  return {
    actual,
    previo,
    comparacion,
    comisiones,
    ciclo: {
      inventario: inv,
      cobro: RETENCION_MP_DIAS,
      pago: PLAZO_PROVEEDORES_DIAS,
      total: inv === null ? null : inv + RETENCION_MP_DIAS - PLAZO_PROVEEDORES_DIAS,
    },
    retencionDias: RETENCION_MP_DIAS,
  }
}
