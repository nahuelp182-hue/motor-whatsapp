import { NextRequest, NextResponse } from 'next/server'
import { construirEventosCalendario } from '@/lib/calendario'
import { getAccessToken, listarEventosSync, upsertEvento } from '@/lib/gcal'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Espeja el dataset de fechas comerciales al calendario Google "Ecommerce".
// Idempotente: cada evento se etiqueta con micKey = id-anio -> re-corre = update, no duplica.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const calId = process.env.GCAL_ECOMMERCE_ID
  if (!calId) return NextResponse.json({ error: 'Falta GCAL_ECOMMERCE_ID' }, { status: 500 })

  const horizonte = Number(req.nextUrl.searchParams.get('dias') ?? 120)

  try {
    const token = await getAccessToken()
    const existentes = await listarEventosSync(calId, token)
    const eventos = construirEventosCalendario(horizonte)

    let created = 0, updated = 0
    const detalle: string[] = []
    for (const e of eventos) {
      const r = await upsertEvento(calId, token, e, existentes)
      if (r === 'created') created++; else updated++
      detalle.push(`${r === 'created' ? '＋' : '↻'} ${e.fecha} ${e.summary}`)
    }

    return NextResponse.json({
      ok: true, horizonte, total: eventos.length, created, updated,
      yaEnCalendario: existentes.size, detalle,
    })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
