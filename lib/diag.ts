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
