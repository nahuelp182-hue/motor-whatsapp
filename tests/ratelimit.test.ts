import { describe, it, expect, beforeAll } from 'vitest'
import { consumirLimite, tomarLatch } from '@/lib/ratelimit'

// Sin DB_HOST/DB_USER/DB_PASSWORD, `getPool()` devuelve null y `consumirLimite` no puede
// contar nada. Eso es exactamente el escenario que se quiere probar: qué hace el limitador
// cuando la base no está. No hace falta simular una caída — alcanza con no darle base.
beforeAll(() => {
  delete process.env.DB_HOST
  delete process.env.DB_USER
  delete process.env.DB_PASSWORD
})

describe('rate limit sin base', () => {
  it("en modo 'permitir' (default) deja pasar: tracking y leads valen más que el tope", async () => {
    const r = await consumirLimite('test:abierto', 5, 60)
    expect(r.permitido).toBe(true)
    expect(r.degradado).toBe(true)
  })

  it("en modo 'rechazar' corta: un control de gasto que falla abierto no es un control", async () => {
    const r = await consumirLimite('test:cerrado', 5, 60, 'rechazar')
    expect(r.permitido).toBe(false)
    expect(r.degradado).toBe(true)
    expect(r.resetEn).toBeGreaterThan(0) // el cliente recibe un Retry-After usable
  })

  it('el latch no se toma: ante la duda no se remanda el mail', async () => {
    expect(await tomarLatch('test:mail-bienvenida:1598')).toBe(false)
  })
})
