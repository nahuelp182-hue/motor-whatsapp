// Latido del proceso de ventas apícola que corre en el VPS (Hetzner).
//
// Por qué existe: hasta ahora, si el cron del VPS moría, el VPS se caía o el token
// de ML quedaba en 401, el sistema no avisaba nada — y "ningún aviso" es exactamente
// lo que se ve cuando no hubo ventas. La ceguera era indistinguible de la calma.
// Vercel es infraestructura separada de Hetzner: si el VPS entero desaparece, este
// lado sigue vivo y el cron `despacho-watchdog` lo nota.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { chequearCron } from '@/lib/cron-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth

  let body: { nombre?: string; meta?: Prisma.InputJsonValue } = {}
  try {
    body = await req.json()
  } catch {
    /* cuerpo vacío = latido pelado, sirve igual */
  }
  const nombre = (body.nombre || 'ventas_apicola').slice(0, 64)
  const meta = body.meta ?? Prisma.JsonNull

  await prisma.heartbeat.upsert({
    where: { nombre },
    // Late de nuevo => se limpia `alertado` para que una próxima caída vuelva a avisar.
    update: { ts: new Date(), meta, alertado: null },
    create: { nombre, meta },
  })

  return NextResponse.json({ ok: true, nombre, ts: new Date().toISOString() })
}
