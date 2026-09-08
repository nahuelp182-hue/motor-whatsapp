// Producción: lectura del estado y carga del conteo de stock.
//
// El POST es la única escritura del panel de Operación. No está en API_ABIERTAS del
// middleware, así que exige sesión: el conteo alimenta la alerta de quiebre, y alguien que
// pudiera escribirlo sin sesión podría apagar esa alerta.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { leerProduccion, guardarConteo } from '@/lib/operacion/produccion'
import { log, traceId } from '@/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const trace = traceId(req)
  try {
    return NextResponse.json(await leerProduccion())
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error desconocido'
    log.error('no se pudo leer producción', { ambito: 'operacion', trace_id: trace }, e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// El tope de 500 no es burocracia: un dedo de más en el teclado (70 en vez de 7) haría que
// la cobertura diera meses y la alerta de quiebre no volviera a saltar. Un conteo absurdo es
// más peligroso que ninguno, porque el panel lo muestra con la misma cara de dato bueno.
const Conteo = z.object({
  unidades: z.number().int().min(0).max(500),
  fecha: z.iso.datetime().optional(),
  nota: z.string().max(280).optional(),
})

export async function POST(req: NextRequest) {
  const trace = traceId(req)
  try {
    const parsed = Conteo.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'conteo inválido', detalle: parsed.error.issues }, { status: 400 })
    }
    const { unidades, fecha, nota } = parsed.data
    const cuando = fecha ? new Date(fecha) : new Date()
    if (cuando.getTime() > Date.now() + 86_400_000) {
      return NextResponse.json({ error: 'la fecha del conteo no puede ser futura' }, { status: 400 })
    }
    await guardarConteo(unidades, cuando, nota)
    return NextResponse.json(await leerProduccion())
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error desconocido'
    log.error('no se pudo guardar el conteo', { ambito: 'operacion', trace_id: trace }, e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
