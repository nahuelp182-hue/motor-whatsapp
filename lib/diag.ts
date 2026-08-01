// Log de diagnóstico persistente (tabla ig_diag en Supabase). Best-effort: nunca rompe el flujo.

// El pool vive en lib/db.ts — había seis copias de esta misma función repartidas por el
// proyecto, cada una abriendo su propia conexión. Se re-exporta desde acá porque varios
// módulos (ratelimit, entre otros) ya importaban `getPool` de este archivo y no hay motivo
// para tocarlos.
export { getPool } from '@/lib/db'
import { getPool } from '@/lib/db'
import { costoDe } from '@/lib/precios-ia'

/**
 * Canal por el que entró o salió el evento. Va en COLUMNA y no adentro del JSON de detalle
 * por un motivo concreto: hasta el 01/08/2026 la única marca era `detail->>'ch'`, que solo
 * ponía WhatsApp, así que Instagram y Messenger quedaban indistinguibles entre sí y del
 * WhatsApp anterior al 11/07. Consecuencia real: **el webhook de Instagram dejó de recibir
 * mensajes el 11/07 y nadie se enteró durante tres semanas**, porque en la tabla se veía un
 * total sano que en realidad era todo WhatsApp.
 *
 * `null` = fila vieja, anterior a esta columna. No se adivina: no había forma de saber si
 * era IG o Messenger.
 */
export type Canal = 'wa' | 'ig' | 'messenger' | 'web'

/** Registra un evento de diagnóstico. Nunca lanza. */
export async function diag(
  kind: string,
  sender: string,
  detail: unknown,
  canal?: Canal,
): Promise<void> {
  try {
    const p = getPool()
    if (!p) return
    await p.query('INSERT INTO ig_diag (kind, sender, detail, canal) VALUES ($1, $2, $3, $4)', [
      kind,
      sender,
      JSON.stringify(detail ?? {}).slice(0, 8000),
      canal ?? null,
    ])
  } catch (e) {
    console.error('diag error:', e)
  }
}

// Los precios salían de una constante local fija a Haiku 4.5. Ahora viven en
// lib/precios-ia.ts, junto con los de los otros modelos y proveedores que entraron al
// medir los scripts del VPS: una tabla de precios repetida en cinco archivos se
// desactualiza en cuatro de ellos.
type Usage = {
  input_tokens?: number | null
  output_tokens?: number | null
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
  // Las búsquedas web se facturan aparte (USD 10 cada 1.000). El bot no las usa hoy, pero
  // el campo se lee igual: si mañana se le habilita la herramienta, el costo aparece solo
  // en vez de quedar invisible hasta que alguien mire la factura.
  server_tool_use?: { web_search_requests?: number | null } | null
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
    const web = usage.server_tool_use?.web_search_requests ?? 0
    const { usd, modeloDesconocido } = costoDe(model, {
      input: inp, output: out, cacheLectura: cread, cacheEscritura: cwrite, busquedasWeb: web,
    })
    if (modeloDesconocido) {
      console.error(`[uso-ia] modelo sin precio en la tabla: ${model} — el costo es un piso, no un valor confiable`)
    }
    await p.query(
      `INSERT INTO claude_usage (channel, model, provider, input_tokens, output_tokens,
         cache_read_tokens, cache_write_tokens, web_search_requests, cost_usd)
       VALUES ($1,$2,'anthropic',$3,$4,$5,$6,$7,$8)`,
      [channel, model, inp, out, cread, cwrite, web, usd],
    )
  } catch (e) {
    console.error('logClaudeUsage error:', e)
  }
}

/**
 * Gasto de Claude en las últimas 24 h, en USD, por canal.
 *
 * Los topes de `/api/asistente` cuentan REQUESTS, no dólares, y eso no es lo mismo: una
 * conversación larga con mucho contexto cuesta varias veces lo que una pregunta suelta. El
 * tope de requests evita el abuso; esto avisa cuando el costo real se dispara aunque el
 * volumen parezca normal.
 *
 * Devuelve null si no se puede calcular: quien llama decide, pero no debería alertar por
 * un error de base (ya hay un aviso para eso).
 */
export async function gastoClaude24h(): Promise<{ total: number; porCanal: Record<string, number> } | null> {
  try {
    const p = getPool()
    if (!p) return null
    const r = await p.query(
      `SELECT channel, COALESCE(sum(cost_usd), 0) AS costo
         FROM claude_usage
        WHERE ts > now() - interval '24 hours'
        GROUP BY channel`,
    )
    const porCanal: Record<string, number> = {}
    let total = 0
    for (const row of r.rows) {
      const costo = Number(row.costo ?? 0)
      porCanal[String(row.channel)] = costo
      total += costo
    }
    return { total, porCanal }
  } catch (e) {
    console.error('gastoClaude24h error:', e)
    return null
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

/**
 * Dedupe de entregas repetidas del webhook: Meta reintenta el POST si no le devolvemos
 * 200 rápido, y el MISMO mensaje se procesaba (y contestaba) dos veces. Inserta el wamid
 * en `wa_procesado` y devuelve true solo la primera vez. Ante error devuelve true
 * (fail-open: contestar de más es peor, pero no contestar es mucho peor).
 */
export async function wamidEsNuevo(wamid: string): Promise<boolean> {
  try {
    const p = getPool()
    if (!p || !wamid) return true
    const r = await p.query(
      'INSERT INTO wa_procesado (wamid) VALUES ($1) ON CONFLICT (wamid) DO NOTHING',
      [wamid],
    )
    return (r.rowCount ?? 0) > 0
  } catch (e) {
    console.error('wamidEsNuevo error:', e)
    return true
  }
}

/**
 * ¿Cuándo fue la última derivación al equipo de este sender? Sirve de "handoff lock":
 * si el chat ya está en manos de una persona, el bot no vuelve a derivar ni repite.
 * Devuelve null si no hubo (o si falla).
 */
export async function ultimaDerivacion(sender: string, horas = 6): Promise<Date | null> {
  try {
    const p = getPool()
    if (!p) return null
    const r = await p.query(
      `SELECT ts FROM ig_diag
        WHERE sender = $1 AND kind = 'pensado'
          AND canal = 'wa' AND detail->>'derivar' = 'true'
          AND ts > now() - ($2 || ' hours')::interval
        ORDER BY id DESC LIMIT 1`,
      [sender, String(horas)],
    )
    return r.rows[0]?.ts ?? null
  } catch (e) {
    console.error('ultimaDerivacion error:', e)
    return null
  }
}

/** ¿Ya mandamos un evento de este kind a este sender en las últimas N horas? */
export async function huboAvisoReciente(sender: string, kind: string, horas: number): Promise<boolean> {
  try {
    const p = getPool()
    if (!p) return false
    const r = await p.query(
      `SELECT 1 FROM ig_diag WHERE sender = $1 AND kind = $2
         AND ts > now() - ($3 || ' hours')::interval LIMIT 1`,
      [sender, kind, String(horas)],
    )
    return (r.rowCount ?? 0) > 0
  } catch (e) {
    console.error('huboAvisoReciente error:', e)
    return false
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
       WHERE sender = $1 AND kind IN ('recibido','recibido_archivo','pensado')
         AND ts > now() - ($2 || ' hours')::interval
       ORDER BY id ASC`,
      [sender, String(sinceHours)],
    )
    const turnos: Turno[] = []
    for (const row of r.rows) {
      const d = typeof row.detail === 'string' ? JSON.parse(row.detail) : row.detail
      if (row.kind === 'recibido' && d?.texto) turnos.push({ role: 'user', content: d.texto })
      else if (row.kind === 'recibido_archivo') {
        // Un archivo no pasa por el cerebro (lo atiende manejarArchivo con un acuse fijo),
        // pero SÍ es un turno del cliente. Sin esto el modelo veía su propio acuse
        // ("recibimos tu archivo") sin nada del otro lado y perdía el hilo: el 27/07/26 un
        // cliente mandó el comprobante, escribió "realicé un pedido por la web" y le
        // contestó el menú de bienvenida.
        const cap = typeof d?.caption === 'string' && d.caption ? `: "${d.caption}"` : ''
        const que = d?.kind === 'document' ? 'un archivo' : 'una imagen'
        turnos.push({ role: 'user', content: `[el cliente envió ${que}${cap} — probablemente el comprobante de pago]` })
      }
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
