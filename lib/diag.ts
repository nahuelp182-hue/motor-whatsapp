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
export type Canal = 'wa' | 'ig' | 'messenger' | 'web' | 'facebook'

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

/**
 * Ventana durante la cual una conversación se sigue considerando originada en el anuncio
 * que la abrió. El objeto `referral` llega SOLO con el primer mensaje, así que sin esta
 * ventana el segundo mensaje del mismo cliente ya no sabría de dónde vino.
 *
 * Siete días y no las 72 h de la ventana gratuita de Meta: son cosas distintas. Aquella
 * decide si el mensaje se cobra; esta decide a quién se le atribuye la venta, y una compra
 * de $288.000 no se decide en tres días.
 */
const DIAS_ATRIBUCION_CTWA = 7

/**
 * Si esta conversación nació de un anuncio click-to-WhatsApp, devuelve el id del anuncio.
 * Null cuando llegó por su cuenta (Instagram orgánico, la web, ML, el número de siempre).
 *
 * Es lo que permite que una venta cerrada por chat deje de contarse como orgánica.
 * Nunca lanza: ante cualquier problema devuelve null y la conversación se trata como
 * orgánica, que es el error conservador (subestima Meta, no lo infla).
 */
export async function origenCtwa(sender: string): Promise<{ sourceId: string | null; clid: string | null } | null> {
  try {
    const p = getPool()
    if (!p) return null
    const r = await p.query(
      `SELECT detail->>'source_id' AS source_id, detail->>'ctwa_clid' AS clid
         FROM ig_diag
        WHERE sender = $1 AND kind = 'ctwa_origen'
          AND ts > now() - ($2 || ' days')::interval
        ORDER BY ts DESC LIMIT 1`,
      [sender, String(DIAS_ATRIBUCION_CTWA)],
    )
    if (!r.rowCount) return null
    return { sourceId: r.rows[0].source_id ?? null, clid: r.rows[0].clid ?? null }
  } catch (e) {
    console.error('origenCtwa error:', e)
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

/**
 * Cuántas respuestas 'pensado' con esta `accion` mandó el bot a este sender en la ventana.
 * Sirve de red de seguridad para el "patinar": el modelo no siempre marca [DERIVAR: sí]
 * cuando no puede resolver algo (ej. un link roto, se detectó en la auditoría del 20/08 que
 * lo reintentaba disculpándose en vez de pasar a una persona) — esto cuenta CUÁNTAS veces
 * ya pasó, sin depender del propio criterio del modelo para saberlo. Ante error devuelve 0
 * (no fuerza una derivación de más por un problema de base).
 */
export async function contarAccionReciente(sender: string, accion: string, minutos: number): Promise<number> {
  try {
    const p = getPool()
    if (!p) return 0
    const r = await p.query(
      `SELECT count(*)::int AS n FROM ig_diag
        WHERE sender = $1 AND kind = 'pensado' AND detail->>'accion' = $2
          AND ts > now() - ($3 || ' minutes')::interval`,
      [sender, accion, String(minutos)],
    )
    return r.rows[0]?.n ?? 0
  } catch (e) {
    console.error('contarAccionReciente error:', e)
    return 0
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

/**
 * Motivos de derivación que NO expiran por tiempo.
 *
 * POR QUÉ EXISTE (caso Gerchu Bollati, 19/08/2026)
 * Un cliente con 10 días de demora pidió cancelar la compra. El bot derivó bien, nadie
 * atendió, y a las 6 h `HANDOFF_HORAS` venció: el bot volvió a agarrar el chat y le repitió
 * "EN CAMINO 🚚, plazo 3-5 días hábiles" a alguien que ya llevaba 10 días esperando. En el
 * turno siguiente le inventó un número de reclamo de Andreani. El cliente contestó
 * "Mentira. Eso después no pasa" y anunció una denuncia en Defensa del Consumidor.
 *
 * La derivación no falló: falló el VENCIMIENTO de la derivación. Un caso de plata, de
 * cancelación o con mención legal no vuelve al bot porque pasaron 6 horas — vuelve cuando
 * una persona lo cierra. Si nadie lo atiende, el problema es que nadie lo atendió, y para
 * eso está `atencion-watchdog`; taparlo con una respuesta automática lo empeora.
 *
 * El resto de las derivaciones (consulta de uso, un dato que el bot no tenía) sí expiran:
 * ahí retomar la conversación es lo correcto, no hay nada delicado en juego.
 */
const ACCIONES_HANDOFF_PERMANENTE = new Set([
  'no_reconoce_compra',         // cree que le cobraron algo que no compró
  'pedido_viejo_sin_confirmar', // estado de compra sin confirmar
  'consulta_intervencion',      // pidió modificar el equipo (garantía)
])

/**
 * Texto del cliente o motivo del modelo que vuelve el handoff permanente aunque la acción
 * no esté en la lista de arriba. Son las palabras que marcan que el caso ya no es una
 * consulta: es plata, cancelación o un conflicto.
 */
const RE_HANDOFF_PERMANENTE =
  /\b(?:cancel\w*|reembols\w*|reintegr\w*|devoluci[óo]n\s+del\s+dinero|defensa\s+del\s+consumidor|denunci\w*|abogad\w*|estaf\w*|fraude|desconozco\s+(?:el\s+)?(?:cargo|cobro)|contracargo|chargeback)\b/i

/**
 * Tope de antigüedad de un handoff permanente.
 *
 * "No expira por tiempo" significa que no se suelta a las 6 h, no que dure para siempre.
 * Un caso sensible que lleva SEMANAS sin una sola señal ya no es un caso abierto: o se
 * resolvió por fuera (Nahuel contestando desde su número, que no deja rastro acá) o el
 * cliente se fue. Verificado en la base real: dos personas que en julio avisaron "no compré
 * nada" —un envío masivo mal dirigido, ya resuelto— seguían marcadas 27 días después. Sin
 * este tope, el bot les habría quedado mudo si volvían a escribir.
 *
 * El tope se cuenta desde la última ACTIVIDAD del cliente, no desde la derivación: mientras
 * siga escribiendo, el caso sigue vivo por más días que hayan pasado.
 */
const DIAS_HANDOFF_PERMANENTE = 14
/**
 * Ventana en la que se buscan los mensajes del cliente que acompañaron a la derivación.
 * Se mide HACIA ATRÁS DESDE LA DERIVACIÓN, no desde ahora: lo que importa es con qué
 * contexto se derivó ese caso, no lo que el cliente escriba después.
 */
const HORAS_CONTEXTO_DERIVACION = 12

/**
 * Cómo se CIERRA un handoff permanente.
 *
 * Sin esto, marcar un caso como permanente lo dejaría mudo hasta que la derivación salga de
 * la ventana larga — 30 días en los que el bot no le contesta a un cliente cuyo problema
 * quizás ya se resolvió por WhatsApp normal. Nahuel escribiéndole al cliente desde su
 * número no deja rastro acá (el bridge de lectura está bloqueado por WhatsApp), así que el
 * cierre tiene que ser un acto explícito.
 *
 * Se cierra escribiéndole al PROPIO número del bot (que es lo que ya genera
 * `interno_nahuel`) un mensaje que contenga "cerrar <telefono>". Ver `esCierreDeHandoff`.
 */
export const KIND_HANDOFF_CERRADO = 'handoff_cerrado'

/**
 * ¿El handoff de este sender es permanente (no expira por tiempo)?
 *
 * Devuelve false —o sea, el handoff vuelve a expirar normalmente— si una persona ya cerró
 * el caso a mano después de esa derivación. Ante error devuelve false: un fallo de base no
 * debe dejar a un cliente sin respuesta durante semanas.
 */
export async function handoffEsPermanente(sender: string): Promise<boolean> {
  try {
    const p = getPool()
    if (!p) return false
    const r = await p.query(
      `SELECT ts, detail->>'accion' AS accion, detail->>'motivo' AS motivo
         FROM ig_diag
        WHERE sender = $1 AND kind = 'pensado'
          AND canal = 'wa' AND detail->>'derivar' = 'true'
        ORDER BY id DESC LIMIT 1`,
      [sender],
    )
    const fila = r.rows[0]
    if (!fila) return false

    // ¿Alguien ya cerró este caso a mano DESPUÉS de la derivación? Entonces deja de ser
    // permanente y el bot puede volver a atender a este cliente con normalidad.
    const cerrado = await p.query(
      `SELECT 1 FROM ig_diag
        WHERE sender = $1 AND kind = $2 AND ts > $3 LIMIT 1`,
      [sender, KIND_HANDOFF_CERRADO, fila.ts],
    )
    if ((cerrado.rowCount ?? 0) > 0) return false

    // ¿Sigue vivo? Un caso sin ninguna señal en semanas ya no retiene al bot (ver
    // DIAS_HANDOFF_PERMANENTE). Se mide por la última actividad del cliente en el canal.
    const vivo = await p.query(
      `SELECT 1 FROM ig_diag
        WHERE sender = $1 AND canal = 'wa'
          AND ts > now() - ($2 || ' days')::interval LIMIT 1`,
      [sender, String(DIAS_HANDOFF_PERMANENTE)],
    )
    if ((vivo.rowCount ?? 0) === 0) return false

    if (fila.accion && ACCIONES_HANDOFF_PERMANENTE.has(fila.accion)) return true
    if (fila.motivo && RE_HANDOFF_PERMANENTE.test(fila.motivo)) return true

    // El motivo del modelo puede venir vacío (pasó en el caso Gerchu: el 'pensado' que
    // derivó por la cancelación tenía motivo cargado, pero el segundo no). Por eso también
    // se miran los mensajes con los que el cliente llegó A ESA derivación —acotados a la
    // ventana previa y al mismo canal, para no arrastrar una charla vieja ni un mensaje de
    // Instagram del mismo número.
    const t = await p.query(
      `SELECT detail->>'texto' AS texto FROM ig_diag
        WHERE sender = $1 AND kind = 'recibido' AND canal = 'wa'
          AND ts <= $2 AND ts > $2::timestamptz - ($3 || ' hours')::interval
        ORDER BY id DESC LIMIT 20`,
      [sender, fila.ts, String(HORAS_CONTEXTO_DERIVACION)],
    )
    return t.rows.some((x) => x.texto && RE_HANDOFF_PERMANENTE.test(x.texto))
  } catch (e) {
    console.error('handoffEsPermanente error:', e)
    return false
  }
}

/**
 * ¿Este mensaje interno (de Nahuel al número del bot) cierra el handoff de alguien?
 * Formato: "cerrar 5493513298375" (o con +, espacios o guiones). Devuelve el sender
 * normalizado a dígitos, o null si el mensaje no es una orden de cierre.
 */
export function esCierreDeHandoff(texto: string): string | null {
  const m = texto?.match(/\bcerrar\s+\+?([\d\s-]{8,20})\b/i)
  if (!m) return null
  const digitos = m[1].replace(/\D/g, '')
  return digitos.length >= 8 ? digitos : null
}

/**
 * ¿Cuántas veces el bot ya le mandó a este sender una respuesta CASI IGUAL a ésta?
 *
 * POR QUÉ NO ALCANZA CON CONTAR TURNOS (auditoría del 21/08/2026)
 * El freno anterior contaba respuestas 'respuesta_libre' seguidas, sin mirar su contenido.
 * El saludo-menú y el listado de productos también son 'respuesta_libre', así que todo
 * cliente nuevo que navegaba el menú quemaba sus dos créditos antes de preguntar nada: tres
 * personas que pidieron el precio de la INC101 fueron derivadas en el tercer mensaje, antes
 * de recibirlo. Ninguna volvió a escribir.
 *
 * Un bot que responde tres cosas DISTINTAS está avanzando; uno que manda la misma disculpa
 * tres veces, no. Eso es lo que se mide acá.
 *
 * La comparación es por prefijo normalizado, no exacta: las respuestas que patinan varían en
 * un emoji o una palabra ("Perdón, no encontré..." / "Perdón! No encontré...") y una
 * igualdad estricta no las agruparía. Ante error devuelve 0 (no fuerza una derivación de
 * más por un problema de base).
 */
export async function contarRespuestaRepetida(
  sender: string,
  respuesta: string,
  minutos: number,
): Promise<number> {
  try {
    const p = getPool()
    if (!p) return 0
    const huella = huellaTexto(respuesta)
    if (!huella) return 0
    const r = await p.query(
      `SELECT detail->>'respuesta' AS respuesta FROM ig_diag
        WHERE sender = $1 AND kind = 'pensado' AND canal = 'wa'
          AND ts > now() - ($2 || ' minutes')::interval
        ORDER BY id DESC LIMIT 10`,
      [sender, String(minutos)],
    )
    return r.rows.filter((x) => x.respuesta && huellaTexto(x.respuesta) === huella).length
  } catch (e) {
    console.error('contarRespuestaRepetida error:', e)
    return 0
  }
}

/** Normaliza para comparar: sin emojis, signos ni acentos, y solo el arranque del mensaje. */
function huellaTexto(t: string): string {
  return t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
}

/**
 * Salud del mostrador en las últimas 24 h: no si el bot funciona, sino si SIRVE.
 *
 * POR QUÉ EXISTE (auditoría del 21/08/2026)
 * El resumen diario vigilaba cola, crons, errores de envío y gasto de Claude — todo sobre
 * la máquina, nada sobre la atención. Un bot que deriva el 100% de los chats y deja a los
 * clientes esperando pasa las cuatro alertas en verde. De hecho pasó: el caso que terminó
 * con un cliente anunciando una denuncia en Defensa del Consumidor no encendió una sola luz.
 *
 * QUÉ SE PUEDE MEDIR Y QUÉ NO
 * No hay forma de saber si Mateo contestó: sus respuestas salen de su teléfono y el bridge
 * de lectura está bloqueado por WhatsApp (confirmado en vivo el 20/08/2026). Así que NO se
 * mide "tiempo de respuesta humana" —sería inventar—, sino la única huella que sí queda en
 * la base: el cliente que, después de ser derivado, SIGUIÓ ESCRIBIENDO. Cada uno de esos
 * mensajes es alguien que no recibió respuesta de nadie y volvió a insistir.
 *
 * Medido sobre 30 días reales al escribir esto: 8 de 21 derivados (38%) siguieron
 * escribiendo tras el handoff.
 */
export async function saludDelMostrador24h(): Promise<{
  derivados: number
  sinAtender: number
  esperaMaxHoras: number
  patinaron: number
  resueltos: number
} | null> {
  try {
    const p = getPool()
    if (!p) return null
    const r = await p.query(
      `WITH der AS (
         SELECT sender, ts,
                row_number() OVER (PARTITION BY sender ORDER BY id DESC) AS rn
           FROM ig_diag
          WHERE canal = 'wa' AND kind = 'pensado' AND detail->>'derivar' = 'true'
            AND ts > now() - interval '24 hours'
       ), ultima AS (
         SELECT sender, ts FROM der WHERE rn = 1
       )
       SELECT
         (SELECT count(*) FROM ultima)::int AS derivados,
         (SELECT count(*) FROM ultima u
           WHERE EXISTS (SELECT 1 FROM ig_diag h
                          WHERE h.sender = u.sender AND h.kind = 'handoff_activo'
                            AND h.ts > u.ts))::int AS sin_atender,
         COALESCE((SELECT max(EXTRACT(epoch FROM (h.ts - u.ts)) / 3600)
                     FROM ultima u
                     JOIN ig_diag h ON h.sender = u.sender
                    WHERE h.kind = 'handoff_activo' AND h.ts > u.ts), 0) AS espera_max,
         (SELECT count(*) FROM ig_diag
           WHERE canal = 'wa' AND kind = 'pensado'
             AND detail->>'accion' = 'patina_derivado'
             AND ts > now() - interval '24 hours')::int AS patinaron,
         (SELECT count(*) FROM ig_diag
           WHERE canal = 'wa' AND kind = 'pensado'
             AND detail->>'derivar' = 'false'
             AND ts > now() - interval '24 hours')::int AS resueltos`,
    )
    const f = r.rows[0]
    if (!f) return null
    return {
      derivados: f.derivados ?? 0,
      sinAtender: f.sin_atender ?? 0,
      esperaMaxHoras: Math.round((Number(f.espera_max) || 0) * 10) / 10,
      patinaron: f.patinaron ?? 0,
      resueltos: f.resueltos ?? 0,
    }
  } catch (e) {
    console.error('saludDelMostrador24h error:', e)
    return null
  }
}
