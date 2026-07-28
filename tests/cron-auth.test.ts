import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { chequearCron } from '@/lib/cron-auth'

const SECRETO = 'cron-secret-de-prueba'

function reqCon(auth?: string): Request {
  const headers = new Headers()
  if (auth !== undefined) headers.set('authorization', auth)
  return new Request('https://mw-micelium.vercel.app/api/cron/send-pending', { headers })
}

// Esta es la única barrera entre cualquiera que conozca la URL y disparar los crons que
// mandan WhatsApp o leen pedidos de Tiendanube. Ver la nota en lib/cron-auth.ts.
describe('chequearCron', () => {
  const prevSecreto = process.env.CRON_SECRET

  beforeEach(() => {
    process.env.CRON_SECRET = SECRETO
  })

  afterEach(() => {
    if (prevSecreto === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = prevSecreto
  })

  it('autoriza con el Bearer correcto', () => {
    expect(chequearCron(reqCon(`Bearer ${SECRETO}`))).toBeNull()
  })

  it('rechaza sin header authorization', () => {
    const r = chequearCron(reqCon())
    expect(r).not.toBeNull()
    expect(r?.status).toBe(401)
  })

  it('rechaza un secreto incorrecto', () => {
    const r = chequearCron(reqCon('Bearer otra-cosa'))
    expect(r?.status).toBe(401)
  })

  it('rechaza un secreto que es prefijo del correcto (comparación de longitud)', () => {
    const r = chequearCron(reqCon(`Bearer ${SECRETO.slice(0, -1)}`))
    expect(r?.status).toBe(401)
  })

  it('FALLA CERRADO: sin CRON_SECRET configurado, se rechaza (no queda público)', () => {
    delete process.env.CRON_SECRET
    const r = chequearCron(reqCon(`Bearer ${SECRETO}`))
    expect(r).not.toBeNull()
    expect(r?.status).toBe(503)
  })
})
