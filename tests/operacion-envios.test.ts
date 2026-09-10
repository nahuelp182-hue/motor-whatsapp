import { describe, it, expect } from 'vitest'
import { diasEntre, accionDe, estadoManual } from '@/lib/operacion/envios'
import { UMBRAL_ENVIO, PLAZO_PROMETIDO, PLAZO_MANUAL_DIAS } from '@/lib/supuestos'
import { CATALOGO } from '@/lib/cron-heartbeat'

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

// El control de manuales existe porque un comprador se quedó sin material y NADA avisó: el
// caso apareció cuando el cliente escribió. Estos casos fijan las cuatro formas en que el
// indicador podría volver a callarse.
describe('control de manual entregado', () => {
  const ahora = dia(20)

  it('con acuse es "ok", aunque el envío sea viejo', () => {
    expect(estadoManual('tn', 'Incubadora INC101', dia(1), dia(2), ahora)).toBe('ok')
  })

  it('sin acuse y recién despachado es "pendiente": el manual sale a las 24 h', () => {
    expect(estadoManual('tn', 'Incubadora INC101', dia(20), null, ahora)).toBe('pendiente')
  })

  it('un despacho de anoche sigue en ciclo: el script espera 24 h', () => {
    // Medido: #1649, despachado la noche anterior, contaba "2 días" por redondeo de fechas
    // mientras el VPS estaba dentro de su espera legítima. El plazo tiene que cubrir eso.
    expect(estadoManual('tn', 'Incubadora INC101', dia(18), null, ahora)).toBe('pendiente')
  })

  it('sin acuse pasado el plazo es "faltante": es el caso que hay que ver', () => {
    const despacho = dia(20 - PLAZO_MANUAL_DIAS - 1)
    expect(estadoManual('tn', 'Incubadora INC101', despacho, null, ahora)).toBe('faltante')
  })

  it('un accesorio suelto no es faltante: el manual va con el equipo', () => {
    // Medido el 09/09/2026: el pedido #1611 (Booster de Humedad solo) salía "faltante". Los
    // accesorios no llevan material propio, así que habría quedado encendido para siempre.
    expect(estadoManual('tn', 'Booster de Humedad', dia(1), null, ahora)).toBe('na')
    expect(estadoManual('tn', 'Kit de Recipientes de Cultivo (Pack x4)', dia(1), null, ahora)).toBe('na')
  })

  it('un producto sin manual escrito no se cuenta como faltante', () => {
    // Si HALO figurara "faltante" se encendería para siempre sin que nadie pueda apagarlo,
    // y un indicador que siempre grita deja de mirarse. Se arregla escribiendo el manual.
    expect(estadoManual('tn', 'Lámpara HALO', dia(1), null, ahora)).toBe('sin_material')
  })

  it('el apícola no lleva material propio: nunca es faltante', () => {
    // Marcarlo como deuda inventaría un problema que no existe y taparía los casos reales.
    expect(estadoManual('ml', 'Traje apicultor', dia(1), null, ahora)).toBe('na')
  })

  it('un envío sin despachar no es faltante todavía', () => {
    // El retiro en punto nunca marca despacho: lo rescata el script del VPS a los 3 días del
    // pago. Contarlo como faltante desde el día uno llenaría la lista de falsos positivos.
    expect(estadoManual('tn', 'Incubadora INC101', null, null, ahora)).toBe('pendiente')
  })
})

// El indicador tiene dos formas de mentir, y las dos dejan a alguien sin manual:
// callarse cuando hay un faltante real, o gritar cuando lo que se cayó es el push.
describe('el control no puede mentir cuando la fuente se cae', () => {
  it('el plazo del panel es más ancho que el ciclo del VPS', () => {
    // El VPS espera 24 h post-despacho y corre cada 3 h. Si el plazo del panel bajara por
    // debajo de eso, marcaría faltantes a envíos que están en cola legítima — que es el
    // falso positivo medido con el pedido #1649.
    expect(PLAZO_MANUAL_DIAS).toBeGreaterThanOrEqual(2)
  })

  it('el job del push está en el catálogo, o su caída sería invisible', () => {
    // Sin entrada en el catálogo, `manualFresco` caería al default y /sistema no lo
    // vigilaría: el push podría estar muerto hace días sin que nada lo diga.
    expect(CATALOGO['operacion-manuales']).toBeDefined()
    // La tolerancia tiene que cubrir el cron (cada 3 h) más margen para una corrida perdida.
    expect(CATALOGO['operacion-manuales'].maxHoras).toBeGreaterThan(3)
  })
})
