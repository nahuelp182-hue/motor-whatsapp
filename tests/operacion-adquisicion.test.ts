import { describe, it, expect } from 'vitest'
import { ELASTICIDAD_CAC, TECHO_CAC, OBJETIVO_MARGEN_BRUTO, margenPonderado, retornoSobreCac } from '@/lib/supuestos'

// La tabla de escalado es una hipótesis declarada, pero la hipótesis tiene que ser
// coherente: si proyecta hacia atrás o repite escalones, la fila del techo deja de
// significar algo y es justo la fila que decide si se sube el presupuesto.

/** Misma fórmula que `escenarios()` en lib/operacion/adquisicion.ts. */
const cacEscalado = (cac: number, factor: number) => cac * Math.pow(1 + ELASTICIDAD_CAC, Math.log2(factor))

describe('escenarios de escalado', () => {
  const factores = [1, 1.5, 2, 3]

  it('los escalones van siempre hacia arriba y sin repetirse', () => {
    const gastos = factores.map(f => Math.round(25_000 * f))
    expect(gastos).toEqual([...gastos].sort((a, b) => a - b))
    expect(new Set(gastos).size).toBe(gastos.length)
  })

  it('el CAC solo sube al gastar más: nunca se queda quieto por un clamp', () => {
    const cacs = factores.map(f => cacEscalado(26_400, f))
    for (let i = 1; i < cacs.length; i++) expect(cacs[i]).toBeGreaterThan(cacs[i - 1])
  })

  it('duplicar el gasto sube el CAC exactamente la elasticidad declarada', () => {
    expect(cacEscalado(10_000, 2) / 10_000).toBeCloseTo(1 + ELASTICIDAD_CAC, 10)
  })

  it('el escenario base no toca el CAC medido', () => {
    expect(cacEscalado(26_400, 1)).toBe(26_400)
  })
})

describe('unit economics', () => {
  it('el retorno cae cuando el mix se corre hacia lo apícola', () => {
    const alto = retornoSobreCac(26_400, 0.8)!
    const bajo = retornoSobreCac(26_400, 0.2)!
    expect(alto).toBeGreaterThan(bajo)
  })

  it('sin CAC no se inventa un retorno', () => {
    expect(retornoSobreCac(0)).toBeNull()
  })

  it('el margen ponderado queda entre el apícola y el de incubadora', () => {
    expect(margenPonderado(0.6)).toBeGreaterThan(margenPonderado(0.2))
    expect(margenPonderado(1)).toBeGreaterThan(margenPonderado(0))
  })
})

describe('lo que NO se compara contra el objetivo de margen bruto', () => {
  it('neto sobre bruto mide comisiones y quedaría siempre por encima del objetivo', () => {
    // El corte de caja trae bruto y neto, no el costo de la mercadería. neto/bruto ≈ 94 %
    // contra un objetivo de 60 % daba verde por construcción: un indicador que no puede
    // ponerse en rojo. Por eso la pantalla muestra comisiones y declara el margen sin fuente.
    const bruto = 2_690_000, neto = 2_523_400
    expect(neto / bruto).toBeGreaterThan(OBJETIVO_MARGEN_BRUTO)
    expect((bruto - neto) / bruto).toBeLessThan(0.1) // lo que realmente mide: ~6 % de comisiones
  })
})

describe('techo de CAC', () => {
  it('está por debajo del margen por pedido: si no, no sería un techo', () => {
    expect(TECHO_CAC).toBeLessThan(margenPonderado())
  })
})
