// Lo que lee la pantalla de Resumen.
//
// A diferencia de Logística, esta ruta SÍ sale a internet (Tiendanube y Meta): son los
// datos que no tienen todavía un cron que los guarde. Por eso responde más lento y por eso
// la pantalla trae un botón de actualizar en vez de recargar sola.
import { NextRequest, NextResponse } from 'next/server'
import { leerResumen, type Rango } from '@/lib/operacion/resumen'
import { log, traceId } from '@/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const RANGOS: Rango[] = ['24h', '7d', '30d']

export async function GET(req: NextRequest) {
  const trace = traceId(req)
  const pedido = req.nextUrl.searchParams.get('rango')
  // Se valida contra la lista y no se confía en el string: el rango entra en el cálculo de
  // fechas, y un valor inesperado saldría como NaN convertido en una ventana absurda.
  const rango: Rango = RANGOS.includes(pedido as Rango) ? (pedido as Rango) : '7d'
  try {
    return NextResponse.json(await leerResumen(rango))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error desconocido'
    log.error('no se pudo leer el resumen', { ambito: 'operacion', trace_id: trace }, e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
