// Red de seguridad por texto: el cliente pregunta por INTERVENIR FÍSICAMENTE el equipo
// (sacar, despegar, cambiar o modificar una parte). Ante esto el bot no afirma NADA —ni
// que sí ni que no—: contesta una persona.
//
// Por qué vive acá y no en el preámbulo del modelo: el 27/07/26 un cliente preguntó si
// podía sacar la tapa negra porque veía pegamento. El bot le contestó que era "silicona de
// sellado" (dato que no está en la KB: se lo inventó) y que se retiraba "sin problema, sin
// riesgo". La regla anti-DIY ya estaba escrita, con ejemplos, en el preámbulo, y el modelo
// la pasó por arriba igual. Si se equivoca, el cliente rompe un equipo de $400.000 con un
// mensaje nuestro autorizándolo, así que la decisión no puede depender de que el modelo
// respete una instrucción.
//
// Lo que NO tiene que entrar: destapar el tupper, sacar los frascos o cambiar el agua del
// booster es operación normal del cultivo y se responde con la KB. Por eso el objeto tiene
// que ser una PARTE DEL EQUIPO, con lista cerrada: un genérico tipo "el equipo" derivaría
// media atención.

const PARTE_EQUIPO =
  '(?:tapa|tapas|silicona|silicon|pegamento|sellad[oa]|adhesivo|tornillo|tornillos|placa|resistencia|ventilador|cooler|cable|cables|sensor|carcasa|gabinete|burlete|junta|panel|display|pantalla|fuente|controlador|termostato|acr[ií]lico|vidrio|bisagra|goma)'

const ACCION =
  '(?:sacar|saco|quitar|quito|retirar|retiro|despegar|despego|desarmar|desarmo|desmontar|desatornillar|destornillar|aflojar|apretar|ajustar|forzar|perforar|agujerear|cortar|soldar|pegar|reemplazar|cambiar|cambio|modificar|manipular|tocar)'

const RE_TOCAR_EQUIPO = new RegExp(
  [
    // "¿puedo sacar la tapa?", "se puede despegar el burlete", "conviene ajustar los tornillos"
    `${ACCION}\\b[^.?!¿¡\\n]{0,40}\\b${PARTE_EQUIPO}\\b`,
    // "la tapa se saca?", "el panel se puede cambiar"
    `\\b${PARTE_EQUIPO}\\b[^.?!¿¡\\n]{0,40}\\bse\\s+(?:le\\s+)?(?:puede[n]?\\s+)?${ACCION}`,
    // "¿la tapa está pegada?", "¿viene sellada de fábrica?" → la misma duda, sin verbo de acción
    `\\b${PARTE_EQUIPO}\\b[^.?!¿¡\\n]{0,40}\\b(?:est[áa]n?|viene[n]?|son|es)\\s+(?:pegad|soldad|fij|sellad|suelt)`,
  ].join('|'),
  'i',
)

// Operación normal del cultivo. Si la parte que se nombra pertenece al recipiente interno
// (el tupper y los frascos también tienen tapa y goma), no es intervenir el equipo.
const RE_OPERACION_NORMAL =
  /\b(?:tupper|taper|t[úu]per|frasco|frascos|recipiente|booster|sustrato|micelio|bolsa|jeringa)\b/i

/** true si el cliente pregunta por sacar, cambiar o modificar una parte del equipo. */
export function esConsultaIntervencion(texto: string): boolean {
  if (!texto) return false
  const m = texto.match(RE_TOCAR_EQUIPO)
  if (!m || m.index == null) return false
  // "sacar la tapa del frasco" usa las mismas palabras que "sacar la tapa del equipo": lo
  // que las distingue es lo que hay alrededor del match, no el mensaje entero (alguien
  // puede hablar de los frascos en una oración y de la carcasa en la siguiente).
  const contexto = texto.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30)
  return !RE_OPERACION_NORMAL.test(contexto)
}

/** Respuesta fija: no afirma nada sobre el equipo y pasa el caso a una persona. */
export const RESPUESTA_INTERVENCION =
  'Con eso prefiero no arriesgarte una respuesta 🙌 Dejá esa parte como está —no la saques ' +
  'ni la fuerces— así no comprometemos el equipo ni la garantía, y te paso con el equipo ' +
  'que te lo confirma con seguridad 👇'
