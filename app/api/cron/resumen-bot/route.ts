import { NextRequest, NextResponse } from 'next/server'
import pg from 'pg'
import { notifyNahuel } from '@/lib/notify'
import { chequearCron } from '@/lib/cron-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

let pool: pg.Pool | null = null
function getPool(): pg.Pool | null {
  if (!process.env.DB_HOST) return null
  if (!pool) {
    pool = new pg.Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 6543),
      database: 'postgres',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
      max: 1,
    })
  }
  return pool
}

// Buckets de tema por palabras clave (sobre los mensajes del cliente).
const TEMAS: Array<{ nombre: string; re: RegExp }> = [
  { nombre: 'Precio/compra', re: /precio|cuánto|cuanto|sale|vale|cuesta|comprar|cuota|transferencia|pago/i },
  { nombre: 'Envío', re: /envío|envio|seguimiento|correo|andreani|llega|despacho|tracking|demora/i },
  { nombre: 'Manual/uso', re: /manual|guía|guia|instructivo|cómo se usa|como se usa|material|pdf/i },
  { nombre: 'Cultivo', re: /cultiv|micelio|sustrato|gírgola|girgola|shiitake|reishi|melena|cordyceps|contamin|temperatura|humedad/i },
  { nombre: 'Problema/garantía', re: /roto|rota|no anda|no funciona|falla|garantía|garantia|reclamo|reembolso|devolución|devolucion/i },
  { nombre: 'Saludo', re: /^(hola|buenas|buen día|buen dia|buenos días|buenas tardes|holis)\b/i },
]

function clasificar(texto: string): string {
  for (const t of TEMAS) if (t.re.test(texto)) return t.nombre
  return 'Otros'
}

export async function GET(req: NextRequest) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth

  const p = getPool()
  if (!p) return NextResponse.json({ ok: false, error: 'DB no configurada' })

  try {
    const rows = (await p.query(
      `SELECT ts, kind, sender, detail
         FROM ig_diag
        WHERE detail->>'ch' = 'wa'
          AND kind IN ('recibido','pensado','wa_send_fail','wa_error')
          AND ts > now() - interval '24 hours'
        ORDER BY id ASC`,
    )).rows as Array<{ ts: string; kind: string; sender: string; detail: unknown }>

    const senders = new Set<string>()
    let entrantes = 0
    let respuestas = 0
    let derivadas = 0
    let manuales = 0
    let errores = 0
    const temas = new Map<string, number>()

    for (const r of rows) {
      const d = (typeof r.detail === 'string' ? JSON.parse(r.detail) : r.detail) as Record<string, unknown>
      senders.add(r.sender)
      if (r.kind === 'recibido') {
        entrantes++
        const tema = clasificar(String(d.texto ?? ''))
        temas.set(tema, (temas.get(tema) ?? 0) + 1)
      } else if (r.kind === 'pensado') {
        respuestas++
        if (d.derivar === true) derivadas++
        if (typeof d.accion === 'string' && d.accion === 'manual_enviado') manuales++
      } else if (r.kind === 'wa_send_fail' || r.kind === 'wa_error') {
        errores++
      }
    }

    const topTemas = [...temas.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([nombre, n]) => `  • ${nombre}: ${n}`)
      .join('\n')

    const hayActividad = entrantes > 0
    const body =
      `Resumen últimas 24 h del asistente virtual (WhatsApp):\n\n` +
      `👥 Chats atendidos: ${senders.size}\n` +
      `💬 Mensajes entrantes: ${entrantes}\n` +
      `🤖 Respuestas del bot: ${respuestas}\n` +
      `➡️ Derivados a Mateo: ${derivadas}\n` +
      `📚 Manuales enviados: ${manuales}\n` +
      (errores ? `⚠️ Errores de envío: ${errores}\n` : '') +
      (topTemas ? `\nTemas:\n${topTemas}\n` : '') +
      `\nVer conversaciones completas:\nhttps://mw-micelium.vercel.app/conversaciones`

    // Sin actividad → no molestar con un mail vacío.
    if (hayActividad) {
      await notifyNahuel('🍄 Resumen diario del bot (WhatsApp)', body)
    }

    return NextResponse.json({
      ok: true,
      enviado: hayActividad,
      totales: { chats: senders.size, entrantes, respuestas, derivadas, manuales, errores },
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 300) })
  }
}
