import { NextRequest, NextResponse } from 'next/server'
import pg from 'pg'

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

type Mensaje = { ts: string; role: 'user' | 'bot'; text: string; derivar?: boolean; accion?: string; error?: boolean }
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
// Solo filas con detail->>'ch' = 'wa'. Agrupa por número, arma el hilo user/bot.
export async function GET(req: NextRequest) {
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days') ?? 1), 1), 60)
  const p = getPool()
  if (!p) return NextResponse.json({ error: 'DB no configurada', conversaciones: [], totales: {} })

  try {
    const rows = (await p.query(
      `SELECT id, ts, kind, sender, detail
         FROM ig_diag
        WHERE detail->>'ch' = 'wa'
          AND kind IN ('recibido','pensado','wa_send_fail','wa_error')
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
      } else if (r.kind === 'wa_send_fail' || r.kind === 'wa_error') {
        c.error = true
      }
    }

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
