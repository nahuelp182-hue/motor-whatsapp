import { describe, it, expect, vi, afterEach } from 'vitest'
import { log, traceId } from '@/lib/log'

// El log estructurado solo sirve si la salida es JSON parseable con campos estables: es lo
// que permite filtrar en Vercel por ámbito o por tienda. Si alguien lo "simplifica" a texto
// suelto, estas pruebas lo avisan.

afterEach(() => {
  vi.restoreAllMocks()
})

function capturar(nivel: 'log' | 'warn' | 'error') {
  const spy = vi.spyOn(console, nivel).mockImplementation(() => {})
  return () => {
    expect(spy).toHaveBeenCalledOnce()
    return JSON.parse(spy.mock.calls[0][0] as string)
  }
}

describe('traceId', () => {
  it('usa el id de la plataforma si viene, para cruzar con los logs de Vercel', () => {
    const req = new Request('https://x.test', { headers: { 'x-vercel-id': 'iad1::abc123' } })
    expect(traceId(req)).toBe('iad1::abc123')
  })

  it('genera uno propio si no hay header', () => {
    const id = traceId(new Request('https://x.test'))
    expect(id).toMatch(/^[a-z0-9]+$/)
    expect(id.length).toBeGreaterThan(3)
  })

  it('funciona sin request (crons, tareas de fondo)', () => {
    expect(traceId()).toBeTruthy()
  })

  it('recorta un id de plataforma absurdamente largo', () => {
    const req = new Request('https://x.test', { headers: { 'x-vercel-id': 'x'.repeat(500) } })
    expect(traceId(req).length).toBeLessThanOrEqual(40)
  })
})

describe('salida estructurada', () => {
  it('emite JSON con los campos del contexto en la raíz', () => {
    const leer = capturar('log')
    log.info('mensaje de prueba', { ambito: 'cola', trace_id: 't1', store_id: 's1', extra: 7 })
    const linea = leer()

    expect(linea.nivel).toBe('info')
    expect(linea.mensaje).toBe('mensaje de prueba')
    // En la raíz, no anidados: es lo que hace que se pueda filtrar por ellos.
    expect(linea.ambito).toBe('cola')
    expect(linea.trace_id).toBe('t1')
    expect(linea.store_id).toBe('s1')
    expect(linea.extra).toBe(7)
    expect(typeof linea.ts).toBe('string')
  })

  it('los errores van por console.error, no por console.log', () => {
    const leer = capturar('error')
    log.error('algo falló', { ambito: 'wa' })
    expect(leer().nivel).toBe('error')
  })

  it('serializa un Error con su mensaje y un stack recortado', () => {
    const leer = capturar('error')
    log.error('falló el envío', { ambito: 'cola' }, new Error('token vencido'))
    const linea = leer()

    expect(linea.error).toBe('token vencido')
    expect(typeof linea.stack).toBe('string')
    // Recortado a propósito: un stack entero por línea infla el log sin agregar nada.
    expect((linea.stack as string).split('|').length).toBeLessThanOrEqual(4)
  })

  it('acepta un error que no es Error (un string, lo que tire una API)', () => {
    const leer = capturar('error')
    log.error('respuesta rara', { ambito: 'wa' }, 'HTTP 500')
    const linea = leer()

    expect(linea.error).toBe('HTTP 500')
    expect(linea.stack).toBeUndefined()
  })

  it('sin error no agrega el campo error', () => {
    const leer = capturar('warn')
    log.warn('ojo con esto', { ambito: 'cron' })
    expect(leer().error).toBeUndefined()
  })
})
