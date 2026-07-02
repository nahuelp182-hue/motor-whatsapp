import { NextRequest, NextResponse } from 'next/server'
import pg from 'pg'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let pool: pg.Pool | null = null
function getPool(): pg.Pool | null {
  if (!process.env.DB_HOST) return null
  if (!pool) {
    pool = new pg.Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 6543),
      database: 'postgres',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
      max: 1,
    })
  }
  return pool
}

export async function GET(req: NextRequest) {
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days') ?? 30), 1), 90)
  const p = getPool()
  if (!p) return NextResponse.json({ error: 'DB no configurada', series: [], totals: {} })

  try {
    // Serie diaria por canal (zona horaria AR)
    const rows = (await p.query(
      `SELECT to_char((ts AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM-DD') AS dia,
              channel,
              sum(cost_usd)::float AS costo,
              sum(input_tokens + output_tokens + cache_read_tokens + cache_write_tokens)::bigint AS tokens
       FROM claude_usage
       WHERE ts > now() - ($1 || ' days')::interval
       GROUP BY 1, 2
       ORDER BY 1 ASC`,
      [String(days)],
    )).rows as Array<{ dia: string; channel: string; costo: number; tokens: string }>

    // Pivot: una fila por día con columnas por canal
    const byDay = new Map<string, { dia: string; instagram: number; whatsapp: number; otros: number; total: number }>()
    for (const r of rows) {
      const d = byDay.get(r.dia) ?? { dia: r.dia, instagram: 0, whatsapp: 0, otros: 0, total: 0 }
      const c = Number(r.costo)
      if (r.channel === 'instagram') d.instagram += c
      else if (r.channel === 'whatsapp') d.whatsapp += c
      else d.otros += c
      d.total += c
      byDay.set(r.dia, d)
    }
    const series = Array.from(byDay.values()).map((d) => ({
      ...d,
      label: d.dia.slice(5), // MM-DD
    }))

    const totals = (await p.query(
      `SELECT channel, sum(cost_usd)::float AS costo, count(*)::int AS llamadas
       FROM claude_usage WHERE ts > now() - ($1 || ' days')::interval GROUP BY 1`,
      [String(days)],
    )).rows as Array<{ channel: string; costo: number; llamadas: number }>

    const totalCost = totals.reduce((s, t) => s + Number(t.costo), 0)
    const totalCalls = totals.reduce((s, t) => s + t.llamadas, 0)

    return NextResponse.json({ series, totals, totalCost, totalCalls, days })
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300), series: [], totals: [] })
  }
}
