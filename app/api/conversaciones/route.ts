import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Mensaje = {
  ts: string; role: 'user' | 'bot'; text: string
  derivar?: boolean; accion?: string; error?: boolean
  archivo?: boolean   // el cliente mandó una imagen o un documento
  auto?: boolean      // salió de una automatización (carrito, reseña, transferencia)
}
type Conversacion = {
  sender: string
  nombre: string | null
  ultimoTs: string
  mensajes: Mensaje[]
  derivada: boolean
  manual: boolean
  seguimiento: boolean
  feedback: boolean
  error: boolean
}

// Devuelve las conversaciones de WhatsApp (bot) reconstruidas desde ig_diag.
// Solo filas del canal 'wa'. Agrupa por número, arma el hilo user/bot.
//
// Además de los mensajes de texto entran acá dos cosas que antes no se veían y hacían
// parecer incoherente la conversación:
//   · 'recibido_archivo' — la foto del comprobante. Se veía el acuse del bot ("recibimos tu
//     archivo") sin nada del lado del cliente.
//   · los envíos de las automatizaciones (carrito abandonado, reseña, transferencia), que
//     viven en MessageLog y NO en ig_diag. Una charla que empezó con un mensaje nuestro
//     arrancaba de la nada, con el cliente respondiendo a algo invisible.
// Los mensajes que Nahuel o Mateo escriben a mano desde el celular siguen sin aparecer:
// esos no pasan por ningún sistema nuestro.
export async function GET(req: NextRequest) {
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days') ?? 1), 1), 60)
  const p = getPool()
  if (!p) return NextResponse.json({ error: 'DB no configurada', conversaciones: [], totales: {} })

  try {
    const rows = (await p.query(
      `SELECT id, ts, kind, sender, detail
         FROM ig_diag
        WHERE canal = 'wa'
          AND kind IN ('recibido','recibido_archivo','pensado','handoff_activo','wa_send_fail','wa_error')
          AND ts > now() - ($1 || ' days')::interval
        ORDER BY id ASC`,
      [String(days)],
    )).rows as Array<{ id: number; ts: string; kind: string; sender: string; detail: unknown }>

    const map = new Map<string, Conversacion>()
    for (const r of rows) {
      const d = (typeof r.detail === 'string' ? JSON.parse(r.detail) : r.detail) as Record<string, unknown>
      let c = map.get(r.sender)
      if (!c) {
        c = { sender: r.sender, nombre: null, ultimoTs: r.ts, mensajes: [], derivada: false, manual: false, seguimiento: false, feedback: false, error: false }
        map.set(r.sender, c)
      }
      c.ultimoTs = r.ts

      if (r.kind === 'recibido') {
        if (typeof d.nombre === 'string' && d.nombre) c.nombre = d.nombre
        if (typeof d.texto === 'string' && d.texto) c.mensajes.push({ ts: r.ts, role: 'user', text: d.texto })
      } else if (r.kind === 'pensado') {
        const text = typeof d.respuesta === 'string' ? d.respuesta : ''
        const derivar = d.derivar === true
        const accion = typeof d.accion === 'string' ? d.accion : undefined
        if (derivar) c.derivada = true
        if (accion && accion.startsWith('manual')) c.manual = true
        if (accion && accion.startsWith('seguimiento')) c.seguimiento = true
        if (d.feedback === true || accion === 'feedback') c.feedback = true
        if (text) c.mensajes.push({ ts: r.ts, role: 'bot', text, derivar, accion })
      } else if (r.kind === 'recibido_archivo') {
        if (typeof d.nombre === 'string' && d.nombre) c.nombre = d.nombre
        const cap = typeof d.caption === 'string' && d.caption ? `: "${d.caption}"` : ''
        const que = d.kind === 'document' ? 'un archivo' : 'una imagen'
        c.mensajes.push({ ts: r.ts, role: 'user', text: `📎 Envió ${que}${cap}`, archivo: true })
      } else if (r.kind === 'handoff_activo') {
        // El recordatorio "ya le pasé tu caso al equipo" se manda de verdad, pero se
        // registra con este kind: en el panel faltaba, y la respuesta del cliente a ese
        // mensaje quedaba colgando.
        if (d.aviso === true) {
          c.mensajes.push({
            ts: r.ts, role: 'bot', accion: 'handoff_activo',
            text: 'Ya le pasé tu caso al equipo y lo están viendo 🙌 Te responden por acá o al número que te compartí. Perdón por la demora.',
          })
        }
      } else if (r.kind === 'wa_send_fail' || r.kind === 'wa_error') {
        c.error = true
      }
    }

    await sumarEnviosAutomaticos(p, map, days)

    const conversaciones = Array.from(map.values())
      .filter((c) => c.mensajes.length > 0)
      .sort((a, b) => (a.ultimoTs < b.ultimoTs ? 1 : -1))

    const totales = {
      conversaciones: conversaciones.length,
      mensajes: conversaciones.reduce((s, c) => s + c.mensajes.length, 0),
      derivadas: conversaciones.filter((c) => c.derivada).length,
      manuales: conversaciones.filter((c) => c.manual).length,
      seguimientos: conversaciones.filter((c) => c.seguimiento).length,
      feedbacks: conversaciones.filter((c) => c.feedback).length,
      errores: conversaciones.filter((c) => c.error).length,
    }

    return NextResponse.json({ conversaciones, totales, days })
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 300), conversaciones: [], totales: {} })
  }
}

// Nombre legible de cada automatización, para no mostrar el identificador crudo.
const NOMBRE_EVENTO: Record<string, string> = {
  cart_recovery_1: 'carrito abandonado (1º aviso)',
  cart_recovery_2: 'carrito abandonado (2º aviso)',
  review_request: 'pedido de reseña',
  transfer_instructions: 'datos para transferir',
  cross_sell: 'recomendación post-compra',
  ciclo_cultivo: 'seguimiento del cultivo',
}

/**
 * Suma al hilo los mensajes que mandaron las automatizaciones. Viven en MessageLog (Prisma)
 * y no en ig_diag, así que hasta ahora eran invisibles: se veía al cliente respondiendo a
 * algo que el panel no mostraba.
 *
 * Solo se agregan a conversaciones que YA existen. Si no, el panel se llenaría de envíos a
 * gente que nunca contestó, que es otra cosa (eso se mira en las métricas de campañas).
 *
 * SQL crudo a propósito: el cliente Prisma selecciona todas las columnas del modelo, y el
 * esquema local tiene columnas que la base de producción todavía no tiene.
 */
async function sumarEnviosAutomaticos(
  p: NonNullable<ReturnType<typeof getPool>>,
  map: Map<string, Conversacion>,
  days: number,
): Promise<void> {
  if (map.size === 0) return
  try {
    // Índice por los últimos 10 dígitos: el teléfono del cliente en Tiendanube y el id de
    // WhatsApp no se escriben igual (prefijo 549, el 15, separadores).
    const porTel = new Map<string, Conversacion>()
    for (const c of map.values()) porTel.set(c.sender.replace(/\D/g, '').slice(-10), c)

    const envios = (await p.query(
      `SELECT m."createdAt" AS ts, m.tipo_evento, c.telefono
         FROM "MessageLog" m
         JOIN "Customer" c ON c.id = m.customer_id
        WHERE m.estado::text = 'SENT'
          AND m."createdAt" > now() - ($1 || ' days')::interval
        ORDER BY m."createdAt" ASC`,
      [String(days)],
    )).rows as Array<{ ts: string; tipo_evento: string; telefono: string }>

    for (const e of envios) {
      const c = porTel.get(String(e.telefono ?? '').replace(/\D/g, '').slice(-10))
      if (!c) continue
      c.mensajes.push({
        ts: e.ts, role: 'bot', auto: true, accion: e.tipo_evento,
        text: `⚙️ Salió el mensaje automático: ${NOMBRE_EVENTO[e.tipo_evento] ?? e.tipo_evento}`,
      })
    }

    // Reordenar los hilos tocados: los envíos entran fuera de orden.
    for (const c of map.values()) c.mensajes.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0))
  } catch (e) {
    // El panel sirve igual sin esto: se muestra lo que hay en ig_diag.
    console.error('conversaciones: envíos automáticos no disponibles:', e)
  }
}
