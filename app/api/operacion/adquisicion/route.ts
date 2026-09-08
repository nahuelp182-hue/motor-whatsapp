// Lo que lee la pantalla de Adquisición: Tiendanube y Meta, en vivo.
import { NextRequest, NextResponse } from 'next/server'
import { leerAdquisicion } from '@/lib/operacion/adquisicion'
import { log, traceId } from '@/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Los rangos son cerrados: el número entra en el cálculo de fechas y en el de gasto diario,
// así que un valor arbitrario del cliente saldría como una ventana absurda o un NaN.
const RANGOS = [7, 30, 45]

export async function GET(req: NextRequest) {
  const trace = traceId(req)
  const pedido = Number(req.nextUrl.searchParams.get('dias'))
  const dias = RANGOS.includes(pedido) ? pedido : 30
  try {
    return NextResponse.json(await leerAdquisicion(dias))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error desconocido'
    log.error('no se pudo leer adquisición', { ambito: 'operacion', trace_id: trace }, e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
