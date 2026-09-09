// Los supuestos del negocio, en un solo lugar.
//
// Todo el panel de Operación se deriva de estos números: cobertura de stock, retorno
// sobre el CAC, ciclo de efectivo, margen de la capacidad ociosa. Ninguno se calcula —
// se miden afuera y se escriben acá.
//
// Regla: cada constante lleva QUÉ MIDE y CUÁNDO SE MIDIÓ. Un número sin fecha no se
// puede auditar: al año siguiente nadie sabe si sigue vigente o si quedó de una medición
// vieja, y el panel entero hereda esa duda. `MEDIDO` expone la fecha para que la
// interfaz pueda mostrarla al lado del dato derivado.
//
// Cambiar un valor acá es un commit a propósito: el historial de git es el registro de
// por qué cambió y cuándo. Si algún día hace falta editarlos sin desplegar, la migración
// natural es una tabla `Supuesto` que caiga de vuelta a estos valores como default.

/** Fecha de la última medición de cada supuesto (ISO, hora de Argentina). */
export const MEDIDO = {
  margenes: '2026-08-21',
  cac: '2026-09-06',
  produccion: '2026-08-21',
  logistica: '2026-07-15',
  caja: '2026-08-31',
} as const

// ── Márgenes ────────────────────────────────────────────────────────────────
// Margen de contribución por pedido, ya neto de comisiones de la plataforma y del
// costo variable. No incluye pauta: la pauta es justamente lo que se compara contra esto.

/** Margen por incubadora INC101 vendida. Medido 21/08/2026 sobre el costo de armado real. */
export const MARGEN_INCUBADORA = 321_600

/** Margen por pedido apícola. Es dropshipping: el fabricante despacha, acá queda la diferencia. */
export const MARGEN_APICOLA = 18_000

/**
 * Mezcla de facturación asumida: 60% incubadora, 40% apícola.
 * Es el supuesto más sensible del panel — con 20/80 el retorno sobre el CAC cae de 10,4x
 * a 3,1x. Por eso Adquisición muestra la sensibilidad y no solo el número puntual.
 */
export const MIX_INCUBADORA = 0.6

/**
 * Recompra: 1,049 pedidos por cliente. Es casi 1: el negocio vive de adquisición, no de
 * recompra. El LTV es el margen multiplicado por esto, o sea prácticamente el margen.
 */
export const RECOMPRA = 1.049

// ── Adquisición ─────────────────────────────────────────────────────────────

/**
 * Techo duro de CAC. Por encima de esto la venta no paga la pauta con margen suficiente
 * para sostener el resto de la operación: si el CAC no baja, se corta.
 */
export const TECHO_CAC = 30_000

/**
 * Umbral de frecuencia por conjunto de anuncios. Por encima de esto el mismo público ya vio
 * el anuncio demasiadas veces y toca recambio creativo.
 */
export const UMBRAL_FRECUENCIA = 4.0

/**
 * Cuánto sube el CAC cada vez que se DUPLICA el gasto diario.
 *
 * NO ESTÁ MEDIDO. Es una hipótesis de trabajo: los públicos baratos se agotan primero, así
 * que gastar más cuesta más por venta. El 6% viene de una regla del oficio, no de un dato
 * propio. Todo escenario de escalado que use esto se rotula como hipótesis en la pantalla —
 * el día que haya dos tramos de gasto sostenidos, se reemplaza por la pendiente real.
 */
export const ELASTICIDAD_CAC = 0.06

// ── Producción ──────────────────────────────────────────────────────────────

/** Unidades que se pueden armar por mes. El techo real es la demanda, no esto. */
export const CAPACIDAD_MENSUAL = 65

/** Costo de armado por unidad. Medido 21/08/2026; venía de $96.350 el mes anterior. */
export const COSTO_UNITARIO = 100_400

/** Días que tardan los componentes en llegar desde que se pide. Define el punto de reposición. */
export const LEAD_TIME_DIAS = 12

// ── Logística ───────────────────────────────────────────────────────────────

/**
 * Plazo prometido en la web, en días. El cumplimiento se mide contra esta ventana:
 * una entrega en 6 días no es "casi bien", está fuera de lo prometido.
 */
export const PLAZO_PROMETIDO = { min: 2, max: 5 } as const

/**
 * Umbrales de días en tránsito. El de alerta está en 5 y no en 8 a propósito: a los 8
 * días el reclamo del cliente ya entró, así que avisar ahí es avisar tarde.
 */
export const UMBRAL_ENVIO = { alerta: 5, reclamo: 8 } as const

/**
 * Días desde el despacho tras los cuales la falta de manual deja de ser normal.
 *
 * El script del VPS manda a las 24 h del despacho y corre cada 3 h, así que un envío recién
 * despachado sin acuse no es un problema: es el ciclo. Se da margen para una corrida perdida
 * antes de gritar — un indicador que se enciende solo por el reloj no se mira más.
 *
 * Vive acá y no en `operacion/envios.ts` porque lo usan las dos puntas, y ese módulo importa
 * Prisma: traerlo a un componente de cliente solo por una constante arrastraría el server al bundle.
 */
export const PLAZO_MANUAL_DIAS = 2

// ── Caja ────────────────────────────────────────────────────────────────────

/** Días que MercadoPago retiene el cobro antes de liberarlo. */
export const RETENCION_MP_DIAS = 14

/** Plazo de pago a proveedores. Es lo que hace negativo el ciclo de efectivo. */
export const PLAZO_PROVEEDORES_DIAS = 30

/**
 * Margen bruto objetivo de la quincena.
 *
 * OJO con qué se compara: el margen bruto es (ventas − costo de la mercadería) / ventas.
 * El corte de caja NO trae el costo de la mercadería, así que `neto / bruto` —que es lo
 * único que sale de ahí— mide otra cosa: las comisiones de MercadoPago y Tiendanube (~6%).
 * Compararlas contra este 60% daba verde siempre. Hasta que el corte traiga el costo por
 * línea, este objetivo no tiene contra qué medirse y la pantalla lo dice.
 */
export const OBJETIVO_MARGEN_BRUTO = 0.6

// ── Derivados ───────────────────────────────────────────────────────────────
// Se calculan acá y no en cada pantalla: dos pantallas calculando lo mismo terminan
// mostrando números distintos en cuanto una de las dos se olvida de un cambio.

/** Margen ponderado por el mix. `mix` permite simular otra mezcla sin tocar el supuesto. */
export function margenPonderado(mix: number = MIX_INCUBADORA): number {
  return mix * MARGEN_INCUBADORA + (1 - mix) * MARGEN_APICOLA
}

/** Valor de vida del cliente: margen por los pedidos que hace en promedio. */
export function ltv(mix: number = MIX_INCUBADORA): number {
  return margenPonderado(mix) * RECOMPRA
}

/** Cuántas veces vuelve cada peso puesto en adquisición. */
export function retornoSobreCac(cac: number, mix: number = MIX_INCUBADORA): number | null {
  if (!cac || cac <= 0) return null // sin CAC no hay retorno que calcular, y 0 dividiría por cero
  return ltv(mix) / cac
}
