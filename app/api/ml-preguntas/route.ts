// Datos del panel de Preguntas ML: qué preguntó cada comprador de MICELIUMSTORE y qué
// contestó el autoresponder (ml_autoresponder_vps.py, VPS).
//
// Fuente: MlPregunta, que el VPS empuja en cada ciclo del cron (cada 15 min), igual
// patrón que EnvioApicola/apicultura. La búsqueda de texto se resuelve en el cliente,
// mismo criterio que ya usa /api/apicultura: el volumen no lo justifica en la consulta.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export type PreguntaPanel = {
  questionId: string
  itemId: string | null
  itemTitulo: string | null
  compradorNick: string | null
  texto: string
  respuesta: string | null
  estado: string
  motivoBloqueo: string | null
  intent: string | null
  fechaPregunta: string
  fechaRespuesta: string | null
}

export async function GET(req: NextRequest) {
  const qs = req.nextUrl.searchParams
  const days = Math.min(Math.max(Number(qs.get('days') ?? 7), 1), 3650)
  const desde = new Date(Date.now() - days * 86_400_000)

  const filas = await prisma.mlPregunta.findMany({
    where: { fecha_pregunta: { gte: desde } },
    orderBy: { fecha_pregunta: 'desc' },
    take: 300,
  })

  const preguntas: PreguntaPanel[] = filas.map((p) => ({
    questionId: p.question_id,
    itemId: p.item_id,
    itemTitulo: p.item_titulo,
    compradorNick: p.comprador_nick,
    texto: p.texto,
    respuesta: p.respuesta,
    estado: p.estado,
    motivoBloqueo: p.motivo_bloqueo,
    intent: p.intent,
    fechaPregunta: p.fecha_pregunta.toISOString(),
    fechaRespuesta: p.fecha_respuesta ? p.fecha_respuesta.toISOString() : null,
  }))

  const resumen = {
    total: preguntas.length,
    auto_respondida: preguntas.filter((p) => p.estado === 'auto_respondida').length,
    pendiente_aprobacion: preguntas.filter((p) => p.estado === 'pendiente_aprobacion').length,
    bloqueada: preguntas.filter((p) => p.estado === 'bloqueada').length,
    pendiente: preguntas.filter((p) => p.estado === 'pendiente').length,
    respondida_manual: preguntas.filter((p) => p.estado === 'respondida_manual').length,
  }

  return NextResponse.json({ ok: true, days, resumen, preguntas })
}
