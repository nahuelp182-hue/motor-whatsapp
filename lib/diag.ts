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
