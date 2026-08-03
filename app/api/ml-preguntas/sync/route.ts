// El VPS empuja acá el estado de las preguntas de MercadoLibre (MICELIUMSTORE), en cada
// ciclo del autoresponder (ml_autoresponder_vps.py, cron cada 15 min).
//
// El VPS lleva la verdad en ml_autoresponder_state.json y no es alcanzable desde Vercel
// (vive detrás de Tailscale), así que la sincronización va al revés, igual que
// /api/despacho/envios. Es idempotente — mandar la misma pregunta dos veces no duplica nada.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { chequearCron } from '@/lib/cron-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PreguntaEntrada = {
  question_id: string
  item_id?: string | null
  item_titulo?: string | null
  comprador_id?: string | null
  comprador_nick?: string | null
  texto: string
  respuesta?: string | null
  estado: string
  motivo_bloqueo?: string | null
  intent?: string | null
  fecha_pregunta: string
  fecha_respuesta?: string | null
}

function fecha(v: string | null | undefined): Date | null {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

export async function POST(req: Request) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth

  let body: { preguntas?: PreguntaEntrada[] }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const preguntas = (body.preguntas ?? []).slice(0, 200)
  if (!preguntas.length) return NextResponse.json({ ok: true, guardados: 0 })

  let guardados = 0
  const fallidos: string[] = []

  for (const p of preguntas) {
    const creada = fecha(p.fecha_pregunta)
    if (!p.question_id || !p.texto || !creada) {
      fallidos.push(p.question_id ?? '?')
      continue
    }
    const datos = {
      item_id: p.item_id ?? null,
      item_titulo: p.item_titulo ?? null,
      comprador_id: p.comprador_id ?? null,
      comprador_nick: p.comprador_nick ?? null,
      texto: String(p.texto).slice(0, 2000),
      respuesta: p.respuesta ? String(p.respuesta).slice(0, 2000) : null,
      estado: String(p.estado ?? 'pendiente'),
      motivo_bloqueo: p.motivo_bloqueo ? String(p.motivo_bloqueo).slice(0, 500) : null,
      intent: p.intent ?? null,
      fecha_pregunta: creada,
      fecha_respuesta: fecha(p.fecha_respuesta),
    }
    try {
      await prisma.mlPregunta.upsert({
        where: { question_id: p.question_id },
        update: datos,
        create: { question_id: p.question_id, ...datos },
      })
      guardados++
    } catch (err) {
      console.error('sync pregunta ML falló:', p.question_id, err)
      fallidos.push(p.question_id)
    }
  }

  return NextResponse.json({ ok: true, guardados, fallidos })
}
