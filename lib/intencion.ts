// Qué está pidiendo el cliente, detectado por texto. Es red de seguridad: el cerebro ya
// marca [MANUAL] y [SEGUIMIENTO] por su cuenta, pero cuando no lo hace el sistema no
// verifica nada y el bot improvisa.
//
// El 27/07/26 una clienta escribió "me pasarías el manual de la incubadora x fa". El
// modelo NO marcó [MANUAL]: contestó de su cabeza "necesito verificar que compraste,
// pasame tu número de pedido o DNI". Ella mandó el DNI y ahí el modelo sí etiquetó —pero
// [SEGUIMIENTO], porque el preámbulo ordena marcarlo ante cualquier DNI o número de orden—
// y el bot le respondió con el estado del envío. Pidió el manual y recibió un tracking.
// Encima el DNI sobraba: buscarPedido matchea por el teléfono desde el que escribe.

/** Lo que se pide: el manual, la guía, el instructivo, el material. */
const RE_MATERIAL =
  /\b(?:manual|manuales|instructivo|instructivos|gu[ií]a|gu[ií]as|tutorial|tutoriales|paso\s+a\s+paso|material(?:es)?)\b/i

/**
 * Y que lo esté PIDIENDO. Sin esto, "¿de qué material es la tapa?" o "¿el manual explica
 * la fructificación?" entrarían como pedido de material.
 */
//
// Ojo con los acentos: `\b` NO marca límite después de "ó" ni "á" (no son \w en JS), así
// que cerrar cada forma con \b dejaba afuera "no me llegó" y "pasame". Por eso van raíces.
const RE_VERBO_PEDIDO =
  /\b(?:pas[aá]\w*|pasar\w*|mand[aá]\w*|mandar\w*|env[ií]\w*|enviar\w*|dame|necesit\w*|quier\w*|quisiera|me\s+gustar\w*|d[oó]nde|c[oó]mo\s+(?:consigo|bajo|descargo)|me\s+falta|no\s+me\s+lleg\w*|no\s+recib\w*|perd[ií]\w*)/i

/**
 * Preventa: todavía no compró, está averiguando qué incluye el equipo. NO es un pedido de
 * material —el material va con la compra— y contestarle "pasame tu número de orden" a
 * alguien que está por comprar es perder la venta.
 */
const RE_PREVENTA = /\b(?:viene[n]?|trae[n]?|incluye[n]?|tiene[n]?|ten[eé]s|hay|se\s+entrega)\b/i

/** true si el cliente está pidiendo el manual / la guía / el material de su equipo. */
export function pideManual(texto: string): boolean {
  if (!texto) return false
  if (!RE_MATERIAL.test(texto)) return false
  if (!RE_VERBO_PEDIDO.test(texto)) return false
  // "¿viene con manual?" tiene "manual", pero no es un pedido: es una duda de preventa.
  // Ante la duda no se fuerza nada y decide el modelo, que ve la conversación entera.
  return !RE_PREVENTA.test(texto)
}

// ─────────────────────────── Señal de cierre ───────────────────────────
//
// Dos cosas juntas en la misma conversación: pregunta por el precio Y duda de si va a
// poder. Ese cruce es el momento de cierre y es donde un humano gana al bot: el que
// pregunta el precio ya decidió que lo quiere, y el que además duda de sí mismo no
// necesita una ficha de producto, necesita que alguien le diga que sí puede.
//
// Está medido en la Biblioteca: "precio/cómo pago" es el dolor #2 de preventa (24
// menciones) y "¿me sirve a mí sin experiencia?" el #7 (9, alto en DM). Y el 49% de los
// mensajes de asesoría van a gente que todavía NO compró — o sea que la asesoría no es
// post-venta, es lo que cierra la venta.
//
// No deriva el chat ni corta al bot: solo avisa. Cortar una conversación que va bien para
// esperar a que Nahuel mire el teléfono es peor que dejarla seguir.

/** Está preguntando cuánto sale o cómo se paga. */
const RE_PRECIO =
  /\b(?:precio|precios|cu[aá]nto\s+(?:sale|cuesta|est[aá]|vale)|cu[aá]nto\s+es|valor|cotiz\w*|cuota\w*|financiac\w*|transferenc\w*|tarjeta|se[ñn]a|presupuesto)\b/i

/** Duda de su propia capacidad, no del producto. */
const RE_DUDA_CAPACIDAD =
  /(?:no\s+(?:s[eé]|tengo)\s+(?:nada|ni\s+idea|experiencia|idea)|nunca\s+(?:lo\s+)?hice|primera\s+vez|soy\s+(?:nuev\w+|principiante)|me\s+(?:va\s+a\s+)?(?:sal[ie]\w*|servir[aá]?|animo)|ser[eé]\s+capaz|podr[eé]|me\s+cuesta|es\s+dif[ií]cil|complicad\w+|y\s+si\s+no\s+(?:me\s+sale|funciona)|arruin\w*|fracas\w*)/i

/**
 * ¿La conversación llegó al momento de cierre?
 *
 * Recibe los textos de la conversación, no un mensaje suelto: las dos señales casi nunca
 * vienen en la misma frase. Lo típico es "¿cuánto sale?" y tres mensajes después "igual
 * nunca hice esto, no sé si me va a salir".
 */
export function esSenalDeCierre(textos: string[]): boolean {
  const todo = (textos ?? []).filter(Boolean).join('\n')
  if (!todo) return false
  return RE_PRECIO.test(todo) && RE_DUDA_CAPACIDAD.test(todo)
}

/**
 * ¿El mensaje es apenas un dato para identificar la compra? ("24449754", "#1606",
 * "mi pedido es el 1594")
 *
 * Sirve para reanudar lo que se estaba pidiendo: si le pedimos el dato para mandarle el
 * material, ese número es la respuesta a ESO, no una consulta nueva sobre el envío. Una
 * pregunta de verdad sobre el envío trae más texto alrededor ("hace una semana que pedí el
 * 1594 y no me llegó"), y esa sí tiene que seguir yendo a seguimiento.
 */
export function esSoloIdentificador(texto: string): boolean {
  if (!texto) return false
  const t = texto.trim()
  if (!/\d{3,9}/.test(t)) return false
  const palabras = t.replace(/[\d#.,;:]+/g, ' ').trim().split(/\s+/).filter(Boolean)
  return palabras.length <= 5
}
