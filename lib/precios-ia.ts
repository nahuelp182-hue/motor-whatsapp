// Precios de las APIs de IA, en un solo lugar.
//
// Antes vivían pegados en lib/diag.ts, fijos a Haiku 4.5, porque el único consumidor
// medido era el bot. Al instrumentar vanguardia, radar_saas, reddit_radar y geo_report
// entran otros tres modelos y otro proveedor, y una tabla repetida en cinco archivos se
// desactualiza en cuatro de ellos.
//
// ⚠️ VERIFICADO EL 31/07/2026 contra la página de precios de Anthropic. Estos números NO
// se actualizan solos: si un modelo cambia de precio, acá sigue el viejo y el panel miente
// con cara de exactitud. Al tocar modelos, revisar https://docs.claude.com/en/docs/about-claude/pricing
//
// Para el número FACTURADO real está la página de costos de la consola. Esto es una
// estimación propia: sirve para comparar consumidores entre sí y ver tendencias, que es lo
// que hace falta para decidir dónde optimizar. No cuadra al centavo contra la factura.

export type Precio = {
  /** USD por millón de tokens de entrada. */
  input: number
  /** USD por millón de tokens de salida. */
  output: number
}

/** Precios por millón de tokens. La clave es un prefijo del nombre del modelo. */
const PRECIOS: Array<{ prefijo: string; p: Precio }> = [
  { prefijo: 'claude-haiku-4-5', p: { input: 1, output: 5 } },
  { prefijo: 'claude-sonnet-4', p: { input: 3, output: 15 } },
  { prefijo: 'claude-sonnet-5', p: { input: 3, output: 15 } },
  { prefijo: 'claude-opus-5', p: { input: 15, output: 75 } },
  { prefijo: 'gemini-2.5-flash', p: { input: 0.3, output: 2.5 } },
  { prefijo: 'gemini-2.5-pro', p: { input: 1.25, output: 10 } },
]

/**
 * Multiplicadores de caché de Anthropic, relativos al precio de entrada.
 * Leer de caché sale una décima parte; escribirla, un 25 % más que la entrada normal.
 */
const CACHE_LECTURA = 0.1
const CACHE_ESCRITURA = 1.25

/** USD por búsqueda web. Se factura APARTE de los tokens (USD 10 cada 1.000). */
export const PRECIO_BUSQUEDA_WEB = 10 / 1000

export type UsoIA = {
  input?: number
  output?: number
  cacheLectura?: number
  cacheEscritura?: number
  busquedasWeb?: number
}

export type Costo = {
  usd: number
  /** true si el modelo no está en la tabla: el costo es un piso, no un valor confiable. */
  modeloDesconocido: boolean
}

/**
 * Costo estimado de una llamada.
 *
 * Un modelo que no está en la tabla NO cuesta cero. Devolvería un consumidor caro
 * disfrazado de gratis —justo el que habría que mirar— y el total del panel bajaría al
 * empezar a usar un modelo nuevo, que es la señal exactamente al revés. Se cobra al precio
 * del más caro conocido y se marca, para que el panel pueda avisar.
 */
export function costoDe(modelo: string, uso: UsoIA): Costo {
  const encontrado = PRECIOS.find((x) => modelo.startsWith(x.prefijo))
  const modeloDesconocido = !encontrado
  const p = encontrado?.p ?? PRECIOS.reduce((a, b) => (b.p.output > a.p.output ? b : a)).p

  const M = 1_000_000
  const usd =
    ((uso.input ?? 0) * p.input +
      (uso.output ?? 0) * p.output +
      (uso.cacheLectura ?? 0) * p.input * CACHE_LECTURA +
      (uso.cacheEscritura ?? 0) * p.input * CACHE_ESCRITURA) / M +
    (uso.busquedasWeb ?? 0) * PRECIO_BUSQUEDA_WEB

  return { usd, modeloDesconocido }
}

/** Los modelos con precio conocido. Lo usa el test que exige tenerlos todos cubiertos. */
export function modelosConocidos(): string[] {
  return PRECIOS.map((x) => x.prefijo)
}
