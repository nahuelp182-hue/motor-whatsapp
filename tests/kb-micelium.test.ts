import { describe, it, expect } from 'vitest'
import { KB_MICELIUM } from '@/lib/kb-micelium'

// KB_MICELIUM es texto plano (el system prompt del agente), no lógica: sin este test,
// nada en CI se entera si alguien reescribe o borra una regla de posicionamiento/negocio
// al editar el archivo. La lógica de código ya tiene sus tests; esto cubre el prompt.
//
// Cada assert de acá nació de un pedido explícito de Nahuel, no de una preferencia de
// estilo — si el texto exacto cambia, este test tiene que actualizarse a propósito, no
// romperse por accidente.
describe('KB_MICELIUM — invariantes de contenido', () => {
  it('el listado genérico de productos aclara que no venden material de cultivo', () => {
    // Pedido 20/08/2026: al ofrecer "info y precio" sin producto puntual, el bot arma una
    // lista numerada — ahí tiene que ir SIEMPRE el disclaimer de posicionamiento, para
    // cortar de raíz a quien busca esporas/sustrato pensando que son insumeros.
    expect(KB_MICELIUM).toContain(
      '⚠️ Fabricamos equipos, no vendemos esporas, sustrato ni material de cultivo.',
    )
  })

  it('el disclaimer vive junto a la instrucción del listado sin precios, no suelto en otro lado', () => {
    const idxListado = KB_MICELIUM.indexOf('NUMERADOS por NOMBRE, SIN PRECIOS')
    const idxDisclaimer = KB_MICELIUM.indexOf('Fabricamos equipos, no vendemos esporas')
    expect(idxListado).toBeGreaterThan(-1)
    expect(idxDisclaimer).toBeGreaterThan(-1)
    // Menos de 400 caracteres de distancia: mismo párrafo/instrucción, no una mención
    // aislada en otra sección que no tiene efecto sobre este mensaje puntual.
    expect(Math.abs(idxDisclaimer - idxListado)).toBeLessThan(400)
  })
})
