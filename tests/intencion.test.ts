import { describe, it, expect } from 'vitest'
import { pideManual, esSoloIdentificador, esSenalDeCierre } from '@/lib/intencion'

describe('esSenalDeCierre', () => {
  // Las dos señales casi nunca vienen en la misma frase: lo típico es preguntar el precio
  // y varios mensajes después admitir la duda. Por eso recibe la conversación, no un
  // mensaje suelto.
  it('detecta el cruce repartido en varios mensajes', () => {
    expect(esSenalDeCierre([
      'hola, cuánto sale la incubadora?',
      'ah mirá',
      'igual nunca hice esto, no sé si me va a salir',
    ])).toBe(true)
  })

  it.each([
    [['cuánto cuesta?', 'es que no tengo experiencia en nada de esto'], 'precio + sin experiencia'],
    [['se puede en cuotas?', 'y si no me sale? me da cosa gastar tanto'], 'cuotas + miedo a fracasar'],
    [['qué precio tiene', 'soy principiante total'], 'precio + principiante'],
    [['acepta transferencia?', 'es mi primera vez con esto'], 'pago + primera vez'],
  ])('es señal: %s (%s)', (textos) => {
    expect(esSenalDeCierre(textos as string[])).toBe(true)
  })

  it.each([
    [['cuánto sale?', 'dale, lo compro'], 'precio sin duda: no necesita rescate'],
    [['nunca hice esto', 'me interesa aprender'], 'duda sin precio: todavía no está comprando'],
    [['cuándo llega mi pedido?'], 'post-venta, ni una cosa ni la otra'],
    [[], 'conversación vacía'],
    [[''], 'texto vacío'],
  ])('NO es señal: %s (%s)', (textos) => {
    expect(esSenalDeCierre(textos as string[])).toBe(false)
  })

  it('no se dispara con las respuestas del BOT sobre precio', () => {
    // El webhook filtra por role === 'user' justo para esto. Si alguien saca ese filtro,
    // el bot se auto-dispara: sus propias respuestas nombran el precio todo el tiempo.
    // Acá se prueba la mitad que le toca a la función: sola, no distingue quién habla.
    const soloBot = ['El precio lo ves en la ficha del producto 🙌']
    expect(esSenalDeCierre(soloBot)).toBe(false)
  })
})

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
