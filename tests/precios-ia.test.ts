// El riesgo de una tabla de precios no es equivocarse por unos centavos: es que un
// consumidor caro aparezca barato y nadie lo mire. Estos tests cubren justamente los casos
// donde eso pasaría.
import { describe, it, expect } from 'vitest'
import { costoDe, PRECIO_BUSQUEDA_WEB } from '@/lib/precios-ia'

describe('costoDe', () => {
  it('cobra entrada y salida al precio del modelo', () => {
    // Haiku 4.5: 1 USD/M entrada, 5 USD/M salida.
    const { usd } = costoDe('claude-haiku-4-5-20251001', { input: 1_000_000, output: 1_000_000 })
    expect(usd).toBeCloseTo(6, 6)
  })

  it('la caché sale más barata de leer y más cara de escribir', () => {
    const lectura = costoDe('claude-haiku-4-5', { cacheLectura: 1_000_000 }).usd
    const escritura = costoDe('claude-haiku-4-5', { cacheEscritura: 1_000_000 }).usd
    expect(lectura).toBeCloseTo(0.1, 6)
    expect(escritura).toBeCloseTo(1.25, 6)
    expect(lectura).toBeLessThan(escritura)
  })

  it('cobra la búsqueda web APARTE de los tokens', () => {
    // Es el costo que quedaba invisible: vanguardia, radar_saas y reddit_radar la usan.
    const sin = costoDe('claude-sonnet-5', { input: 1000 }).usd
    const con = costoDe('claude-sonnet-5', { input: 1000, busquedasWeb: 10 }).usd
    expect(con - sin).toBeCloseTo(10 * PRECIO_BUSQUEDA_WEB, 6)
    expect(con).toBeGreaterThan(sin)
  })

  it('en una corrida tipica de vanguardia, la busqueda pesa lo suficiente como para no ignorarla', () => {
    // Escala real, no inventada: ~6 busquedas y ~60k tokens de entrada (los resultados de
    // la busqueda inflan el input) sobre Sonnet. La busqueda sale USD 0,06 contra USD 0,18
    // de tokens: un tercio mas caro el conjunto que contando solo tokens.
    //
    // La primera version de este test afirmaba que 10 busquedas costaban mas que un millon
    // de tokens de Haiku. Es falso —USD 0,10 contra USD 1— y el test lo caso. Lo que
    // importa no es que la busqueda sea cara en abstracto, sino que en las proporciones
    // reales de estos scripts es una porcion que no se puede dejar afuera.
    const soloTokens = costoDe('claude-sonnet-5', { input: 60_000, output: 4_000 }).usd
    const conBusqueda = costoDe('claude-sonnet-5', { input: 60_000, output: 4_000, busquedasWeb: 6 }).usd
    const porcion = (conBusqueda - soloTokens) / conBusqueda
    expect(porcion).toBeGreaterThan(0.1) // mas del 10% del costo de la corrida
  })

  it('un modelo DESCONOCIDO no cuesta cero, y queda marcado', () => {
    // Si costara cero, un consumidor caro apareceria gratis —justo el que habria que
    // mirar— y el total del panel BAJARIA al empezar a usar un modelo nuevo.
    const r = costoDe('modelo-que-no-existe-9', { input: 1_000_000, output: 1_000_000 })
    expect(r.modeloDesconocido).toBe(true)
    expect(r.usd).toBeGreaterThan(0)
  })

  it('el modelo desconocido se cobra al precio del más caro conocido', () => {
    const desconocido = costoDe('modelo-nuevo', { output: 1_000_000 })
    const opus = costoDe('claude-opus-5', { output: 1_000_000 })
    expect(desconocido.usd).toBeCloseTo(opus.usd, 6)
  })

  it('un modelo conocido no queda marcado', () => {
    expect(costoDe('claude-opus-5', { input: 10 }).modeloDesconocido).toBe(false)
    expect(costoDe('gemini-2.5-flash', { input: 10 }).modeloDesconocido).toBe(false)
  })

  it('sin uso, no hay costo', () => {
    expect(costoDe('claude-haiku-4-5', {}).usd).toBe(0)
  })
})
