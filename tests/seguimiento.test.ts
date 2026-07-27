import { describe, it, expect } from 'vitest'
import { pareceTrackingAndreani } from '@/lib/andreani'
import { mensajeSeguimientoGenerico, esEnvioViejo } from '@/lib/seguimiento'

describe('pareceTrackingAndreani', () => {
  it('reconoce el número del caso real del 27/07/26', () => {
    // Ese pedido figuraba en Tiendanube como "Punto de retiro" y el bot lo trató como
    // Correo Argentino. El número era de Andreani.
    expect(pareceTrackingAndreani('360002608146590')).toBe(true)
  })

  it('tolera espacios alrededor', () => {
    expect(pareceTrackingAndreani(' 360002608146590 ')).toBe(true)
  })

  it.each([
    ['CD123456789AR', 'código de Correo Argentino'],
    ['36000260814659', '14 dígitos'],
    ['3600026081465901', '16 dígitos'],
    ['3600-0260-8146-590', 'con separadores'],
    ['', 'vacío'],
  ])('descarta %s (%s)', (t) => {
    expect(pareceTrackingAndreani(t)).toBe(false)
  })

  it('descarta null y undefined', () => {
    expect(pareceTrackingAndreani(null)).toBe(false)
    expect(pareceTrackingAndreani(undefined)).toBe(false)
  })
})

describe('mensajeSeguimientoGenerico', () => {
  const base = { numero: 1500, tracking: 'CD123456789AR', correo: 'Correo Argentino', diasDesdeCompra: 3 }

  it('da el código y el link, sin afirmar ningún estado', () => {
    const m = mensajeSeguimientoGenerico(base)!
    expect(m).toContain('#1500')
    expect(m).toContain('CD123456789AR')
    expect(m).toContain('correoargentino.com.ar/seguimiento-de-envios')
    expect(m).not.toMatch(/en camino|entregado|en sucursal|lleg/i)
  })

  it('no dice "viaja por Correo" cuando el cliente retira en un punto', () => {
    const m = mensajeSeguimientoGenerico({ ...base, pickup: true, correo: 'Punto de retiro' })!
    expect(m).toContain('punto de retiro')
    expect(m).not.toContain('viaja por Punto de retiro')
  })

  it('deriva (null) si el pedido es viejo: ahí "está en camino" sería inventar', () => {
    expect(mensajeSeguimientoGenerico({ ...base, diasDesdeCompra: 425 })).toBeNull()
    expect(mensajeSeguimientoGenerico({ ...base, diasDesdeCompra: 46 })).toBeNull()
  })

  it('sigue respondiendo dentro de la ventana razonable', () => {
    expect(mensajeSeguimientoGenerico({ ...base, diasDesdeCompra: 45 })).not.toBeNull()
  })

  it('deriva (null) si no hay número de seguimiento', () => {
    expect(mensajeSeguimientoGenerico({ ...base, tracking: undefined })).toBeNull()
  })

  it('sin fecha de compra no bloquea: un pedido recién hecho puede no traerla', () => {
    expect(mensajeSeguimientoGenerico({ ...base, diasDesdeCompra: undefined })).not.toBeNull()
  })
})

describe('esEnvioViejo', () => {
  it.each([[0, false], [45, false], [46, true], [425, true], [undefined, false]])(
    '%s días → %s', (d, esperado) => { expect(esEnvioViejo(d as number | undefined)).toBe(esperado) },
  )
})
