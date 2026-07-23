// Rate limiting con ventana fija, persistido en Postgres.
//
// Por qué en la base y no en memoria: cada invocación serverless de Vercel puede correr en
// un proceso distinto, así que un contador en memoria no limita nada. La tabla es chica
// (una fila por clave activa) y el upsert es atómico, así que dos requests simultáneos no
// se pisan.
//
// Usa el pool `pg` de diag.ts (pooler de Supabase), NO el cliente Prisma: en este proyecto
// Prisma con DATABASE_URL directo no conecta en runtime, y el rate limiter "fallaba abierto"
// silenciosamente (todos los topes quedaban sin efecto). Con pg directo sí funciona.
import { getPool } from '@/lib/diag'

export type ResultadoLimite = {
  permitido: boolean
  contador: number
  limite: number
  /** Segundos que faltan para que se libere la ventana. */
  resetEn: number
}

/**
 * Consume una unidad del cupo de `clave`. Devuelve `permitido:false` cuando se pasó.
 *
 * Ante un error de base falla ABIERTO: un problema de conectividad no puede dejar la
 * tienda sin captura de leads ni sin tracking. Queda logueado para que se vea.
 */
export async function consumirLimite(
  clave: string,
  limite: number,
  ventanaSegundos: number,
): Promise<ResultadoLimite> {
  const pool = getPool()
  if (!pool) {
    // Sin DB configurada no se puede limitar. Falla abierto, pero deja rastro.
    console.error('[ratelimit] sin pool de DB — no se limita:', clave)
    return { permitido: true, contador: 0, limite, resetEn: 0 }
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO "RateLimit" ("key", "ventana_inicio", "contador")
       VALUES ($1, now(), 1)
       ON CONFLICT ("key") DO UPDATE SET
         "contador" = CASE
           WHEN "RateLimit"."ventana_inicio" < now() - make_interval(secs => $2::float)
           THEN 1 ELSE "RateLimit"."contador" + 1 END,
         "ventana_inicio" = CASE
           WHEN "RateLimit"."ventana_inicio" < now() - make_interval(secs => $2::float)
           THEN now() ELSE "RateLimit"."ventana_inicio" END
       RETURNING "contador",
                 EXTRACT(EPOCH FROM (now() - "ventana_inicio"))::int AS "edad"`,
      [clave, ventanaSegundos],
    )
    const contador = Number(rows[0]?.contador ?? 1)
    const edad = Number(rows[0]?.edad ?? 0)
    return {
      permitido: contador <= limite,
      contador,
      limite,
      resetEn: Math.max(0, ventanaSegundos - edad),
    }
  } catch (e) {
    console.error('[ratelimit] falla abierta:', clave, e)
    return { permitido: true, contador: 0, limite, resetEn: 0 }
  }
}

/** IP del cliente detrás del proxy de Vercel. */
export function ipDe(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') ?? ''
  return fwd.split(',')[0].trim() || req.headers.get('x-real-ip') || 'desconocida'
}

/** Respuesta 429 estándar. */
export function respuesta429(r: ResultadoLimite, headersExtra: Record<string, string> = {}) {
  return new Response(JSON.stringify({ error: 'Demasiadas solicitudes' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(r.resetEn || 60),
      ...headersExtra,
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// LATCHES: "esto pasa una sola vez, para siempre"
//
// Misma tabla, semántica opuesta a la de un rate limit: no vence. Se usa para que un mail
// automático salga una única vez por cliente y por hito, y para quemar un token de entrada
// de un solo uso.
//
// Por qué acá y no en una tabla nueva: el upsert de esta tabla ya es atómico, que es lo
// único que hace falta. Una tabla propia obligaría a una migración sin ganar nada.
//
// El prefijo NO es decorativo: `limpiarVencidos` lo usa para no borrar estas filas. Sin esa
// exclusión, la limpieza diaria reabriría cada latch y los clientes recibirían de nuevo
// todos los mails del ciclo.
const PREFIJO_LATCH = 'latch:'

/** Devuelve true la PRIMERA vez que se llama con esa clave, y false siempre después. */
export async function tomarLatch(clave: string): Promise<boolean> {
  const r = await consumirLimite(`${PREFIJO_LATCH}${clave}`, 1, 100 * 365 * 86400)
  return r.permitido
}

/**
 * Borra ventanas vencidas. Se llama de forma oportunista (1 de cada 50 requests) para que
 * la tabla no crezca sin control, sin sumar un cron nuevo.
 *
 * Los latches quedan afuera a propósito: son permanentes por definición.
 */
export async function limpiarVencidos(): Promise<void> {
  if (Math.random() > 0.02) return
  const pool = getPool()
  if (!pool) return
  try {
    await pool.query(
      `DELETE FROM "RateLimit"
        WHERE "ventana_inicio" < now() - interval '1 day'
          AND "key" NOT LIKE $1`,
      [`${PREFIJO_LATCH}%`],
    )
  } catch {
    /* best-effort */
  }
}
