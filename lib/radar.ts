import pg from 'pg'

/**
 * Radar de categoría: mina lo que la gente busca sobre los temas de Micelium
 * (Google Suggest / autocompletado, AR) y detecta emergentes comparando el
 * snapshot de hoy contra el anterior. Materia prima de contenido, no noticias.
 */

// ── Semillas: los temas de Micelium. Editables. ─────────────────────────────
export const SEMILLAS = [
  'girgolas', 'melena de leon', 'reishi', 'hongos comestibles',
  'hongos ostra', 'autocultivo', 'cultivo de hongos', 'adaptogenos',
  'huerta en casa', 'kit de hongos',
]

const MOD_APPEND = [
  '', 'como', 'como cultivar', 'como hacer', 'paso a paso', 'casero',
  'en casa', 'principiante', 'para que sirve', 'beneficios', 'propiedades',
  'cuanto tarda', 'receta', 'argentina', 'precio', 'comprar', 'kit',
  'opiniones', 'ansiedad', 'salud',
]
const MOD_PREPEND = ['como cultivar', 'como hacer', 'para que sirve', 'beneficios de', 'kit de']

const INTENT_INFO = new Set(['como', 'que', 'para', 'sirve', 'beneficios', 'propiedades',
  'cuanto', 'cuando', 'donde', 'receta', 'paso', 'casero', 'casa',
  'principiante', 'hacer', 'cultivar', 'ansiedad', 'salud'])
const INTENT_BUY = new Set(['precio', 'comprar', 'kit', 'venta', 'barato', 'oferta', 'mercadolibre'])

// Ruido a descartar (temas fuera de marca).
const STOP = ['weed', 'marihuana', 'cannabis', 'porro', 'droga', 'psilocybe',
  'alucin', 'magic', 'magico', 'magicos']

export type Intent = 'contenido' | 'compra' | 'generico'
export type Estado = 'NUEVO' | 'SUBE' | ''
export type Fila = { consulta: string; score: number; intent: Intent; estado: Estado }
export type Analisis = {
  emergentes: Fila[]
  contenido: Fila[]
  compra: Fila[]
  hayBase: boolean
  fecha: string | null
}

function esRuido(q: string) { return STOP.some((s) => q.includes(s)) }

function clasificarIntent(q: string): Intent {
  const p = new Set(q.split(/\s+/))
  for (const w of p) if (INTENT_BUY.has(w)) return 'compra'
  for (const w of p) if (INTENT_INFO.has(w)) return 'contenido'
  return 'generico'
}

// ── Google Suggest (autocompletado real, AR) ────────────────────────────────
async function suggest(q: string): Promise<string[]> {
  const url = 'https://suggestqueries.google.com/complete/search'
    + `?client=firefox&hl=es&gl=ar&q=${encodeURIComponent(q)}`
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 radar-categoria/1.0' },
      signal: AbortSignal.timeout(12000),
    })
    if (!r.ok) return []
    const data = JSON.parse(await r.text())
    return (data[1] as string[]).map((s) => s.trim().toLowerCase()).filter(Boolean)
  } catch { return [] }
}

// Corre `tareas` con concurrencia limitada (Google tolera paralelo moderado).
async function pool<T>(items: T[], limit: number, fn: (x: T) => Promise<void>) {
  let i = 0
  const workers = Array.from({ length: limit }, async () => {
    while (i < items.length) { const idx = i++; await fn(items[idx]) }
  })
  await Promise.all(workers)
}

/** Mina todas las semillas y devuelve { consulta: score } (score = veces vista). */
export async function minarCategoria(): Promise<Record<string, number>> {
  const combos: string[] = []
  for (const s of SEMILLAS) {
    for (const m of MOD_APPEND) combos.push(`${s} ${m}`.trim())
    for (const m of MOD_PREPEND) combos.push(`${m} ${s}`.trim())
  }
  const consultas: Record<string, number> = {}
  await pool(combos, 12, async (q) => {
    for (const sug of await suggest(q)) {
      if (esRuido(sug)) continue
      consultas[sug] = (consultas[sug] ?? 0) + 1
    }
  })
  return consultas
}

// ── Persistencia en Supabase (una fila por día) ─────────────────────────────
export async function ensureTabla(p: pg.Pool) {
  await p.query(`CREATE TABLE IF NOT EXISTS radar_snapshot (
    fecha date PRIMARY KEY,
    consultas jsonb NOT NULL,
    created_at timestamptz DEFAULT now()
  )`)
}

export async function guardarSnapshot(p: pg.Pool, consultas: Record<string, number>) {
  await p.query(
    `INSERT INTO radar_snapshot (fecha, consultas) VALUES (current_date, $1)
       ON CONFLICT (fecha) DO UPDATE SET consultas = $1, created_at = now()`,
    [JSON.stringify(consultas)],
  )
}

/** Lee los 2 snapshots más recientes: [hoy/último, previo]. */
export async function ultimosDos(p: pg.Pool): Promise<
  Array<{ fecha: string; consultas: Record<string, number> }>
> {
  const { rows } = await p.query(
    `SELECT to_char(fecha,'YYYY-MM-DD') AS fecha, consultas
       FROM radar_snapshot ORDER BY fecha DESC LIMIT 2`,
  )
  return rows.map((r) => ({
    fecha: r.fecha,
    consultas: (typeof r.consultas === 'string' ? JSON.parse(r.consultas) : r.consultas) as Record<string, number>,
  }))
}

// ── Fuente YouTube: qué contenido de nicho performa (search por views) ──────
export type YTVideo = { videoId: string; titulo: string; canal: string; views: number }

const YT_QUERIES = [
  'como cultivar girgolas', 'como cultivar hongos en casa', 'melena de leon hongo beneficios',
  'reishi para que sirve', 'kit autocultivo hongos', 'setas ostra cultivo casa',
]
// El título/desc debe tocar el nicho (filtra hindi/inglés y "diente de león").
const YT_OK = ['hongo', 'seta', 'girgola', 'gírgola', 'champiñon', 'champiñón', 'champinon',
  'micelio', 'cultiv', 'ostra', 'melena de le', 'reishi', 'ganoderma', 'shiitake', 'shitake',
  'adaptogen', 'ashwagandha', 'cordyceps']

async function ytApi(ep: string, params: Record<string, string>, key: string): Promise<any> {
  const u = `https://www.googleapis.com/youtube/v3/${ep}?`
    + new URLSearchParams({ ...params, key }).toString()
  const r = await fetch(u, { signal: AbortSignal.timeout(12000) })
  if (!r.ok) return null
  return r.json()
}

/** Corre las queries de nicho, dedup + filtra ruido, top por views. */
export async function youtubeNicho(key: string): Promise<YTVideo[]> {
  const ids = new Set<string>()
  for (const q of YT_QUERIES) {
    const s = await ytApi('search', {
      part: 'snippet', q, type: 'video', order: 'viewCount',
      relevanceLanguage: 'es', maxResults: '6',
    }, key)
    for (const it of s?.items ?? []) if (it.id?.videoId) ids.add(it.id.videoId)
  }
  if (ids.size === 0) return []
  const v = await ytApi('videos', { part: 'statistics,snippet', id: [...ids].join(',') }, key)
  const rows: YTVideo[] = []
  for (const it of v?.items ?? []) {
    const t = (it.snippet?.title ?? '') as string
    const d = (it.snippet?.description ?? '') as string
    const blob = (t + ' ' + d).toLowerCase()
    if (blob.includes('diente de le')) continue           // diente de león ≠ melena de león
    if (!YT_OK.some((w) => blob.includes(w))) continue     // fuera de nicho
    rows.push({
      videoId: it.id, titulo: t, canal: it.snippet?.channelTitle ?? '',
      views: Number(it.statistics?.viewCount ?? 0),
    })
  }
  rows.sort((a, b) => b.views - a.views)
  return rows.slice(0, 15)
}

export async function ensureTablaYT(p: pg.Pool) {
  await p.query(`CREATE TABLE IF NOT EXISTS radar_youtube (
    fecha date PRIMARY KEY,
    videos jsonb NOT NULL,
    created_at timestamptz DEFAULT now()
  )`)
}

export async function guardarYT(p: pg.Pool, videos: YTVideo[]) {
  await p.query(
    `INSERT INTO radar_youtube (fecha, videos) VALUES (current_date, $1)
       ON CONFLICT (fecha) DO UPDATE SET videos = $1, created_at = now()`,
    [JSON.stringify(videos)],
  )
}

export async function leerYT(p: pg.Pool): Promise<YTVideo[]> {
  try {
    const { rows } = await p.query(
      `SELECT videos FROM radar_youtube ORDER BY fecha DESC LIMIT 1`)
    if (rows.length === 0) return []
    const v = rows[0].videos
    return (typeof v === 'string' ? JSON.parse(v) : v) as YTVideo[]
  } catch { return [] }
}

/** Compara hoy vs previo y arma los tres bloques ordenados. */
export function analizar(
  hoy: Record<string, number>,
  previo: Record<string, number> | null,
): Analisis {
  const base = previo && Object.keys(previo).length > 0
  const filas: Fila[] = Object.entries(hoy).map(([consulta, score]) => {
    let estado: Estado = ''
    if (base) {
      if (!(consulta in previo!)) estado = 'NUEVO'
      else if (score > previo![consulta]) estado = 'SUBE'
    }
    return { consulta, score, intent: clasificarIntent(consulta), estado }
  })

  const emergentes = filas.filter((f) => f.estado)
    .sort((a, b) => (a.estado === 'NUEVO' ? 0 : 1) - (b.estado === 'NUEVO' ? 0 : 1) || b.score - a.score)
  const contenido = filas.filter((f) => !f.estado && f.intent === 'contenido').sort((a, b) => b.score - a.score)
  const compra = filas.filter((f) => !f.estado && f.intent === 'compra').sort((a, b) => b.score - a.score)

  return { emergentes, contenido, compra, hayBase: !!base, fecha: null }
}
