import { describe, it, expect } from 'vitest'
import { esConsultaIntervencion } from '@/lib/intervencion'

describe('esConsultaIntervencion', () => {
  it('el caso real del 27/07/26 NO es una intervención: la cúpula se retira', () => {
    // La cúpula es una parte separada de la base; sacarla es uso normal del cultivo. Lo que
    // estuvo mal ese día no fue derivar de menos, fue inventar que el pegamento era
    // "silicona de sellado" — eso lo corta la KB, no esta función.
    expect(esConsultaIntervencion(
      'Ya puse la incubadora a funcionar, pero siempre la abrí agarrándola de los costados. ' +
      'Se puede retirar la tapa negra de arriba o está pegada?',
    )).toBe(false)
  })

  it.each([
    ['¿puedo destapar la cúpula durante el cultivo?', 'uso normal'],
    ['se puede sacar la cúpula?', 'uso normal'],
    ['la tapa de arriba se quita para revisar?', 'uso normal'],
    ['¿tengo que destapar el tupper en fructificación?', 'recipiente interno'],
    ['puedo sacar los frascos antes de que colonice?', 'operación del cultivo'],
    ['¿cada cuánto cambio el agua del booster?', 'operación del cultivo'],
    ['saco la tapa del frasco para inocular?', 'el frasco, no el equipo'],
    ['¿a qué temperatura la pongo?', 'nada que ver'],
    ['¿me pasás el manual?', 'nada que ver'],
    ['quiero cambiar la dirección de envío', 'no es el equipo'],
    ['', 'vacío'],
  ])('no deriva: %s (%s)', (t) => {
    expect(esConsultaIntervencion(t)).toBe(false)
  })

  it.each([
    ['se puede perforar la cúpula para pasar un cable?', 'perforar = modificación'],
    ['quiero cortar la tapa para agrandar la abertura', 'cortar = modificación'],
    ['¿puedo cambiar el sensor de temperatura?', 'reemplazo de pieza'],
    ['voy a desarmar la carcasa para ver el ventilador', 'chasis'],
    ['¿conviene ajustar los tornillos que están flojos?', 'estructura'],
    ['puedo sacar los tornillos de la base del equipo?', 'quitar sobre estructura'],
    ['se puede despegar el burlete?', 'estructura'],
    ['el cable se puede reemplazar por uno más largo?', 'parte eléctrica'],
    ['¿la silicona está pegada o se saca?', 'sellado'],
    ['quiero agregarle un ventilador más', 'modificación'],
  ])('deriva: %s (%s)', (t) => {
    expect(esConsultaIntervencion(t)).toBe(true)
  })
})

describe('esConsultaIntervencion — límites finos', () => {
  it.each([
    ['¿cómo cambio la temperatura en el display?', 'configuración, no intervención'],
    ['dónde va la sonda?', 'ubicación: lo dice el manual'],
    ['puedo mover la sonda a otro lado?', 'lo responde la KB (no moverla)'],
    ['se puede regular la humedad?', 'configuración'],
  ])('no deriva: %s (%s)', (t) => {
    expect(esConsultaIntervencion(t)).toBe(false)
  })

  it.each([
    ['quiero cambiar la sonda por una más larga', 'reemplazo de pieza'],
    ['puedo ajustar los tornillos del chasis?', 'estructura'],
  ])('deriva: %s (%s)', (t) => {
    expect(esConsultaIntervencion(t)).toBe(true)
  })
})
