import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { consumirLimite, respuesta429 } from '@/lib/ratelimit'

// Medición por widget. Esto es lo que ninguna app de terceros te da: saber cuál de los
// widgets efectivamente mueve la venta y cuál solo ocupa lugar en la página.

const TIPOS = new Set(['impresion', 'interaccion', 'conversion'])

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  // sendBeacon manda text/plain → se parsea a mano, igual que /api/track.
  let b: { widget_id?: string; tipo?: string; vid?: string }
  try {
    b = JSON.parse(await req.text())
  } catch {
    return NextResponse.json({ error: 'body inválido' }, { status: 400, headers: CORS })
  }

  const widgetId = String(b.widget_id ?? '').slice(0, 40)
  const tipo = String(b.tipo ?? '')
  if (!widgetId || !TIPOS.has(tipo)) {
    return NextResponse.json({ error: 'evento inválido' }, { status: 400, headers: CORS })
  }

  const vid = typeof b.vid === 'string' ? b.vid.slice(0, 64) : null

  // Tope por visitante: el endpoint es abierto y escribe en la base. Sin esto, cualquiera
  // llena la tabla y de paso arruina las métricas que justifican todo el motor.
  const limite = await consumirLimite(`wev:${vid ?? 'anon'}`, 200, 60 * 60)
  if (!limite.permitido) return respuesta429(limite, CORS)

  // El widget_id viene del navegador: si no existe, la FK explota. Se verifica antes para
  // devolver 204 silencioso en vez de un 500 en cada visita de una página con caché vieja.
  const existe = await prisma.widget.findUnique({ where: { id: widgetId }, select: { id: true } })
  if (!existe) return new NextResponse(null, { status: 204, headers: CORS })

  await prisma.widgetEvent.create({ data: { widget_id: widgetId, tipo, vid } })
  return new NextResponse(null, { status: 204, headers: CORS })
}
