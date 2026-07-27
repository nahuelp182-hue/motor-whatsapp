// Log estructurado.
//
// POR QUÉ
//
// Hasta acá todo era `console.error('[wa] algo salió mal:', e)`. Eso sirve para leer un
// problema que ya sabés que existe y estás mirando en vivo. No sirve para lo otro:
// preguntarle a los logs "¿qué le pasó al mensaje del cliente X?" o "¿cuántos webhooks
// fallaron ayer?". Sin un campo por el que filtrar, la única herramienta es leer todo.
//
// La salida es JSON en una línea. Vercel (y cualquier agregador al que se migre después)
// indexa los campos y permite filtrar por ellos. Sigue siendo legible a ojo en la consola.
//
// QUÉ NO ES
//
// No es un reemplazo de un servicio de error tracking. Los logs de Vercel tienen retención
// corta y no alertan solos: para eso está el mail diario de resumen-bot, y más adelante
// Sentry (Bloque E del plan, pendiente porque necesita una cuenta y un DSN).

export type Nivel = 'info' | 'warn' | 'error'

export type Contexto = {
  /** Qué parte del sistema habla: 'wa', 'cola', 'cron', 'widgets'… */
  ambito: string
  /** Para seguir una request entera a través de varias líneas de log. */
  trace_id?: string
  /** Tienda, cuando aplica. Lo que hace utilizable el log el día que haya más de una. */
  store_id?: string
  /** Cualquier otro dato por el que tenga sentido filtrar después. */
  [k: string]: unknown
}

/**
 * Identificador corto para correlacionar todas las líneas de una misma request.
 *
 * Si la plataforma ya manda uno (Vercel pone `x-vercel-id`), se usa ese: así el log propio
 * y el de la plataforma se cruzan sin trabajo extra.
 */
export function traceId(req?: Request): string {
  const dePlataforma = req?.headers.get('x-vercel-id')
  if (dePlataforma) return dePlataforma.slice(0, 40)
  return Math.random().toString(36).slice(2, 10)
}

function emitir(nivel: Nivel, mensaje: string, ctx: Contexto, error?: unknown) {
  const linea: Record<string, unknown> = {
    ts: new Date().toISOString(),
    nivel,
    mensaje,
    ...ctx,
  }

  if (error !== undefined) {
    linea.error = error instanceof Error ? error.message : String(error)
    // El stack solo en errores: en info/warn es ruido que multiplica el tamaño del log.
    if (error instanceof Error && error.stack) linea.stack = error.stack.split('\n').slice(0, 4).join(' | ')
  }

  const salida = JSON.stringify(linea)
  if (nivel === 'error') console.error(salida)
  else if (nivel === 'warn') console.warn(salida)
  else console.log(salida)
}

export const log = {
  info: (mensaje: string, ctx: Contexto) => emitir('info', mensaje, ctx),
  warn: (mensaje: string, ctx: Contexto) => emitir('warn', mensaje, ctx),
  /** El tercer argumento acepta el error crudo: se serializa solo, sin `String(e)` en cada llamada. */
  error: (mensaje: string, ctx: Contexto, error?: unknown) => emitir('error', mensaje, ctx, error),
}
