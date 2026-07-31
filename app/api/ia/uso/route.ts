// Recibe el consumo de IA de los scripts que corren fuera de Vercel.
//
// Las 4 rutas del motor se registran solas (lib/diag.ts). Los que hasta hoy no medían nada
// —vanguardia_diaria, radar_saas, reddit_radar, geo_report— viven en el VPS y entran por
// acá. Es la misma tabla: un solo lugar donde preguntar "¿cuánto gasté y en qué?".
import { NextRequest, NextResponse } from 'next/server'
import { chequearCron } from '@/lib/cron-auth'
import { getPool } from '@/lib/db'
import { costoDe } from '@/lib/precios-ia'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const n = (v: unknown) => Math.max(0, Math.round(Number(v ?? 0)) || 0)

export async function POST(req: NextRequest) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const channel = String(body.channel ?? '').trim().slice(0, 60)
  const model = String(body.model ?? '').trim().slice(0, 80)
  if (!channel || !model) {
    return NextResponse.json({ error: 'faltan channel y model' }, { status: 400 })
  }

  const uso = {
    input: n(body.input_tokens),
    output: n(body.output_tokens),
    cacheLectura: n(body.cache_read_tokens),
    cacheEscritura: n(body.cache_write_tokens),
    busquedasWeb: n(body.web_search_requests),
  }
  const { usd, modeloDesconocido } = costoDe(model, uso)

  const p = getPool()
  if (!p) return NextResponse.json({ error: 'DB no configurada' }, { status: 503 })

  await p.query(
    `INSERT INTO claude_usage
       (channel, model, provider, input_tokens, output_tokens, cache_read_tokens,
        cache_write_tokens, web_search_requests, cost_usd, duracion_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      channel, model,
      String(body.provider ?? (model.startsWith('gemini') ? 'google' : 'anthropic')),
      uso.input, uso.output, uso.cacheLectura, uso.cacheEscritura, uso.busquedasWeb,
      usd,
      body.duracion_ms === undefined ? null : n(body.duracion_ms),
    ],
  )

  // Se avisa en la respuesta, no en silencio: el script que reporta un modelo sin precio es
  // el que hay que corregir, y su log es donde alguien lo va a ver.
  return NextResponse.json({ ok: true, usd: Number(usd.toFixed(6)), modeloDesconocido })
}
