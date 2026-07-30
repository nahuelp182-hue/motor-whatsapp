// El VPS empuja acá el estado de cada envío apícola, en cada ciclo.
//
// El VPS lleva la verdad en SQLite y no es alcanzable desde Vercel (vive detrás de
// Tailscale), así que el panel no puede consultarlo: la sincronización va al revés.
// Es idempotente — mandar el mismo envío dos veces no duplica nada.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { chequearCron } from '@/lib/cron-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type EnvioEntrada = {
  interno: number
  shipment_id: string
  ml_order_id: string
  fecha_compra: string
  cliente: string
  items: string
  unidades?: number
  estado: string
  wamid?: string | null
  wa_entregado?: boolean
  wa_leido?: boolean
  wa_intentos?: number
  wa_detalle?: string | null
  enviado_at?: string | null
  despachado?: boolean
  avisos_tio?: number
  escalados?: number
}

function fecha(v: string | null | undefined): Date | null {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

export async function POST(req: Request) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth

  let body: { envios?: EnvioEntrada[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const envios = (body.envios ?? []).slice(0, 200)
  if (!envios.length) return NextResponse.json({ ok: true, guardados: 0 })

  let guardados = 0
  const fallidos: number[] = []

  for (const e of envios) {
    const comprado = fecha(e.fecha_compra)
    if (!Number.isFinite(e.interno) || !comprado) {
      fallidos.push(e.interno)
      continue
    }
    const datos = {
      shipment_id: String(e.shipment_id ?? ''),
      ml_order_id: String(e.ml_order_id ?? ''),
      fecha_compra: comprado,
      cliente: String(e.cliente ?? '').slice(0, 200),
      items: String(e.items ?? '').slice(0, 1000),
      unidades: Number(e.unidades ?? 1),
      estado: String(e.estado ?? 'pendiente'),
      wamid: e.wamid ?? null,
      wa_entregado: Boolean(e.wa_entregado),
      wa_leido: Boolean(e.wa_leido),
      wa_intentos: Number(e.wa_intentos ?? 0),
      wa_detalle: e.wa_detalle ? String(e.wa_detalle).slice(0, 500) : null,
      enviado_at: fecha(e.enviado_at),
      despachado: Boolean(e.despachado),
      avisos_tio: Number(e.avisos_tio ?? 0),
      escalados: Number(e.escalados ?? 0),
    }
    try {
      await prisma.envioApicola.upsert({
        where: { interno: e.interno },
        update: datos,
        create: { interno: e.interno, ...datos },
      })
      guardados++
    } catch (err) {
      console.error('sync envío apícola falló:', e.interno, err)
      fallidos.push(e.interno)
    }
  }

  return NextResponse.json({ ok: true, guardados, fallidos })
}
