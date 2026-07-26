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
  /** true cuando el veredicto no se pudo calcular y salió del modo de falla. */
  degradado?: boolean
}

/**
 * Qué hacer cuando la base no responde y el cupo no se puede contar.
 *
 *  - `permitir` (default): para tracking, leads y captura. Un problema de conectividad no
 *    puede dejar la tienda sin registrar visitas ni sin tomar un lead. Se pierde el tope,
 *    que es el mal menor.
 *  - `rechazar`: para los topes que protegen PLATA (llamadas a la API de Claude). Un
 *    control de gasto que falla abierto no es un control de gasto: justo cuando la base se
 *    cae —cuando menos mirando estás— desaparece el techo diario y la factura queda sin
 *    tope. Si no se puede contar, no se gasta.
 */
export type ModoFalla = 'permitir' | 'rechazar'

/**
 * Consume una unidad del cupo de `clave`. Devuelve `permitido:false` cuando se pasó.
 *
 * Ante un error de base aplica `modoFalla` (ver arriba). Siempre queda logueado.
 */
export async function consumirLimite(
  clave: string,
  limite: number,
  ventanaSegundos: number,
  modoFalla: ModoFalla = 'permitir',
): Promise<ResultadoLimite> {
  const anteFalla = (motivo: string): ResultadoLimite => {
    console.error(`[ratelimit] ${motivo} — modo ${modoFalla}:`, clave)
    return {
      permitido: modoFalla === 'permitir',
      contador: 0,
      limite,
      resetEn: modoFalla === 'rechazar' ? 60 : 0,
      degradado: true,
    }
  }

  const pool = getPool()
  if (!pool) return anteFalla('sin pool de DB')
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
    console.error('[ratelimit] error de base:', clave, e)
    return anteFalla('error de base')
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

/**
 * Devuelve true la PRIMERA vez que se llama con esa clave, y false siempre después.
 *
 * Falla CERRADO: si la base no responde no hay forma de saber si el latch ya estaba tomado,
 * y acá "permitir" significa mandarle otra vez el mismo mail a un cliente. Ante la duda no
 * se manda: el ciclo lo reintenta en la corrida siguiente y el mail sale tarde en vez de
 * salir dos veces.
 */
export async function tomarLatch(clave: string): Promise<boolean> {
  const r = await consumirLimite(`${PREFIJO_LATCH}${clave}`, 1, 100 * 365 * 86400, 'rechazar')
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
