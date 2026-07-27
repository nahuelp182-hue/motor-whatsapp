// Red de seguridad por texto: el cliente pregunta por MODIFICAR el equipo. Ahí el bot no
// improvisa: dice la norma general y lo pasa a una persona.
//
// Qué es una modificación y qué no (norma de Nahuel, 27/07/26):
//   · Modificación = todo lo que REEMPLACE, CORTE o INTERVENGA LA ESTRUCTURA del equipo:
//     cortes, perforaciones, desarmar el chasis o partes eléctricas, cambiar piezas.
//   · NO es modificación sacar o destapar la CÚPULA durante el cultivo: es una parte
//     separada de la base y quitarla es uso normal, igual que destapar el recipiente
//     interno. Eso se responde con la KB como cualquier consulta de uso.
//
// Por qué vive en código y no solo en el preámbulo: el 27/07/26 un cliente preguntó si
// podía retirar la cúpula porque veía pegamento. La respuesta correcta era simple —se
// retira, es una parte aparte—, pero el bot agregó de su cabeza que eso era "silicona de
// sellado para que no se escape el aire caliente". Ese dato no está en ninguna parte de la
// KB. El riesgo no es la cúpula: es que el modelo explique cómo está construido el equipo y
// termine habilitando algo que sí lo rompe.

// Partes de la ESTRUCTURA. Tocar cualquiera de estas ya es intervenir, con el verbo que sea.
const PARTE_ESTRUCTURA =
  '(?:chasis|estructura|carcasa|gabinete|base\\s+del\\s+equipo|tornillo|tornillos|placa|resistencia|ventilador|cooler|cable|cables|cableado|fuente|transformador|silicona|silicon|pegamento|sellad[oa]|adhesivo|burlete|junta|bisagra|enchufe|ficha)'

// Partes que el usuario maneja: la cúpula se saca, la sonda se ubica donde dice el manual.
// Solo son intervención si se las corta, perfora, reemplaza o modifica.
//
// El display, el panel y el controlador quedan afuera a propósito: ahí las preguntas son de
// configuración ("cambiar la temperatura en el display"), y la KB las responde.
const PARTE_DE_USO = '(?:c[uú]pula|tapa|tapas|domo|sensor|sonda)'

const PARTE = `(?:${PARTE_ESTRUCTURA}|${PARTE_DE_USO})`

// Verbos que modifican, con cualquier parte del equipo.
const ACCION_MODIFICA =
  '(?:cort\\w*|perfor\\w*|agujere\\w*|sold\\w*|reemplaz\\w*|cambi\\w*|modific\\w*|intervenir|desarm\\w*|desmont\\w*|desatornill\\w*|destornill\\w*|afloj\\w*|apret\\w*|forz\\w*|peg\\w*|despeg\\w*|resell\\w*|adapt\\w*|agreg\\w*|sumarle|instal\\w*)'

// Verbos de quitar. Sobre la cúpula son uso normal; sobre la estructura, no.
const ACCION_QUITA = '(?:saca\\w*|sacar|quita\\w*|quitar|retir\\w*|destap\\w*|abrir|abro|levant\\w*|correr)'

const CERCA = '[^.?!¿¡\\n]{0,40}'

const RE_INTERVENCION = new RegExp(
  [
    // Modificar cualquier parte: "cortar la cúpula", "cambiar el sensor", "perforar la tapa"
    `${ACCION_MODIFICA}\\b${CERCA}\\b${PARTE}\\b`,
    `\\b${PARTE}\\b${CERCA}\\bse\\s+(?:le\\s+)?(?:puede[n]?\\s+)?${ACCION_MODIFICA}`,
    // Cualquier acción sobre la estructura: "sacar los tornillos", "abrir el chasis"
    `${ACCION_QUITA}\\b${CERCA}\\b${PARTE_ESTRUCTURA}\\b`,
    // Apretar/ajustar solo cuenta sobre la estructura: "ajustar la temperatura" no es esto.
    `(?:ajust\\w*|regul\\w*|mover)\\b${CERCA}\\b${PARTE_ESTRUCTURA}\\b`,
    `\\b${PARTE_ESTRUCTURA}\\b${CERCA}\\bse\\s+(?:le\\s+)?(?:puede[n]?\\s+)?(?:${ACCION_QUITA}|${ACCION_MODIFICA})`,
    // "¿el burlete está pegado?" → duda sobre cómo está sujeta una pieza de la estructura.
    // La misma pregunta sobre la cúpula NO entra: se responde con la KB (se retira).
    `\\b${PARTE_ESTRUCTURA}\\b${CERCA}\\b(?:est[áa]n?|viene[n]?|son|es)\\s+(?:pegad|soldad|fij|sellad)`,
  ].join('|'),
  'i',
)

// Operación normal del cultivo: el recipiente interno y los frascos también tienen tapa y
// goma, y destaparlos es parte del procedimiento.
const RE_OPERACION_NORMAL =
  /\b(?:tupper|taper|t[úu]per|frasco|frascos|recipiente|booster|sustrato|micelio|bolsa|jeringa)\b/i

/** true si el cliente pregunta por modificar o intervenir la estructura del equipo. */
export function esConsultaIntervencion(texto: string): boolean {
  if (!texto) return false
  const m = texto.match(RE_INTERVENCION)
  if (!m || m.index == null) return false
  // "cambiar la tapa del frasco" usa las mismas palabras que "cambiar la tapa del equipo":
  // lo que las distingue es el contexto inmediato, no el mensaje entero.
  const contexto = texto.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30)
  return !RE_OPERACION_NORMAL.test(contexto)
}

/**
 * Respuesta fija. No improvisa nada sobre cómo está armado el equipo: dice la norma, que es
 * la respuesta correcta a cualquier consulta de este tipo.
 */
export const RESPUESTA_INTERVENCION =
  'Te cuento la norma general: no está aconsejado modificar ni cambiar nada del equipo 🙌 ' +
  'Cualquier intervención —cortes, perforaciones, reemplazo de piezas, desarmar el chasis o ' +
  'partes eléctricas— puede afectar el funcionamiento y la garantía. Todo lo que no esté ' +
  'indicado en el manual de usuario lo tiene que hacer el servicio técnico autorizado.\n\n' +
  'Contame qué necesitás resolver y te paso con el equipo para que te lo vean 👇'
