import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { logClaudeUsage } from '@/lib/diag'
import { consumirLimite, ipDe, limpiarVencidos } from '@/lib/ratelimit'
import {
  MODELO_ASISTENTE,
  WA_HUMANO,
  systemAsistenteWeb,
  parseAsistente,
  sanearHistorial,
} from '@/lib/asistente-web'

export const runtime = 'nodejs'
export const maxDuration = 30

// Tres topes de gasto, de más fino a más grueso. El asistente es el único componente cuyo
// costo escala con el tráfico, así que el rate limit no es una feature de seguridad: es el
// control de gasto. El global con corte duro es el que impide que un pico (o un abuso)
// dispare la factura de un día.
const LIM_IP = { n: 15, ventana: 60 * 60 } // 15 mensajes/hora por IP
const LIM_SESION = { n: 40, ventana: 24 * 60 * 60 } // 40/día por sesión de chat
const LIM_GLOBAL = { n: 1500, ventana: 24 * 60 * 60 } // techo diario de todo el sitio

function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  let body: { mensaje?: unknown; historial?: unknown; sid?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'body inválido' }, { status: 400 })
  }

  const mensaje = String(body.mensaje ?? '').trim().slice(0, 1000)
  if (mensaje.length < 2) {
    return NextResponse.json({ error: 'mensaje vacío' }, { status: 400 })
  }
  // sid: id de sesión de chat que genera el navegador. Es solo para limitar; no es identidad.
  const sid = String(body.sid ?? '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40) || 'anon'

  // Corte global primero: si el sitio ya gastó su cupo del día, nadie pasa (pero se ofrece
  // el WhatsApp humano, así el visitante no queda en la nada).
  const global = await consumirLimite(`asist:global:${hoy()}`, LIM_GLOBAL.n, LIM_GLOBAL.ventana)
  if (!global.permitido) {
    return NextResponse.json({
      respuesta:
        'Estoy con mucha demanda en este momento. Escribinos por WhatsApp y te respondemos ' +
        'a la brevedad 🙌',
      whatsapp: WA_HUMANO,
      cerrado: true,
    })
  }

  const porIp = await consumirLimite(`asist:ip:${ipDe(req)}`, LIM_IP.n, LIM_IP.ventana)
  const porSesion = await consumirLimite(`asist:sid:${sid}`, LIM_SESION.n, LIM_SESION.ventana)
  void limpiarVencidos()
  if (!porIp.permitido || !porSesion.permitido) {
    return NextResponse.json({
      respuesta:
        'Fueron varias consultas seguidas. Para seguir sin esperar, escribinos por WhatsApp y ' +
        'te atendemos al toque 🙌',
      whatsapp: WA_HUMANO,
      cerrado: true,
    })
  }

  const historial = sanearHistorial(body.historial)

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: MODELO_ASISTENTE,
      max_tokens: 500,
      system: systemAsistenteWeb(),
      messages: [
        ...historial,
        {
          role: 'user',
          content: `Consulta del visitante en la web: "${mensaje}"\n\nRespondé con el formato de etiquetas.`,
        },
      ],
    })
    await logClaudeUsage('web', MODELO_ASISTENTE, response.usage)

    const block = response.content[0]
    const raw = block && block.type === 'text' ? block.text : ''
    const salida = parseAsistente(raw)

    return NextResponse.json({
      respuesta: salida.respuesta || 'Perdoná, no te seguí. ¿Me lo repetís de otra forma?',
      guia: salida.guia,
      whatsapp: salida.whatsapp ? WA_HUMANO : null,
    })
  } catch (e) {
    console.error('[asistente] error:', e)
    return NextResponse.json({
      respuesta:
        'Se me complicó responder en este momento. Escribinos por WhatsApp y te damos una ' +
        'mano enseguida 🙌',
      whatsapp: WA_HUMANO,
    })
  }
}
