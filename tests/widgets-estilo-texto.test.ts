import { describe, it, expect } from 'vitest'
import { esEmoji, sanearConfig, claveEstilo, porSlug, PALETA, EMOJIS } from '@/lib/widgets/tipos'

// Cubre dos cosas agregadas el 31/08/2026: el picker de emoji dejó de exigir que el valor
// esté en la lista corta de marca (buscador completo en CampoEditor.tsx), y el estilo de
// texto por campo (cursiva/fuente/color, CampoEditor.tsx `FormatoTexto`). Ambos son
// validados en el servidor (sanearConfig) antes de guardar — sin este test, un cambio ahí
// no se entera nadie hasta que un widget en producción pierde su emoji o su estilo.
describe('esEmoji', () => {
  it('acepta los 18 emojis de marca (compatibilidad con lo ya guardado)', () => {
    for (const e of EMOJIS) expect(esEmoji(e)).toBe(true)
  })

  it('acepta un emoji fuera de la lista de marca — el buscador completo ya no está limitado a esos 18', () => {
    expect(esEmoji('🚚')).toBe(true)
    expect(esEmoji('❤️')).toBe(true) // con selector de variación
  })

  it('rechaza texto que no es un emoji', () => {
    expect(esEmoji('hola')).toBe(false)
    expect(esEmoji('')).toBe(false)
    expect(esEmoji('<script>')).toBe(false)
  })
})

describe('sanearConfig — estilo de texto por campo (cursiva/fuente/color)', () => {
  const tipo = porSlug('whatsapp_flotante')!

  it('guarda cursiva, fuente y color válidos en la clave `${key}_estilo`', () => {
    const out = sanearConfig(tipo, {
      etiqueta: 'Consultanos',
      etiqueta_estilo: { cursiva: true, fuente: 'serif', color: 'profundo' },
    })
    expect(out[claveEstilo('etiqueta')]).toEqual({ cursiva: true, fuente: 'serif', color: 'profundo' })
  })

  it('acepta un color propio en #rrggbb, igual que el campo `color` común', () => {
    const out = sanearConfig(tipo, { etiqueta: 'x', etiqueta_estilo: { color: '#B0341D' } })
    expect(out[claveEstilo('etiqueta')]).toEqual({ color: '#b0341d' })
  })

  it('descarta una fuente o color inventados en vez de guardarlos tal cual', () => {
    // Un `style` armado con un valor no validado termina en el HTML servido a cada
    // visitante: la misma razón por la que el campo `color` común solo admite paleta o hex.
    const out = sanearConfig(tipo, {
      etiqueta: 'x',
      etiqueta_estilo: { fuente: 'javascript:alert(1)', color: 'red; background:url(x)' },
    })
    expect(out[claveEstilo('etiqueta')]).toEqual({})
  })

  it('sin `_estilo` en la entrada, guarda un objeto vacío (no rompe un widget ya guardado sin estilo)', () => {
    const out = sanearConfig(tipo, { etiqueta: 'Consultanos' })
    expect(out[claveEstilo('etiqueta')]).toEqual({})
  })

  it('un campo sin `formato: true` no gana una clave de estilo', () => {
    // `numero` es el teléfono de WhatsApp — dato técnico, nunca se dibuja en pantalla.
    const out = sanearConfig(tipo, { numero: '5493512145521', numero_estilo: { cursiva: true } })
    expect(out).not.toHaveProperty(claveEstilo('numero'))
  })

  it('cada valor de PALETA es un color válido para el estilo de texto', () => {
    for (const p of PALETA) {
      const out = sanearConfig(tipo, { etiqueta: 'x', etiqueta_estilo: { color: p.value } })
      expect(out[claveEstilo('etiqueta')]).toEqual({ color: p.value })
    }
  })
})

describe('sanearConfig — estilo de texto dentro de un ítem de lista', () => {
  const faq = porSlug('faq')!

  it('cada ítem de la lista guarda su propio estilo, no uno compartido', () => {
    const out = sanearConfig(faq, {
      items: [
        { pregunta: '¿Envían?', respuesta: 'Sí', pregunta_estilo: { cursiva: true } },
        { pregunta: '¿Garantía?', respuesta: 'Sí', pregunta_estilo: { color: 'tierra' } },
      ],
    })
    const items = out.items as Record<string, unknown>[]
    expect(items[0][claveEstilo('pregunta')]).toEqual({ cursiva: true })
    expect(items[1][claveEstilo('pregunta')]).toEqual({ color: 'tierra' })
  })
})
