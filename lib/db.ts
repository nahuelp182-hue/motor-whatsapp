// Pool de Postgres para las consultas crudas (las que no pasan por Prisma).
//
// POR QUÉ EXISTE ESTE ARCHIVO
//
// Había SEIS `new pg.Pool` en el proyecto, cada uno con `max: 1`:
//   lib/diag.ts, lib/prisma.ts, y cuatro copias literales pegadas en rutas
//   (claude-usage, conversaciones, cron/radar, cron/resumen-bot).
//
// En serverless eso no es un detalle de prolijidad: cada módulo que una invocación toca
// abre su PROPIA conexión contra el pooler de Supabase. Una lambda que escribe un diag y
// además lee conversaciones gastaba dos conexiones para hacer un trabajo que necesita una.
// Multiplicado por invocaciones concurrentes, el techo de conexiones del pooler se alcanza
// con una fracción del tráfico que debería.
//
// Ahora hay UNA sola definición. Sigue con `max: 1` a propósito: es el valor que venía
// funcionando en producción, y cambiarlo es justamente lo que no se puede validar sin
// medir contra la base real (ver Bloque C del plan).
//
// LO QUE TODAVÍA NO SE UNIFICÓ, Y POR QUÉ
//
// `lib/prisma.ts` mantiene su propio pool. Compartirlo con el adaptador de Prisma cambia la
// semántica de concurrencia —con `max: 1`, una consulta cruda y una de Prisma pasan a
// hacer cola una detrás de la otra— y ese cambio no se puede verificar sin correrlo contra
// producción. Queda como el paso final del Bloque C, con la medición al lado.
import pg from 'pg'

let pool: pg.Pool | null = null

/**
 * Verificación del certificado del servidor.
 *
 * Hoy va en `false` porque es lo que viene funcionando: la conexión está cifrada, pero no
 * se valida contra quién. Ponerlo en `true` sin probarlo primero contra la base real
 * rompería TODA consulta en producción si la cadena de certificados no valida, así que el
 * interruptor queda acá y el cambio se hace encendiendo la variable en un preview
 * —una vez que el preview tenga su propia base (Bloque B)— y recién después en producción.
 */
function opcionesSsl() {
  return { rejectUnauthorized: process.env.DB_SSL_STRICT === '1' }
}

/** Pool compartido. Devuelve null si la base no está configurada (mismo contrato de antes). */
export function getPool(): pg.Pool | null {
  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD) return null
  if (!pool) {
    pool = new pg.Pool({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT ?? 6543),
      database: 'postgres',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: opcionesSsl(),
      max: 1,
    })
  }
  return pool
}
