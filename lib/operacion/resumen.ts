// Resumen: qué está pasando ahora.
//
// Es la vista de arranque, así que la tentación es meterle todo. La regla acá es la
// contraria: cada número del Resumen tiene que existir en su sección con la derivación
// completa. Si un dato no vive en ninguna sección, no entra — un indicador sin pantalla
// donde discutirlo es un número que nadie puede auditar.
//
// Lo que todavía no tiene fuente NO se devuelve con ceros: se devuelve `null` y la pantalla
// lo dice. Un cero en "ventas de MercadoLibre" se lee como "no vendimos", que es una
// afirmación falsa sobre el negocio.
//
// Ese mismo criterio vale para las fuentes que SÍ existen pero dependen de un cron: si el
// que llena la tabla deja de correr, la consulta sigue devolviendo ceros bien formados y
// nadie se entera. Por eso Logística viaja con su fecha de corte, y `sinFuente` se deriva
// del estado real en vez de estar escrita a mano.

import { prisma } from '@/lib/prisma'
import { fetchTNOrdersClassified } from '@/lib/attribution'
import { totalesMeta } from '@/lib/meta-insights'
import { leerLogistica } from '@/lib/operacion/envios'
import { leerMl, type VentasMl } from '@/lib/operacion/ml'
import { leerGa4, type Ga4 } from '@/lib/operacion/ga4'
import { CATALOGO } from '@/lib/cron-heartbeat'
import { ventanaPrevia, etiquetaRango, type Rango } from '@/lib/operacion/rango'
import { retornoSobreCac, margenPonderado, TECHO_CAC } from '@/lib/supuestos'

/** Variación porcentual contra el período anterior. Null si no hay base con qué comparar. */
function variacion(actual: number, previo: number): number | null {
  if (!previo) return null
  return ((actual - previo) / previo) * 100
}

export type Resumen = {
  rango: Rango
  /** Cómo se nombra el período en pantalla: "últimos 14 días" o el rango literal. */
  etiqueta: string
  periodo: { since: string; until: string }
  /** Lo que sí se pudo leer. */
  ventasTN: number
  /** Tiendanube + MercadoLibre. Es la facturación del negocio, no la de un canal. */
  ventasTotales: number | null
  ml: VentasMl
  web: {
    ga4: Ga4
    /**
     * Pedidos de Tiendanube sobre sesiones de GA4. El numerador es de TN a propósito:
     * ver el encabezado de lib/operacion/ga4.
     */
    conversion: number | null
  }
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
  /**
   * Logística. `fresco` es la diferencia entre "no hay envíos abiertos" y "nadie los miró":
   * la tabla la llena un cron del VPS, y si ese cron se cae `leerLogistica` sigue devolviendo
   * ceros perfectamente formados. Un cero sin fecha de corte es el mismo cero mentiroso que
   * este archivo se niega a devolver para MercadoLibre, así que acá también viaja el motivo.
   */
  envios: {
    frenados: number; enTransito: number; sinDespachar: number; promedioDias: number | null
    corte: string | null; fresco: boolean; horasDesdeCorte: number | null
    /**
     * Compradores que quedaron sin material. `manualFresco` es la misma distinción que
     * `fresco` para los envíos: en false, `sinManual` es 0 porque el push de acuses no
     * llegó, NO porque todos lo hayan recibido.
     */
    sinManual: number; sinMaterial: number; manualFresco: boolean
  }
  /** Lo que todavía no tiene fuente, con el motivo. La pantalla lo muestra tal cual. */
  sinFuente: Record<string, string>
}

/**
 * Qué falta y por qué, derivado del estado real y no escrito a mano.
 *
 * La versión anterior era un objeto literal: la tarjeta prometía que "la lista se achica
 * sola a medida que cada fuente entra" y en realidad había que editar este archivo y
 * desplegar. Dos de los cinco motivos ya eran falsos cuando se leyeron (el stock SÍ tenía
 * dónde cargarse, la pantalla de Caja YA existía) y nadie se enteró, porque un texto fijo
 * no puede quedar en evidencia. Ahora cada ítem entra solo si su fuente sigue vacía.
 */
async function faltantes(logisticaFresca: boolean, manualFresco: boolean, ml: VentasMl, ga4: Ga4): Promise<Record<string, string>> {
  const [conteos, cortes] = await Promise.all([
    prisma.conteoStock.count(),
    prisma.corteCaja.count(),
  ])
  const falta: Record<string, string> = {}

  if (!conteos) {
    falta['Stock de INC101'] =
      'El conteo se hace a mano y todavía no se cargó ninguno. Se carga en Producción y desaparece de esta lista solo.'
  }
  if (!cortes) {
    falta['Disponible en MercadoPago'] =
      'El corte quincenal lo calcula mp_ventas_split.py en el VPS los días 1 y 15. Falta que lo empuje a /api/operacion/caja: la pantalla y el endpoint ya están.'
  }
  if (!logisticaFresca) {
    falta['Estado de los envíos'] =
      'El cron operacion-envios no dejó un corte reciente. Los envíos abiertos que se muestren pueden estar viejos: Andreani solo informa el presente y lo que no se consultó no se recupera.'
  }

  if (!manualFresco) {
    falta['Manuales entregados'] =
      'El VPS no empuja los acuses de manual (manuales_push.py, cron 40 */3). Sin eso no se puede saber quién quedó sin material: el control se calla en vez de marcar como faltante a gente que sí lo recibió.'
  }

  if (!ml.fresco) {
    falta['Ventas de MercadoLibre'] = ml.corte
      ? `El VPS no empuja las ventas de ML desde ${new Date(ml.corte).toLocaleString('es-AR')}. Lo que se muestre de ML es de esa hora.`
      : 'El token de ML lo rota el VPS, que es su dueño único: Vercel no puede consultarlo sin invalidarlo. Falta que el cron del VPS empuje a /api/operacion/ml — el endpoint ya está.'
  }
  if (!ml.reputacion) {
    falta['Reputación de MercadoLibre'] =
      'Entra por el mismo push que las ventas de ML, en el campo `reputacion` del payload.'
  }
  if (!ga4.ok) {
    falta['Conversión web'] = `${ga4.motivo ?? 'GA4 no respondió.'} La tasa se calcula con sesiones de GA4 y pedidos de Tiendanube: el checkout lo ejecuta el servidor de TN, así que el purchase del navegador se pierde en los pagos por transferencia.`
  }

  return falta
}

export async function leerResumen(rango: Rango): Promise<Resumen> {
  const prev = ventanaPrevia(rango)
  const v = { since: rango.desde, until: rango.hasta, pSince: prev.desde, pUntil: prev.hasta }

  // Las cuatro fuentes en paralelo y no en cadena: son independientes entre sí y la más
  // lenta (Meta) marca el tiempo de toda la pantalla igual. Cada una devuelve su propio
  // estado, así que una que falle no arrastra a las otras.
  const [ordenes, previas, meta, logistica, ml, ga4] = await Promise.all([
    fetchTNOrdersClassified(v.since, v.until),
    fetchTNOrdersClassified(v.pSince, v.pUntil),
    totalesMeta(v.since, v.until),
    // Logística NO se recorta con el rango, y es a propósito. Los envíos abiertos son los
    // que están abiertos AHORA: si el filtro estuviera en 7 días, un envío frenado hace 10
    // desaparecería del KPI justo cuando más hay que reclamarlo. El rango filtra historia,
    // no la cola de trabajo pendiente. En la pantalla de Logística sí recorta el histórico.
    leerLogistica(21),
    leerMl(new Date(v.since + 'T00:00:00.000Z'), new Date(v.until + 'T23:59:59.999Z')),
    leerGa4(v.since, v.until),
  ])

  const ventasTN = ordenes.reduce((s, o) => s + o.total, 0)
  const ventasPrev = previas.reduce((s, o) => s + o.total, 0)
  const pedidos = ordenes.length

  // CAC bruto: todo el gasto de Meta dividido por TODOS los pedidos del período, vengan de
  // donde vengan. No es el costo de adquirir un cliente por Meta ni el incremental: es el
  // piso más honesto que se puede calcular sin holdout, y se rotula así en la pantalla.
  const cacBruto = pedidos > 0 && meta.spend > 0 ? meta.spend / pedidos : null

  // La tolerancia sale del catálogo de crons y no de un número escrito acá: el día que
  // cambie la cadencia de `operacion-envios`, cambia en un solo lugar. Dos umbrales para lo
  // mismo terminan discutiendo entre sí en cuanto alguien toca uno solo.
  const horas = logistica.corte
    ? (Date.now() - new Date(logistica.corte).getTime()) / 3_600_000
    : null
  const fresco = horas !== null && horas <= (CATALOGO['operacion-envios']?.maxHoras ?? 4)
  // La conversión solo existe si GA4 trajo sesiones: dividir por cero da Infinity, y una
  // tasa de conversión infinita se pinta igual de convincente que una buena.
  const conversion = ga4.ok && ga4.sesiones > 0 ? (pedidos / ga4.sesiones) * 100 : null

  const sinFuente = await faltantes(fresco, logistica.kpis.manualFresco, ml, ga4)

  return {
    rango,
    etiqueta: etiquetaRango(rango),
    periodo: { since: v.since, until: v.until },
    ventasTN,
    // Sumar los dos canales solo tiene sentido si los dos se pudieron leer. Con el push de ML
    // caído, `ventasTN + 0` se mostraría como la facturación total y estaría por debajo de la
    // real sin que nada lo indique — el error más caro de todos, porque parece un dato.
    ventasTotales: ml.fresco ? ventasTN + ml.ventas : null,
    ml,
    web: { ga4, conversion },
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
      corte: logistica.corte,
      fresco,
      horasDesdeCorte: horas,
      sinManual: logistica.kpis.sinManual,
      sinMaterial: logistica.kpis.sinMaterial,
      manualFresco: logistica.kpis.manualFresco,
    },
    sinFuente,
  }
}
