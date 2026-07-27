import { describe, it, expect } from 'vitest'
import { esConsultaIntervencion } from '@/lib/intervencion'

describe('esConsultaIntervencion', () => {
  it('detecta el caso real del 27/07/26 (tapa negra + pegamento)', () => {
    expect(esConsultaIntervencion(
      'Ya puse la incubadora a funcionar, pero siempre la abrí agarrándola de los costados. ' +
      'Se puede retirar la tapa negra de arriba o está pegada?',
    )).toBe(true)
    expect(esConsultaIntervencion('Es que ví que tiene una especie de pegamento, por eso me da cosa')).toBe(false) // sin acción ni duda de sacar: es un comentario
  })

  it.each([
    '¿Puedo sacar la tapa de arriba?',
    'se puede despegar el burlete?',
    'voy a desarmar la carcasa para ver el ventilador',
    '¿conviene ajustar los tornillos que están flojos?',
    'la tapa está pegada?',
    'quiero cambiar el sensor de temperatura',
    '¿el panel se puede sacar?',
    'se puede perforar la tapa para pasar un cable',
  ])('deriva: %s', (t) => {
    expect(esConsultaIntervencion(t)).toBe(true)
  })

  it.each([
    '¿tengo que destapar el tupper en fructificación?',
    'puedo sacar los frascos antes de que colonice?',
    '¿cada cuánto cambio el agua del booster?',
    'saco la tapa del frasco para inocular?',
    '¿a qué temperatura la pongo?',
    'cuánto tarda en colonizar?',
    '¿me pasás el manual?',
    'quiero cambiar la dirección de envío',
  ])('no deriva: %s', (t) => {
    expect(esConsultaIntervencion(t)).toBe(false)
  })

  it('no explota con vacío', () => {
    expect(esConsultaIntervencion('')).toBe(false)
  })
})
