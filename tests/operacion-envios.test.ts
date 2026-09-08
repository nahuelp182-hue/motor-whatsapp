import { describe, it, expect } from 'vitest'
import { diasEntre, accionDe } from '@/lib/operacion/envios'
import { UMBRAL_ENVIO, PLAZO_PROMETIDO } from '@/lib/supuestos'

// Los umbrales de Logística deciden qué se le muestra a Nahuel como "atender hoy". Si se
// corren sin querer, la pantalla sigue pintando lindo y deja de avisar: no hay forma de
// notarlo mirando. Por eso se fijan acá.

const dia = (n: number) => new Date(2026, 8, n)

describe('días en tránsito', () => {
  it('cuenta días completos entre despacho y entrega', () => {
    expect(diasEntre(dia(1), dia(4))).toBe(3)
  })

  it('devuelve null si falta una punta: un 0 se leería como "llegó el mismo día"', () => {
    expect(diasEntre(null, dia(4))).toBeNull()
    expect(diasEntre(dia(4), null)).toBeNull()
  })

  it('no devuelve negativos aunque las fechas vengan al revés', () => {
    expect(diasEntre(dia(10), dia(2))).toBe(0)
  })
})

describe('acción según el umbral', () => {
  it('lo pagado y sin despachar se despacha, sin importar los días', () => {
    expect(accionDe('sin_despachar', 0)).toBe('Despachar')
    expect(accionDe('sin_despachar', 12)).toBe('Despachar')
  })

  it('a partir del umbral de reclamo, se reclama', () => {
    expect(accionDe('en_transito', UMBRAL_ENVIO.reclamo)).toBe('Reclamar')
    expect(accionDe('en_transito', UMBRAL_ENVIO.reclamo + 5)).toBe('Reclamar')
  })

  it('entre alerta y reclamo se avisa al cliente antes de que reclame él', () => {
    expect(accionDe('en_transito', UMBRAL_ENVIO.alerta)).toBe('Avisar')
    expect(accionDe('en_transito', UMBRAL_ENVIO.reclamo - 1)).toBe('Avisar')
  })

  it('dentro del plazo prometido no pide nada', () => {
    expect(accionDe('en_transito', PLAZO_PROMETIDO.min)).toBeNull()
    expect(accionDe('en_transito', UMBRAL_ENVIO.alerta - 1)).toBeNull()
  })

  it('sin días medidos no inventa una acción', () => {
    expect(accionDe('en_transito', null)).toBeNull()
  })

  it('el umbral de alerta cae DENTRO del plazo prometido: avisa antes de incumplir', () => {
    expect(UMBRAL_ENVIO.alerta).toBeLessThanOrEqual(PLAZO_PROMETIDO.max)
    expect(UMBRAL_ENVIO.alerta).toBeLessThan(UMBRAL_ENVIO.reclamo)
  })
})

// ── Regresiones de la re-revisión del 08/09/2026 ─────────────────────────────
// Los tres casos que la primera versión resolvía mal. Ninguno rompía el build ni se veía
// en pantalla: mostraban un número plausible y equivocado, que es la forma más cara de
// estar mal.

describe('lo que NO es un envío frenado', () => {
  it('un pedido sin despachar hace 12 días pide despacho, no reclamo', () => {
    // Reclamarle a Andreani un paquete que nunca se le entregó hace perder el tiempo, y el
    // que sigue una alerta falsa deja de mirar la columna.
    expect(accionDe('sin_despachar', 12)).toBe('Despachar')
    expect(accionDe('sin_despachar', 12)).not.toBe('Reclamar')
  })

  it('un envío por un correo que no se puede consultar no pide nada', () => {
    // Sin trazabilidad no se sabe si llegó: puede haberse entregado hace una semana.
    expect(accionDe('no_trackeable', 15)).toBeNull()
  })
})
