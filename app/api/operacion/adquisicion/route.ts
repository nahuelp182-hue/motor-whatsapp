// Lo que lee la pantalla de Adquisición: Tiendanube y Meta, en vivo.
import { NextRequest, NextResponse } from 'next/server'
import { leerAdquisicion } from '@/lib/operacion/adquisicion'
import { parseRango } from '@/lib/operacion/rango'
import { log, traceId } from '@/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const trace = traceId(req)
  // El rango entra en el cálculo de fechas Y en el de gasto diario, así que se valida en
  // parseRango y no se confía en el string: un valor arbitrario saldría como una ventana
  // absurda o como un NaN dividiendo el gasto.
  const rango = parseRango(
    req.nextUrl.searchParams.get('desde'),
    req.nextUrl.searchParams.get('hasta'),
  )
  try {
    return NextResponse.json(await leerAdquisicion(rango))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error desconocido'
    log.error('no se pudo leer adquisición', { ambito: 'operacion', trace_id: trace }, e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
