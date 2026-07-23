// Presencia en vivo: cuánta gente está mirando una página AHORA.
//
// Por qué no se puede sacar de Visit/Visitor: el tracker de curiosos manda su beacon al
// OCULTAR la pestaña (visibilitychange/pagehide), o sea que registra al visitante cuando ya
// se fue. Sirve para cohortes, no para saber quién está adentro en este momento.
//
// Acá el navegador avisa "estoy" al cargar y repite cada tanto mientras la pestaña está
// visible. Una clave por (página, visitante) con la hora del último aviso; se cuenta lo
// visto en los últimos minutos.
//
// Se apoya en la tabla RateLimit y no en una tabla nueva: la fila es efímera, tiene la misma
// forma (clave + marca de tiempo) y la limpieza oportunista de lib/ratelimit.ts ya la barre
// sola pasado un día. Una tabla propia obligaría a una migración para nada.
import { getPool } from '@/lib/diag'

const PREFIJO = 'presencia:'

/**
 * Escapa los comodines de LIKE. Sin esto, una URL con guion bajo —`/productos/inc101_v2`—
 * haría que `_` matchee cualquier carácter y el contador sumara visitantes de otras
 * páginas. El `%` y la barra invertida, lo mismo.
 */
function escaparLike(s: string): string {
  return s.replace(/[\\%_]/g, c => `\\${c}`)
}

/** Normaliza la página a una clave estable: sin dominio, sin query, sin barra final. */
export function claveDePagina(url: string): string {
  const limpio = String(url || '')
    .split('?')[0]
    .split('#')[0]
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/\/+$/, '')
    .slice(0, 120)
  return limpio || '/'
}

/**
 * Registra que este visitante está en esta página, y devuelve cuántos hay.
 *
 * El upsert pisa la marca de tiempo en cada aviso: por eso alguien que sigue leyendo cuenta
 * como presente, y alguien que cerró la pestaña deja de contar al vencer la ventana.
 */
export async function marcarYContar(
  pagina: string,
  vid: string,
  ventanaSegundos = 180,
): Promise<number> {
  const pool = getPool()
  if (!pool) return 0

  const clave = claveDePagina(pagina)
  const key = `${PREFIJO}${clave}:${vid.slice(0, 64)}`

  try {
    await pool.query(
      `INSERT INTO "RateLimit" ("key", "ventana_inicio", "contador")
       VALUES ($1, now(), 1)
       ON CONFLICT ("key") DO UPDATE SET "ventana_inicio" = now()`,
      [key],
    )

    const { rows } = await pool.query(
      `SELECT count(*)::int AS n
         FROM "RateLimit"
        WHERE "key" LIKE $1 ESCAPE '\\'
          AND "ventana_inicio" > now() - make_interval(secs => $2::float)`,
      [`${PREFIJO}${escaparLike(clave)}:%`, ventanaSegundos],
    )
    return Number(rows[0]?.n ?? 0)
  } catch (e) {
    // Sin base no hay número real. Se devuelve 0 y el widget no se muestra: preferimos que
    // no aparezca a que aparezca un número inventado.
    console.error('[presencia] error:', e)
    return 0
  }
}

/** Solo lectura, para el panel: cuántos hay sin registrarse uno mismo. */
export async function contar(pagina: string, ventanaSegundos = 180): Promise<number> {
  const pool = getPool()
  if (!pool) return 0
  try {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n
         FROM "RateLimit"
        WHERE "key" LIKE $1 ESCAPE '\\'
          AND "ventana_inicio" > now() - make_interval(secs => $2::float)`,
      [`${PREFIJO}${escaparLike(claveDePagina(pagina))}:%`, ventanaSegundos],
    )
    return Number(rows[0]?.n ?? 0)
  } catch {
    return 0
  }
}
