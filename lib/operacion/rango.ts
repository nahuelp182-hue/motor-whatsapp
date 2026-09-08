// El rango de fechas del panel de Operación, en un solo lugar.
//
// Antes cada pantalla traía su propia lista de períodos —el Resumen 24h/7d/30d, Adquisición
// 7/30/45, Logística 21 días fijos, Producción 30— así que comparar dos pantallas era
// comparar dos ventanas distintas sin que nada lo dijera. Ahora el rango es uno solo, viaja
// en la URL y todas las pantallas lo leen de acá.
//
// Server y cliente comparten este archivo a propósito: si el cliente valida una cosa y el
// server otra, el que gana es el server y el usuario ve un rango que no pidió.

/** Presets del filtro. El manual permite cualquier ventana; estos son los atajos. */
export const PRESETS = [7, 14, 30] as const
export type Preset = (typeof PRESETS)[number]

/** Default cuando la URL no dice nada. 30 días es la ventana con la que se venía leyendo. */
export const PRESET_DEFAULT: Preset = 30

/**
 * Techo de la ventana manual. No es burocracia: el rango entra en consultas que salen a
 * Tiendanube y Meta paginando, y una ventana de años convierte una pantalla en un timeout.
 * Además ningún supuesto del panel (márgenes, costos) tiene más de un año de vigencia.
 */
export const RANGO_MAX_DIAS = 365

/**
 * Piso de la ventana de envíos ABIERTOS, en días.
 *
 * Vive acá y no en `operacion/envios` porque la pantalla de Logística la muestra en su nota,
 * y ese archivo importa Prisma: traerlo a un componente cliente arrastraría el cliente de
 * base de datos al bundle del navegador.
 *
 * El rango recorta el histórico, pero no puede recortar la cola de trabajo pendiente: con el
 * filtro en 7 días, un envío frenado hace 10 —justo el que hay que reclamar— desaparecería, y
 * su ausencia se leería como "no hay nada frenado". Un filtro de lectura no esconde trabajo.
 */
export const PISO_ABIERTOS_DIAS = 21

const DIA = 86_400_000
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/

export const iso = (d: Date) => d.toISOString().slice(0, 10)

export type Rango = {
  /** YYYY-MM-DD, inclusive. */
  desde: string
  /** YYYY-MM-DD, inclusive. */
  hasta: string
  /** Días que abarca, contando los dos extremos. */
  dias: number
  /** El preset que lo generó, o null si es una ventana manual. */
  preset: Preset | null
}

/** El rango de un preset, terminando hoy. */
export function rangoDePreset(dias: Preset, hoy = new Date()): Rango {
  return {
    desde: iso(new Date(hoy.getTime() - (dias - 1) * DIA)),
    hasta: iso(hoy),
    dias,
    preset: dias,
  }
}

/**
 * Interpreta `desde`/`hasta` de la URL. NUNCA tira: un rango inválido cae al default.
 *
 * Cae en vez de fallar porque el rango llega del cliente y una pantalla en blanco por un
 * parámetro mal tipeado es peor que la ventana de siempre. Lo que sí no puede pasar es que
 * un valor raro se cuele hasta el cálculo: un `dias` NaN sale como una ventana absurda o
 * como una división que no existe, y eso el panel lo pinta con cara de dato bueno.
 */
export function parseRango(desde?: string | null, hasta?: string | null, hoy = new Date()): Rango {
  if (!desde || !hasta || !RE_FECHA.test(desde) || !RE_FECHA.test(hasta)) {
    return rangoDePreset(PRESET_DEFAULT, hoy)
  }

  const d = new Date(desde + 'T00:00:00.000Z')
  const h = new Date(hasta + 'T00:00:00.000Z')
  if (Number.isNaN(d.getTime()) || Number.isNaN(h.getTime()) || d > h) {
    return rangoDePreset(PRESET_DEFAULT, hoy)
  }

  // El futuro se recorta en vez de rechazarse: pedir "hasta fin de mes" es una intención
  // legítima y devolver el default por eso sería castigar al que pregunta de más.
  const tope = new Date(iso(hoy) + 'T00:00:00.000Z')
  const hFinal = h > tope ? tope : h
  if (d > hFinal) return rangoDePreset(PRESET_DEFAULT, hoy)

  const dias = Math.round((hFinal.getTime() - d.getTime()) / DIA) + 1
  if (dias > RANGO_MAX_DIAS) return rangoDePreset(PRESET_DEFAULT, hoy)

  // Un rango manual que coincide exactamente con un preset se rotula como ese preset: así
  // el botón queda marcado y no se ve un filtro "manual" que dice lo mismo que el atajo.
  const preset = PRESETS.find(p => p === dias && iso(hFinal) === iso(hoy)) ?? null

  return { desde: iso(d), hasta: iso(hFinal), dias, preset }
}

/** La ventana inmediatamente anterior, del mismo largo. Es contra lo que se compara. */
export function ventanaPrevia(r: Rango): { desde: string; hasta: string } {
  const d = new Date(r.desde + 'T00:00:00.000Z')
  const pHasta = new Date(d.getTime() - DIA)
  const pDesde = new Date(pHasta.getTime() - (r.dias - 1) * DIA)
  return { desde: iso(pDesde), hasta: iso(pHasta) }
}

/** Lo que se muestra al lado del dato: "últimos 14 días" o el rango literal. */
export function etiquetaRango(r: Rango): string {
  if (r.preset) return `últimos ${r.preset} días`
  const f = (s: string) => s.split('-').reverse().slice(0, 2).join('/')
  return `${f(r.desde)} al ${f(r.hasta)} (${r.dias} d)`
}
