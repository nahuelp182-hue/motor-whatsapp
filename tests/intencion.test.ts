import { describe, it, expect } from 'vitest'
import { pideManual, esSoloIdentificador } from '@/lib/intencion'

describe('pideManual', () => {
  it('reconoce el mensaje real del 27/07/26 que el modelo no etiquetó', () => {
    expect(pideManual('Me pasarías el manual de la incubadora x fa')).toBe(true)
  })

  it.each([
    'hola! me mandás la guía de uso?',
    'necesito el instructivo del equipo',
    'dónde está el manual?',
    'no me llegó el material de la compra',
    'quiero el paso a paso por favor',
    'me podés pasar el tutorial',
  ])('es pedido: %s', (t) => {
    expect(pideManual(t)).toBe(true)
  })

  it.each([
    ['viene con manual?', 'preventa: está averiguando qué incluye'],
    ['el equipo trae instructivo?', 'preventa'],
    ['incluye guía de cultivo?', 'preventa'],
    ['¿de qué material es la tapa?', '"material" sin pedido'],
    ['el manual dice que hay que esperar 7 días, es así?', 'consulta sobre el contenido'],
    ['hola, cuánto sale la incubadora?', 'nada que ver'],
    ['', 'vacío'],
  ])('no es pedido: %s (%s)', (t) => {
    expect(pideManual(t)).toBe(false)
  })
})

describe('esSoloIdentificador', () => {
  it.each([
    '24449754',
    '#1606',
    'mi pedido es el 1594',
    'DNI 35185724',
    ' 1004 ',
  ])('es un dato suelto: %s', (t) => {
    expect(esSoloIdentificador(t)).toBe(true)
  })

  it.each([
    ['hace una semana que hice el pedido 1594 y todavía no me llegó nada', 'consulta real de envío'],
    ['hola', 'sin número'],
    ['compré la incubadora hace 3 días y quería saber cuándo sale el envío', 'consulta real'],
    ['', 'vacío'],
  ])('no es un dato suelto: %s (%s)', (t) => {
    expect(esSoloIdentificador(t)).toBe(false)
  })
})
