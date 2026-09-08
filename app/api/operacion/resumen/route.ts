// Lo que lee la pantalla de Resumen.
//
// A diferencia de Logística, esta ruta SÍ sale a internet (Tiendanube, Meta, GA4): son los
// datos que no tienen todavía un cron que los guarde. Por eso responde más lento y por eso
// la pantalla trae un botón de actualizar en vez de recargar sola.
import { NextRequest, NextResponse } from 'next/server'
import { leerResumen } from '@/lib/operacion/resumen'
import { parseRango } from '@/lib/operacion/rango'
import { log, traceId } from '@/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const trace = traceId(req)
  // parseRango no confía en el cliente y no tira: valida formato, orden, techo y futuro, y
  // ante cualquier cosa rara cae al default. Un valor inesperado que llegara al cálculo de
  // fechas saldría como NaN convertido en una ventana absurda.
  const rango = parseRango(
    req.nextUrl.searchParams.get('desde'),
    req.nextUrl.searchParams.get('hasta'),
  )
  try {
    return NextResponse.json(await leerResumen(rango))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error desconocido'
    log.error('no se pudo leer el resumen', { ambito: 'operacion', trace_id: trace }, e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
