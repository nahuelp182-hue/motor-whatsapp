import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const TN_STORE = process.env.TN_STORE_ID    ?? '1957278'
const TN_TOKEN = process.env.TN_ACCESS_TOKEN ?? ''
const TN_BASE  = 'https://api.tiendanube.com/v1'
const UA       = 'Micelium/1.0 (nahuelp182@gmail.com)'

interface TNOrderTs { created_at: string }

async function fetchOrderTimestamps(since: string, until: string): Promise<number[]> {
  const timestamps: number[] = []
  let page = 1
  while (true) {
    const url =
      `${TN_BASE}/${TN_STORE}/orders?payment_status=paid` +
      `&created_at_min=${since}T00:00:00-03:00` +
      `&created_at_max=${until}T23:59:59-03:00` +
      `&per_page=50&page=${page}`
    const res  = await fetch(url, { headers: { Authentication: `bearer ${TN_TOKEN}`, 'User-Agent': UA } })
    const data = await res.json() as TNOrderTs[]
    if (!Array.isArray(data) || data.length === 0) break
    for (const o of data) timestamps.push(new Date(o.created_at).getTime())
    if (data.length < 50) break
    page++
    await new Promise(r => setTimeout(r, 200))
  }
  return timestamps
}

function avgIntervalHours(ts: number[]): number | null {
  if (ts.length < 2) return null
  const sorted = [...ts].sort((a, b) => a - b)
  let total = 0
  for (let i = 1; i < sorted.length; i++) total += sorted[i] - sorted[i - 1]
  return total / (sorted.length - 1) / 3600000
}

function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}min`
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  if (mm === 0) return `${hh}h`
  return `${hh}h ${mm}min`
}

export async function GET(req: NextRequest) {
  try {
    if (!TN_TOKEN) return NextResponse.json({ error: 'TN_ACCESS_TOKEN not configured' })

    const p     = req.nextUrl.searchParams
    const today = new Date().toISOString().slice(0, 10)
    const since = p.get('since') ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
    const until = p.get('until') ?? today

    const DAY_MS     = 86400000
    const WINDOW_DAYS = 3

    const timestamps = (await fetchOrderTimestamps(since, until)).sort((a, b) => a - b)

    if (timestamps.length === 0) {
      return NextResponse.json({ avg: null, best: null, worst: null, lastOrderAt: null, totalOrders: 0, daily: [] })
    }

    // ── Promedio global del período ───────────────────────────────
    const overallAvg = avgIntervalHours(timestamps)

    // ── Ventanas deslizantes de 3 días dentro del período ─────────
    const periodStart = new Date(`${since}T00:00:00-03:00`).getTime()
    const periodEnd   = new Date(`${until}T23:59:59-03:00`).getTime()
    const periodDays  = Math.ceil((periodEnd - periodStart) / DAY_MS)

    let bestAvg:  number | null = null
    let worstAvg: number | null = null
    let bestDate  = ''
    let worstDate = ''

    if (periodDays >= WINDOW_DAYS) {
      for (let winEnd = periodStart + WINDOW_DAYS * DAY_MS; winEnd <= periodEnd + DAY_MS; winEnd += DAY_MS) {
        const winStart = winEnd - WINDOW_DAYS * DAY_MS
        const windowTs = timestamps.filter(t => t >= winStart && t < winEnd)
        const avg = avgIntervalHours(windowTs)
        if (avg === null) continue
        if (bestAvg === null || avg < bestAvg) {
          bestAvg  = avg
          bestDate = new Date(winEnd - DAY_MS).toISOString().slice(0, 10)
        }
        if (worstAvg === null || avg > worstAvg) {
          worstAvg  = avg
          worstDate = new Date(winEnd - DAY_MS).toISOString().slice(0, 10)
        }
      }
    }

    // ── Datos diarios para el gráfico ─────────────────────────────
    // Si el período > 60 días: agrupar por semana; si no: por día
    const binDays    = periodDays > 60 ? 7 : 1
    const dailyMap: Record<string, number> = {}

    for (const ts of timestamps) {
      const d   = new Date(ts)
      // Redondear al inicio del bin
      const msFromStart = ts - periodStart
      const binIdx      = Math.floor(msFromStart / (binDays * DAY_MS))
      const binStart    = new Date(periodStart + binIdx * binDays * DAY_MS)
      const key         = binStart.toISOString().slice(0, 10)
      dailyMap[key]     = (dailyMap[key] ?? 0) + 1
    }

    const daily = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, orders]) => ({ date, orders }))

    return NextResponse.json({
      avg:         overallAvg !== null ? { hours: overallAvg, label: fmtHours(overallAvg) } : null,
      best:        bestAvg    !== null ? { hours: bestAvg,    label: fmtHours(bestAvg),  date: bestDate  } : null,
      worst:       worstAvg   !== null ? { hours: worstAvg,   label: fmtHours(worstAvg), date: worstDate } : null,
      lastOrderAt: new Date(timestamps[timestamps.length - 1]).toISOString(),
      totalOrders: timestamps.length,
      daily,
      binDays,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
