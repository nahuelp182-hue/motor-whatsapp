// Caja: lectura del panel (GET, con sesión) y push del VPS (POST, con CRON_SECRET).
//
// Las dos mitades conviven en la misma ruta pero con auth distinta, y por eso el prefijo
// NO va en API_ABIERTAS: si estuviera, el GET quedaría público y expondría la facturación
// completa. El POST valida su propio CRON_SECRET, que es el patrón de /api/despacho.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { chequearCron } from '@/lib/cron-auth'
import { leerCaja } from '@/lib/operacion/caja'
import { parseRango } from '@/lib/operacion/rango'
import { marcarHeartbeat } from '@/lib/cron-heartbeat'
import { log, traceId } from '@/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const trace = traceId(req)
  try {
    const rango = parseRango(
      req.nextUrl.searchParams.get('desde'),
      req.nextUrl.searchParams.get('hasta'),
    )
    return NextResponse.json(await leerCaja(rango))
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error desconocido'
    log.error('no se pudo leer caja', { ambito: 'operacion', trace_id: trace }, e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

const Linea = z.object({
  nombre: z.string().min(1).max(60),
  bruto: z.number(), neto: z.number(), liberado: z.number(), pendiente: z.number(),
})

// `id` es la quincena ("2026-08-2") y es la clave de idempotencia: el VPS puede reenviar el
// mismo corte tantas veces como quiera sin duplicar nada, igual que /api/despacho/envios.
const Corte = z.object({
  id: z.string().regex(/^\d{4}-\d{2}-[12]$/, 'formato esperado: 2026-08-2'),
  desde: z.iso.datetime(),
  hasta: z.iso.datetime(),
  bruto: z.number(), neto: z.number(), liberado: z.number(), pendiente: z.number(),
  lineas: z.array(Linea).max(20),
})

export async function POST(req: NextRequest) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth

  const trace = traceId(req)
  try {
    const parsed = Corte.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'corte inválido', detalle: parsed.error.issues }, { status: 400 })
    }
    const c = parsed.data

    // La identidad que sostiene toda la pantalla: lo cobrado se parte en lo que ya está
    // disponible y lo que MercadoPago todavía retiene. Si no cierra, el corte está mal
    // calculado del otro lado y guardarlo haría que el panel mostrara plata que no existe.
    // Se tolera un peso de redondeo, no más.
    if (Math.abs(c.liberado + c.pendiente - c.neto) > 1) {
      return NextResponse.json(
        { error: 'liberado + pendiente no da neto', neto: c.neto, suma: c.liberado + c.pendiente },
        { status: 400 },
      )
    }

    const datos = {
      desde: new Date(c.desde), hasta: new Date(c.hasta),
      bruto: c.bruto, neto: c.neto, liberado: c.liberado, pendiente: c.pendiente,
      lineas: c.lineas,
    }
    await prisma.corteCaja.upsert({ where: { id: c.id }, create: { id: c.id, ...datos }, update: datos })
    await marcarHeartbeat('operacion-caja', true, `corte ${c.id}`)
    return NextResponse.json({ ok: true, id: c.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error desconocido'
    log.error('no se pudo guardar el corte de caja', { ambito: 'operacion', trace_id: trace }, e)
    await marcarHeartbeat('operacion-caja', false, msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
