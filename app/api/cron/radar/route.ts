import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { notifyNahuel } from '@/lib/notify'
import {
  minarCategoria, ensureTabla, guardarSnapshot, ultimosDos, analizar,
  youtubeNicho, ensureTablaYT, guardarYT,
} from '@/lib/radar'
import { chequearCron } from '@/lib/cron-auth'
import { marcarHeartbeat } from '@/lib/cron-heartbeat'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // minado ~250 sugerencias en paralelo

export async function GET(req: NextRequest) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth
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
      await marcarHeartbeat('radar', false, 'minado vacío')
      return NextResponse.json({ ok: false, error: 'minado vacío' })
    }
    await guardarSnapshot(p, hoy)

    // Fuente YouTube (solo si hay API key) — 1 corrida/día, gasto de quota mínimo.
    let ytCount = 0
    if (process.env.YOUTUBE_API_KEY) {
      try {
        await ensureTablaYT(p)
        const vids = await youtubeNicho(process.env.YOUTUBE_API_KEY)
        if (vids.length) { await guardarYT(p, vids); ytCount = vids.length }
      } catch { /* YouTube no debe romper el radar de categoría */ }
    }

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

    await marcarHeartbeat('radar', true)
    return NextResponse.json({
      ok: true, enviado,
      totales: {
        consultas: Object.keys(hoy).length,
        emergentes: a.emergentes.length,
        contenido: a.contenido.length,
        compra: a.compra.length,
        youtube: ytCount,
        hayBase: a.hayBase,
      },
    })
  } catch (e) {
    await marcarHeartbeat('radar', false, String(e).slice(0, 300))
    return NextResponse.json({ ok: false, error: String(e).slice(0, 300) })
  }
}
