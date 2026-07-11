// Calendario Comercial Vivo — Micelium
// Resuelve fechas recurrentes en una ventana rodante y calcula deadlines de prep.
// Dataset: data/fechas-comerciales.json. Se recomputa en cada request (countdowns vivos).

import datos from '@/data/fechas-comerciales.json'

const TZ = 'America/Argentina/Buenos_Aires'
const DIA_MS = 86_400_000

export type Categoria = 'retail' | 'cultural' | 'deportivo' | 'estacional' | 'financiero' | 'otro'
export type PrepKey = 'stock' | 'creativos' | 'plantilla_wsp'
export type PrepEstado = 'vencido' | 'ahora' | 'pronto' | 'ok'

type Regla =
  | { tipo: 'fijo'; mes: number; dia: number }
  | { tipo: 'nth'; mes: number; weekday: number; n: number } // weekday 0=lun..6=dom
  | { tipo: 'rango'; desde: [number, number]; hasta: [number, number] }
  | { tipo: 'pascua'; offset: number } // Pascua + offset dias (Carnaval=-48, Viernes Santo=-2, etc.)
  | { tipo: 'fijo_anio'; fecha: string }

type FechaRaw = {
  id: string
  nombre: string
  regla: Regla
  categoria?: Categoria
  negocio?: string
  relevancia?: number
  promo: string
  justificativo: string
  wsp?: string
  prep: Partial<Record<PrepKey, number>>
}

export type PrepInfo = { key: PrepKey; limite: string; faltan: number; estado: PrepEstado }
export type ItemCalendario = {
  id: string
  nombre: string
  fecha: string // ISO YYYY-MM-DD
  faltan: number
  categoria: Categoria
  relevancia: number
  promo: string
  justificativo: string
  wsp: string
  prep: PrepInfo[]
}

// "Hoy" en horario de Argentina, como Date a medianoche UTC (para diffs por dia).
function hoyAR(): Date {
  const s = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function diasEntre(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DIA_MS)
}

// n-esimo weekday (0=lun..6=dom) del mes; devuelve Date a medianoche UTC.
function nthWeekday(anio: number, mes: number, weekday: number, n: number): Date {
  let count = 0
  for (let dia = 1; dia <= 31; dia++) {
    const d = new Date(Date.UTC(anio, mes - 1, dia))
    if (d.getUTCMonth() !== mes - 1) break
    const wd = (d.getUTCDay() + 6) % 7 // JS 0=dom -> 0=lun
    if (wd === weekday) {
      count++
      if (count === n) return d
    }
  }
  throw new Error(`nthWeekday sin resultado: ${anio}-${mes} wd${weekday} n${n}`)
}

// Domingo de Pascua (algoritmo de Gauss / computus gregoriano). Date a medianoche UTC.
function domingoPascua(anio: number): Date {
  const a = anio % 19
  const b = Math.floor(anio / 100)
  const c = anio % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(anio, mes - 1, dia))
}

// Proxima ocurrencia >= hoy. null si es one-off ya vencido.
function resolverFecha(regla: Regla, hoy: Date): Date | null {
  if (regla.tipo === 'fijo_anio') {
    const [y, m, d] = regla.fecha.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    return diasEntre(dt, hoy) >= -1 ? dt : null
  }
  const anioBase = hoy.getUTCFullYear()
  for (const anio of [anioBase, anioBase + 1]) {
    let dt: Date
    if (regla.tipo === 'fijo') dt = new Date(Date.UTC(anio, regla.mes - 1, regla.dia))
    else if (regla.tipo === 'nth') dt = nthWeekday(anio, regla.mes, regla.weekday, regla.n)
    else if (regla.tipo === 'pascua') dt = new Date(domingoPascua(anio).getTime() + regla.offset * DIA_MS)
    else dt = new Date(Date.UTC(anio, regla.desde[0] - 1, regla.desde[1])) // rango: ancla en 'desde'
    if (diasEntre(dt, hoy) >= 0) return dt
  }
  return null
}

function prepEstado(fechaEvento: Date, diasAntes: number, hoy: Date): { limite: Date; faltan: number; estado: PrepEstado } {
  const limite = new Date(fechaEvento.getTime() - diasAntes * DIA_MS)
  const faltan = diasEntre(limite, hoy)
  const estado: PrepEstado = faltan < 0 ? 'vencido' : faltan <= 3 ? 'ahora' : faltan <= 10 ? 'pronto' : 'ok'
  return { limite, faltan, estado }
}

const ORDEN_PREP: PrepKey[] = ['stock', 'creativos', 'plantilla_wsp']

export function construirCalendario(horizonteDias = 90): ItemCalendario[] {
  const hoy = hoyAR()
  const fechas = (datos as { fechas: FechaRaw[] }).fechas
  const items: ItemCalendario[] = []

  for (const f of fechas) {
    const fe = resolverFecha(f.regla, hoy)
    if (!fe) continue
    const faltan = diasEntre(fe, hoy)

    const prep: PrepInfo[] = ORDEN_PREP
      .filter((k) => f.prep[k] != null)
      .map((k) => {
        const p = prepEstado(fe, f.prep[k]!, hoy)
        return { key: k, limite: p.limite.toISOString().slice(0, 10), faltan: p.faltan, estado: p.estado }
      })

    // Entra si el evento cae en la ventana, o si alguna tarea de prep ya arranco (aunque el evento este mas lejos).
    const prepActiva = prep.some((p) => p.estado === 'ahora' || p.estado === 'vencido' || (p.faltan >= 0 && p.faltan <= horizonteDias))
    if (faltan > horizonteDias && !prepActiva) continue

    items.push({
      id: f.id,
      nombre: f.nombre,
      fecha: fe.toISOString().slice(0, 10),
      faltan,
      categoria: f.categoria ?? 'otro',
      relevancia: f.relevancia ?? 3,
      promo: f.promo,
      justificativo: f.justificativo,
      wsp: f.wsp ?? '',
      prep,
    })
  }

  items.sort((a, b) => a.fecha.localeCompare(b.fecha))
  return items
}

export const CAT_COLOR: Record<Categoria, string> = {
  retail: '#fb923c', cultural: '#a78bfa', deportivo: '#4ade80',
  estacional: '#60a5fa', financiero: '#f472b6', otro: '#a1a1aa',
}
export const CAT_LABEL: Record<Categoria, string> = {
  retail: 'Retail', cultural: 'Cultural', deportivo: 'Deportivo',
  estacional: 'Estacional', financiero: 'Financiero', otro: 'Otro',
}
export const PREP_LABEL: Record<PrepKey, string> = {
  stock: 'Stock', creativos: 'Creativos', plantilla_wsp: 'Plantilla WSP',
}

export function fechaLinda(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dias = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const dt = new Date(Date.UTC(y, m - 1, d))
  const wd = (dt.getUTCDay() + 6) % 7
  return `${dias[wd]} ${d} ${meses[m - 1]} ${y}`
}
