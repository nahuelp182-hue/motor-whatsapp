import { describe, it, expect } from 'vitest'
import { esperaTrasFallo, leerPayload, MAX_INTENTOS } from '@/lib/cola-envios'

// Estos tests cubren la lógica pura de la cola: cuánto se espera tras un fallo y cómo se
// lee el payload. La toma del lote (`tomarLote`) no se prueba acá porque es una sentencia
// SQL con FOR UPDATE SKIP LOCKED: probarla de verdad requiere dos conexiones concurrentes
// contra Postgres, no un mock. Queda como prueba manual documentada en el plan —correr el
// cron dos veces en paralelo y verificar que ningún mensaje sale dos veces.

describe('backoff tras un fallo', () => {
  it('crece exponencial: 2, 4, 8, 16 minutos', () => {
    expect(esperaTrasFallo(1)).toBe(2)
    expect(esperaTrasFallo(2)).toBe(4)
    expect(esperaTrasFallo(3)).toBe(8)
    expect(esperaTrasFallo(4)).toBe(16)
  })

  it('tiene techo: no espera horas por un mensaje que pierde valor con el tiempo', () => {
    // Un carrito abandonado hace tres horas ya no se recupera: reintentar dentro de dos
    // horas no sirve de nada.
    expect(esperaTrasFallo(10)).toBe(16)
    expect(esperaTrasFallo(99)).toBe(16)
  })

  it('nunca devuelve 0, ni siquiera con un contador en 0', () => {
    // Un backoff de 0 sería reintentar en loop dentro de la misma corrida.
    expect(esperaTrasFallo(0)).toBeGreaterThan(0)
  })
})

describe('lectura del payload', () => {
  it('lee la columna nueva', () => {
    const r = leerPayload({ payload: { message: 'hola', phone: '5493511234567' }, error_details: null })
    expect(r).toEqual({ message: 'hola', phone: '5493511234567' })
  })

  it('lee las filas VIEJAS que lo tienen en error_details', () => {
    // Compatibilidad con lo que quedó antes de la migración: si el backfill se saltea una
    // fila, el mensaje tiene que salir igual en vez de perderse en silencio.
    const r = leerPayload({
      payload: null,
      error_details: JSON.stringify({ message: 'hola', phone: '5493511234567' }),
    })
    expect(r).toEqual({ message: 'hola', phone: '5493511234567' })
  })

  it('la columna nueva gana sobre error_details', () => {
    const r = leerPayload({
      payload: { message: 'nuevo', phone: '111' },
      error_details: JSON.stringify({ message: 'viejo', phone: '222' }),
    })
    expect(r?.message).toBe('nuevo')
  })

  it('NO confunde una marca de idempotencia con un payload', () => {
    // error_details también guarda marcas tipo 'order:1234' y mensajes de error. Ninguna
    // es un payload, y tratarlas como tal mandaría un mensaje vacío al cliente.
    expect(leerPayload({ payload: null, error_details: 'order:1598' })).toBeNull()
    expect(leerPayload({ payload: null, error_details: 'Template not approved' })).toBeNull()
  })

  it('devuelve null si falta el teléfono o el mensaje', () => {
    expect(leerPayload({ payload: { message: 'hola' }, error_details: null })).toBeNull()
    expect(leerPayload({ payload: { phone: '549351' }, error_details: null })).toBeNull()
    expect(leerPayload({ payload: {}, error_details: null })).toBeNull()
  })

  it('no explota con JSON roto', () => {
    expect(leerPayload({ payload: null, error_details: '{"message":' })).toBeNull()
    expect(leerPayload({ payload: null, error_details: null })).toBeNull()
  })
})

describe('tope de intentos', () => {
  it('está en un valor que tolera fallos transitorios sin insistir sobre lo roto', () => {
    // Si alguien lo sube a 50, un número dado de baja genera 50 llamadas fallidas a Meta.
    expect(MAX_INTENTOS).toBeGreaterThanOrEqual(3)
    expect(MAX_INTENTOS).toBeLessThanOrEqual(10)
  })
})
