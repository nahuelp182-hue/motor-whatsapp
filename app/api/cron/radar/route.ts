import { NextRequest, NextResponse } from 'next/server'
import pg from 'pg'
import { notifyNahuel } from '@/lib/notify'
import {
  minarCategoria, ensureTabla, guardarSnapshot, ultimosDos, analizar,
} from '@/lib/radar'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // minado ~250 sugerencias en paralelo

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
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const p = getPool()
  if (!p) return NextResponse.json({ ok: false, error: 'DB no configurada' })

  try {
    await ensureTabla(p)

    // Previo = el último snapshot antes de escribir el de hoy.
    const antes = await ultimosDos(p)
    const previo = antes.find((s) => s.fecha !== new Date().toISOString().slice(0, 10))?.consultas
      ?? antes[0]?.consultas ?? null

    const hoy = await minarCategoria()
    if (Object.keys(hoy).length === 0) {
      return NextResponse.json({ ok: false, error: 'minado vacío' })
    }
    await guardarSnapshot(p, hoy)

    const a = analizar(hoy, previo)

    // Email solo si hay emergentes (no molestar con lo de siempre).
    let enviado = false
    if (a.hayBase && a.emergentes.length > 0) {
      const top = a.emergentes.slice(0, 15)
        .map((f) => `  ${f.estado === 'NUEVO' ? '🆕' : '📈'} ${f.consulta}`).join('\n')
      const body =
        `Radar de categoría — lo que EMPIEZA a buscar tu público hoy:\n\n${top}\n\n` +
        `Estos son temas con demanda creciente en tu nicho: candidatos a video/post ` +
        `con puente real y durabilidad.\n\n` +
        `Ver el panel completo:\nhttps://mw-micelium.vercel.app/radar`
      await notifyNahuel('🌱 Radar de tendencias (categoría) — emergentes de hoy', body)
      enviado = true
    }

    return NextResponse.json({
      ok: true, enviado,
      totales: {
        consultas: Object.keys(hoy).length,
        emergentes: a.emergentes.length,
        contenido: a.contenido.length,
        compra: a.compra.length,
        hayBase: a.hayBase,
      },
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 300) })
  }
}
