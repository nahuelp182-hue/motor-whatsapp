// Datos del panel de apicultura: qué se le mandó al tío, si le llegó, y qué contestó.
//
// Cruza dos fuentes:
//   · EnvioApicola — el estado de cada venta, que el VPS empuja en cada ciclo.
//   · ig_diag ('reenvio_tio') — lo que el tío escribió por WhatsApp.
// La pregunta que tiene que contestar de un vistazo es "¿esto llegó y se despachó?",
// no "¿mandamos el mensaje?": un mensaje aceptado por la API puede no haberse entregado.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPool } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export type EnvioPanel = {
  interno: number
  mlOrderId: string
  fechaCompra: string
  cliente: string
  items: string
  unidades: number
  estado: string
  entregado: boolean
  intentos: number
  detalle: string | null
  enviadoAt: string | null
  despachado: boolean
  avisosTio: number
  escalados: number
  // Semáforo ya resuelto en el server, para que la vista no repita la lógica.
  salud: 'ok' | 'atencion' | 'problema'
  motivo: string
}

export type MensajeTio = { ts: string; texto: string }

// Reglas del semáforo, en un solo lugar.
function evaluar(e: {
  estado: string; wa_entregado: boolean; despachado: boolean; escalados: number
  fecha_compra: Date; enviado_at: Date | null
}): { salud: EnvioPanel['salud']; motivo: string } {
  const horas = (Date.now() - e.fecha_compra.getTime()) / 3_600_000

  if (e.estado === 'wa_fallido') return { salud: 'problema', motivo: 'El aviso no se pudo entregar al tío' }
  if (e.escalados > 0 && !e.despachado) return { salud: 'problema', motivo: `Sin despachar hace ${Math.round(horas)} h` }
  if (e.despachado) return { salud: 'ok', motivo: 'Despachado' }
  if (!e.wa_entregado && e.enviado_at) return { salud: 'atencion', motivo: 'Enviado, sin confirmación de entrega' }
  if (!e.enviado_at) return { salud: 'atencion', motivo: 'Todavía sin enviar (esperando etiqueta)' }
  if (horas >= 6) return { salud: 'atencion', motivo: `Entregado al tío, sin despachar hace ${Math.round(horas)} h` }
  return { salud: 'ok', motivo: 'Entregado al tío, esperando despacho' }
}

export async function GET(req: NextRequest) {
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days') ?? 1), 1), 90)
  const desde = new Date(Date.now() - days * 86_400_000)

  const filas = await prisma.envioApicola.findMany({
    where: { fecha_compra: { gte: desde } },
    orderBy: { interno: 'desc' },
  })

  const envios: EnvioPanel[] = filas.map((e) => {
    const { salud, motivo } = evaluar(e)
    return {
      interno: e.interno,
      mlOrderId: e.ml_order_id,
      fechaCompra: e.fecha_compra.toISOString(),
      cliente: e.cliente,
      items: e.items,
      unidades: e.unidades,
      estado: e.estado,
      entregado: e.wa_entregado,
      intentos: e.wa_intentos,
      detalle: e.wa_detalle,
      enviadoAt: e.enviado_at ? e.enviado_at.toISOString() : null,
      despachado: e.despachado,
      avisosTio: e.avisos_tio,
      escalados: e.escalados,
      salud,
      motivo,
    }
  })

  // Lo que contestó el tío. Vive en ig_diag, no en Prisma (lo escribe el webhook).
  let mensajes: MensajeTio[] = []
  const p = getPool()
  if (p) {
    try {
      const r = await p.query(
        `SELECT ts, detail->>'texto' AS texto
           FROM ig_diag
          WHERE kind = 'reenvio_tio'
            AND ts > now() - ($1 || ' days')::interval
          ORDER BY ts DESC
          LIMIT 200`,
        [String(days)],
      )
      mensajes = r.rows
        .filter((x: { texto: string | null }) => x.texto)
        .map((x: { ts: string; texto: string }) => ({ ts: new Date(x.ts).toISOString(), texto: x.texto }))
    } catch (e) {
      console.error('apicultura: no se pudieron leer los mensajes del tío:', e)
    }
  }

  const resumen = {
    total: envios.length,
    entregados: envios.filter((e) => e.entregado).length,
    despachados: envios.filter((e) => e.despachado).length,
    problemas: envios.filter((e) => e.salud === 'problema').length,
    atencion: envios.filter((e) => e.salud === 'atencion').length,
    unidades: envios.reduce((s, e) => s + e.unidades, 0),
  }

  return NextResponse.json({ ok: true, days, resumen, envios, mensajes })
}
