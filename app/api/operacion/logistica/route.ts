// Lo que lee la pantalla de Logística. Solo Postgres: no sale a internet.
//
// La ruta NO está en API_ABIERTAS del middleware, así que exige sesión del panel como
// cualquier otra vista privada. Refrescar los datos es trabajo del cron
// (/api/cron/operacion-envios), no de esta ruta: si abrir la pantalla disparara el
// refresco, cada F5 saldría a consultar Andreani envío por envío.
import { NextRequest, NextResponse } from 'next/server'
import { leerLogistica } from '@/lib/operacion/envios'
import { log, traceId } from '@/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const trace = traceId()
  const dias = Number(req.nextUrl.searchParams.get('dias') ?? 21)
  try {
    const datos = await leerLogistica(Number.isFinite(dias) ? dias : 21)
    return NextResponse.json(datos)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error desconocido'
    log.error('no se pudo leer logística', { ambito: 'operacion', trace_id: trace }, e)
    // El cuerpo del error lleva la forma mínima que la pantalla necesita para pintar su
    // estado de error sin romperse: un `{error}` pelado obliga a cada consumidor a
    // defenderse solo, y el que se olvida crashea.
    return NextResponse.json({ error: msg, corte: null, abiertos: [] }, { status: 500 })
  }
}
