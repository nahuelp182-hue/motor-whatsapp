// Push de las entregas de material post-venta desde el VPS.
//
// El envío del manual lo hace `envio_manuales_sku.py` (cron `25 */3` en el VPS), que es el
// único que tiene los PDFs y la casilla de empresa. Acá solo se registra el ACUSE, para que
// el panel pueda cruzarlo contra los envíos y mostrar quién quedó sin material.
//
// Solo POST y con CRON_SECRET, igual que /api/operacion/ml: el prefijo /api/operacion no está
// en API_ABIERTAS (abriría los GET), así que el middleware permite esta ruta por coincidencia
// exacta de método — ver API_POST_ABIERTO en middleware.ts.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { chequearCron } from '@/lib/cron-auth'
import { marcarHeartbeat } from '@/lib/cron-heartbeat'
import { log, traceId } from '@/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const Entrega = z.object({
  // El nº de pedido llega como number desde el .jsonl del VPS; se coacciona a String porque
  // así es como lo guarda `EnvioSeguimiento.referencia` y el cruce se hace por igualdad.
  referencia: z.coerce.string().min(1).max(20),
  sku: z.string().min(1).max(30),
  producto: z.string().max(200).nullish(),
  email: z.string().max(200).nullish(),
  enviado_at: z.iso.datetime(),
})

// El VPS reenvía una ventana móvil en cada corrida, no el histórico completo: un lote grande
// es un backfill deliberado y se hace en tandas, no en una request que puede timeoutear.
const Cuerpo = z.object({
  entregas: z.array(Entrega).max(300).default([]),
})

export async function POST(req: NextRequest) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth

  const trace = traceId(req)
  try {
    const parsed = Cuerpo.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'payload inválido', detalle: parsed.error.issues }, { status: 400 })
    }
    const { entregas } = parsed.data

    // Upsert por `<referencia>:<sku>`: el VPS reenvía la misma ventana cada 3 h y eso no
    // puede duplicar acuses. `enviado_at` sí se actualiza (corrige un reenvío real), pero
    // `creado_at` no se toca: es cuándo el panel se enteró por primera vez.
    for (const e of entregas) {
      const id = `${e.referencia}:${e.sku}`
      const datos = {
        referencia: e.referencia,
        sku: e.sku,
        producto: e.producto ?? null,
        email: e.email ?? null,
        enviado_at: new Date(e.enviado_at),
      }
      await prisma.entregaManual.upsert({ where: { id }, create: { id, ...datos }, update: datos })
    }

    await marcarHeartbeat('operacion-manuales')
    log.info('entregas de manual registradas', { ambito: 'operacion', trace_id: trace, cantidad: entregas.length })
    return NextResponse.json({ ok: true, recibidas: entregas.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error desconocido'
    log.error('no se pudo registrar entregas de manual', { ambito: 'operacion', trace_id: trace }, e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
