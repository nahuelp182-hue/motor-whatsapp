// Log de diagnóstico persistente (tabla ig_diag en Supabase). Best-effort: nunca rompe el flujo.
import pg from 'pg'

let pool: pg.Pool | null = null

function getPool(): pg.Pool | null {
  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD) return null
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

/** Registra un evento de diagnóstico. Nunca lanza. */
export async function diag(kind: string, sender: string, detail: unknown): Promise<void> {
  try {
    const p = getPool()
    if (!p) return
    await p.query('INSERT INTO ig_diag (kind, sender, detail) VALUES ($1, $2, $3)', [
      kind,
      sender,
      JSON.stringify(detail ?? {}).slice(0, 8000),
    ])
  } catch (e) {
    console.error('diag error:', e)
  }
}

// Precios Claude Haiku 4.5 (USD por token). Ajustar si cambia el modelo.
const PRICE = {
  input: 1.0 / 1_000_000,
  output: 5.0 / 1_000_000,
  cache_read: 0.1 / 1_000_000,
  cache_write: 1.25 / 1_000_000,
}

type Usage = {
  input_tokens?: number | null
  output_tokens?: number | null
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
}

/** Registra el consumo de tokens/costo de una llamada a Claude. Nunca lanza. */
export async function logClaudeUsage(channel: string, model: string, usage: Usage | null | undefined): Promise<void> {
  try {
    const p = getPool()
    if (!p || !usage) return
    const inp = usage.input_tokens ?? 0
    const out = usage.output_tokens ?? 0
    const cread = usage.cache_read_input_tokens ?? 0
    const cwrite = usage.cache_creation_input_tokens ?? 0
    const cost = inp * PRICE.input + out * PRICE.output + cread * PRICE.cache_read + cwrite * PRICE.cache_write
    await p.query(
      `INSERT INTO claude_usage (channel, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_usd)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [channel, model, inp, out, cread, cwrite, cost],
    )
  } catch (e) {
    console.error('logClaudeUsage error:', e)
  }
}

/** Evita responder dos veces el mismo comentario (Meta puede reenviar el webhook). Nunca lanza. */
export async function comentarioYaRespondido(commentId: string): Promise<boolean> {
  try {
    const p = getPool()
    if (!p) return false
    const r = await p.query(
      `SELECT 1 FROM ig_diag WHERE kind = 'coment_ok' AND detail->>'comment_id' = $1
         AND ts > now() - interval '7 days' LIMIT 1`,
      [commentId],
    )
    return (r.rowCount ?? 0) > 0
  } catch (e) {
    console.error('comentarioYaRespondido error:', e)
    return false
  }
}

/**
 * Debounce de ráfagas: ¿llegó un 'recibido' MÁS NUEVO de este sender que el mío?
 * Si sí, esta invocación no debe responder (la última de la ráfaga responderá por todos).
 * Nunca lanza; ante error devuelve false (responde igual, no peor que hoy).
 */
export async function hayMensajePosterior(sender: string, wamid: string): Promise<boolean> {
  try {
    const p = getPool()
    if (!p || !wamid) return false
    const r = await p.query(
      `SELECT 1 FROM ig_diag
        WHERE sender = $1 AND kind = 'recibido'
          AND ts > now() - interval '2 minutes'
          AND id > COALESCE((SELECT id FROM ig_diag WHERE detail->>'wamid' = $2 ORDER BY id DESC LIMIT 1), 0)
        LIMIT 1`,
      [sender, wamid],
    )
    return (r.rowCount ?? 0) > 0
  } catch (e) {
    console.error('hayMensajePosterior error:', e)
    return false
  }
}

/**
 * Junta el texto de todos los 'recibido' de este sender posteriores a su último 'pensado'
 * (o de los últimos 2 min si nunca hubo respuesta). Une la ráfaga en un solo mensaje.
 * Nunca lanza; ante error devuelve [].
 */
export async function textosDeLaRafaga(sender: string): Promise<string[]> {
  try {
    const p = getPool()
    if (!p) return []
    const r = await p.query(
      `SELECT detail FROM ig_diag
        WHERE sender = $1 AND kind = 'recibido'
          AND id > COALESCE((SELECT id FROM ig_diag WHERE sender = $1 AND kind = 'pensado' ORDER BY id DESC LIMIT 1), 0)
          AND ts > now() - interval '2 minutes'
        ORDER BY id ASC`,
      [sender],
    )
    const out: string[] = []
    for (const row of r.rows) {
      const d = typeof row.detail === 'string' ? JSON.parse(row.detail) : row.detail
      if (d?.texto) out.push(d.texto as string)
    }
    return out
  } catch (e) {
    console.error('textosDeLaRafaga error:', e)
    return []
  }
}

export type Turno = { role: 'user' | 'assistant'; content: string }

/**
 * Reconstruye el hilo de conversación reciente de un sender desde ig_diag.
 * Devuelve turnos alternados user/assistant (excluye el 'recibido' actual, que aún no fue respondido).
 * Nunca lanza; si falla devuelve [].
 */
export async function getHistorial(sender: string, sinceHours = 6, maxTurnos = 12): Promise<Turno[]> {
  try {
    const p = getPool()
    if (!p) return []
    const r = await p.query(
      `SELECT kind, detail FROM ig_diag
       WHERE sender = $1 AND kind IN ('recibido','pensado')
         AND ts > now() - ($2 || ' hours')::interval
       ORDER BY id ASC`,
      [sender, String(sinceHours)],
    )
    const turnos: Turno[] = []
    for (const row of r.rows) {
      const d = typeof row.detail === 'string' ? JSON.parse(row.detail) : row.detail
      if (row.kind === 'recibido' && d?.texto) turnos.push({ role: 'user', content: d.texto })
      else if (row.kind === 'pensado' && d?.respuesta) turnos.push({ role: 'assistant', content: d.respuesta })
    }
    // El último evento es el 'recibido' actual (aún sin 'pensado'): lo quitamos, el caller pasa el mensaje actual aparte.
    if (turnos.length && turnos[turnos.length - 1].role === 'user') turnos.pop()
    return turnos.slice(-maxTurnos)
  } catch (e) {
    console.error('getHistorial error:', e)
    return []
  }
}
