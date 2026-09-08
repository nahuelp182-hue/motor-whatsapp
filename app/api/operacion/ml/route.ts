// Push de MercadoLibre desde el VPS: ventas y reputación de MICELIUMSTORE.
//
// Solo POST, y con CRON_SECRET propio. El prefijo /api/operacion NO va en API_ABIERTAS
// (abriría los GET, que exponen facturación), así que el middleware permite esta ruta por
// coincidencia exacta de método — ver API_POST_ABIERTO en middleware.ts.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { chequearCron } from '@/lib/cron-auth'
import { marcarHeartbeat } from '@/lib/cron-heartbeat'
import { log, traceId } from '@/lib/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const Venta = z.object({
  order_id: z.string().min(1).max(40),
  fecha: z.iso.datetime(),
  total: z.number().min(0),
  unidades: z.number().int().min(0).max(500).default(1),
  titulo: z.string().max(200).optional(),
  sku: z.string().max(60).optional(),
  canal: z.enum(['apicola', 'incubadora', 'otros']),
  estado: z.string().min(1).max(30),
})

const Reputacion = z.object({
  nivel: z.string().min(1).max(20),
  completadas: z.number().int().min(0),
  canceladas: z.number().int().min(0),
  reclamos: z.number().min(0).max(1).nullable().optional(),
  demoras: z.number().min(0).max(1).nullable().optional(),
})

// El tope de 300 ventas por push no es capricho: el VPS empuja una ventana móvil corta cada
// media hora, así que un lote grande significa que alguien pidió un backfill enorme — y eso
// se hace en tandas, no en una request que puede cortarse por timeout a mitad de camino.
const Cuerpo = z.object({
  ventas: z.array(Venta).max(300).default([]),
  reputacion: Reputacion.nullable().optional(),
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
    const { ventas, reputacion } = parsed.data

    // Upsert por order_id: el VPS reenvía la misma ventana en cada ciclo y eso no puede
    // duplicar nada. Además una orden puede cambiar de estado (paid → cancelled) después,
    // así que el push tiene que poder corregir lo que ya guardó.
    for (const v of ventas) {
      const datos = {
        fecha: new Date(v.fecha), total: v.total, unidades: v.unidades,
        titulo: v.titulo ?? null, sku: v.sku ?? null, canal: v.canal, estado: v.estado,
      }
      await prisma.ventaMl.upsert({
        where: { order_id: v.order_id },
        create: { order_id: v.order_id, ...datos },
        update: datos,
      })
    }

    // La reputación se APENDEA y no se pisa: el valor puntual dice dónde estamos, la serie
    // dice hacia dónde vamos, y lo segundo es lo único sobre lo que se puede actuar.
    if (reputacion) {
      await prisma.reputacionMl.create({
        data: {
          nivel: reputacion.nivel,
          completadas: reputacion.completadas,
          canceladas: reputacion.canceladas,
          reclamos: reputacion.reclamos ?? null,
          demoras: reputacion.demoras ?? null,
        },
      })
    }

    await marcarHeartbeat('operacion-ml', true, `${ventas.length} ventas${reputacion ? ' · reputación ' + reputacion.nivel : ''}`)
    return NextResponse.json({ ok: true, ventas: ventas.length, reputacion: !!reputacion })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error desconocido'
    log.error('no se pudo guardar el push de MercadoLibre', { ambito: 'operacion', trace_id: trace }, e)
    await marcarHeartbeat('operacion-ml', false, msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
