import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const TN_STORE = process.env.TN_STORE_ID   ?? '1957278'
const TN_TOKEN = process.env.TN_ACCESS_TOKEN ?? ''
const TN_BASE  = 'https://api.tiendanube.com/v1'
const UA       = 'Micelium/1.0 (nahuelp182@gmail.com)'

interface TNOrderTs { created_at: string }

async function fetchOrderTimestamps(days: number): Promise<number[]> {
  const now   = new Date()
  const since = new Date(now.getTime() - days * 24 * 3600 * 1000)

  const sinceStr = since.toISOString().slice(0, 10)
  const untilStr = now.toISOString().slice(0, 10)

  const timestamps: number[] = []
  let page = 1

  while (true) {
    const url =
      `${TN_BASE}/${TN_STORE}/orders?payment_status=paid` +
      `&created_at_min=${sinceStr}T00:00:00-03:00` +
      `&created_at_max=${untilStr}T23:59:59-03:00` +
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

// Avg hours between consecutive timestamps. Returns null if < 2 points.
function avgIntervalHours(ts: number[]): number | null {
  if (ts.length < 2) return null
  const sorted = [...ts].sort((a, b) => a - b)
  let total = 0
  for (let i = 1; i < sorted.length; i++) total += sorted[i] - sorted[i - 1]
  return total / (sorted.length - 1) / 3_600_000
}

function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}min`
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  if (mm === 0) return `${hh}h`
  return `${hh}h ${mm}min`
}

export async function GET() {
  try {
    if (!TN_TOKEN) {
      return NextResponse.json({ error: 'TN_ACCESS_TOKEN not configured' })
    }

    const HISTORY_DAYS = 90
    const WINDOW_DAYS  = 3
    const DAY_MS       = 24 * 3600_000

    const timestamps = (await fetchOrderTimestamps(HISTORY_DAYS)).sort((a, b) => a - b)

    if (timestamps.length === 0) {
      return NextResponse.json({ current: null, best: null, worst: null, lastOrderAt: null, ordersIn3d: 0 })
    }

    const now = Date.now()

    // ── Current: últimas 72h ──────────────────────────────────────
    const cutoff3d  = now - WINDOW_DAYS * DAY_MS
    const recent    = timestamps.filter(t => t >= cutoff3d)
    const currentAvg = avgIntervalHours(recent)

    // ── Sliding 3-day windows (1-day step) over last 90 days ──────
    let bestAvg:  number | null = null
    let worstAvg: number | null = null
    let bestDate  = ''
    let worstDate = ''

    const oldest = now - HISTORY_DAYS * DAY_MS
    for (let winEnd = oldest + WINDOW_DAYS * DAY_MS; winEnd <= now; winEnd += DAY_MS) {
      const winStart  = winEnd - WINDOW_DAYS * DAY_MS
      const windowTs  = timestamps.filter(t => t >= winStart && t < winEnd)
      const avg       = avgIntervalHours(windowTs)
      if (avg === null) continue

      if (bestAvg === null || avg < bestAvg) {
        bestAvg  = avg
        bestDate = new Date(winEnd).toISOString().slice(0, 10)
      }
      if (worstAvg === null || avg > worstAvg) {
        worstAvg  = avg
        worstDate = new Date(winEnd).toISOString().slice(0, 10)
      }
    }

    return NextResponse.json({
      current:     currentAvg !== null ? { hours: currentAvg, label: fmtHours(currentAvg) } : null,
      best:        bestAvg    !== null ? { hours: bestAvg,    label: fmtHours(bestAvg),  date: bestDate  } : null,
      worst:       worstAvg   !== null ? { hours: worstAvg,   label: fmtHours(worstAvg), date: worstDate } : null,
      lastOrderAt: new Date(timestamps[timestamps.length - 1]).toISOString(),
      ordersIn3d:  recent.length,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
