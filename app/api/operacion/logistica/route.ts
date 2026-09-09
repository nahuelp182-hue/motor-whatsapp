// Lo que lee la pantalla de Logística. Solo Postgres: no sale a internet.
//
// La ruta NO está en API_ABIERTAS del middleware, así que exige sesión del panel como
// cualquier otra vista privada. Refrescar los datos es trabajo del cron
// (/api/cron/operacion-envios), no de esta ruta: si abrir la pantalla disparara el
// refresco, cada F5 saldría a consultar Andreani envío por envío.
import { NextRequest, NextResponse } from 'next/server'
import { leerLogistica } from '@/lib/operacion/envios'
import { parseRango } from '@/lib/operacion/rango'
import { log, traceId } from '@/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const trace = traceId()
  // El rango recorta el HISTÓRICO (cumplimiento, demora por provincia, por semana). Los
  // envíos abiertos no se recortan dentro de leerLogistica: un envío frenado hace 10 días no
  // puede desaparecer de la cola porque alguien miró los últimos 7.
  const rango = parseRango(
    req.nextUrl.searchParams.get('desde'),
    req.nextUrl.searchParams.get('hasta'),
  )
  try {
    // `hasta` con hora 23:59:59.999: el rango es inclusive del día, y sin la hora tope una
    // entrega registrada esa misma tarde quedaba afuera por comparar contra medianoche.
    const techo = new Date(`${rango.hasta}T23:59:59.999Z`)
    const datos = await leerLogistica(rango.dias, techo)
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
