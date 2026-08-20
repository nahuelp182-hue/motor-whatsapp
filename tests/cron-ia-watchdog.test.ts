import { describe, it, expect, vi, beforeEach } from 'vitest'

// Cambio de criterio respecto al resto de la suite (ver vitest.config.ts: "a propósito NO
// levanta base ni servidor"): acá SÍ se ejercita el route handler completo, mockeando el
// pool de Postgres y los canales de aviso. Vale la pena solo porque ia-watchdog es la pieza
// que reemplazó a "enterarse días después" (auditoría del 20/08) — su lógica de umbral y de
// distinguir la causa (saldo agotado vs. otra falla) es la que importa que no se rompa
// callada, y un invariante estático no alcanza para probar ESE comportamiento.
const { queryMock, getPoolMock, notifyNahuelMock, marcarHeartbeatMock, consumirLimiteMock } = vi.hoisted(() => {
  const queryMock = vi.fn()
  return {
    queryMock,
    getPoolMock: vi.fn((): { query: typeof queryMock } | null => ({ query: queryMock })),
    notifyNahuelMock: vi.fn(),
    marcarHeartbeatMock: vi.fn(),
    consumirLimiteMock: vi.fn(),
  }
})

vi.mock('@/lib/db', () => ({ getPool: getPoolMock }))
vi.mock('@/lib/notify', () => ({ notifyNahuel: notifyNahuelMock }))
vi.mock('@/lib/cron-heartbeat', () => ({ marcarHeartbeat: marcarHeartbeatMock }))
vi.mock('@/lib/ratelimit', () => ({ consumirLimite: consumirLimiteMock }))

import { GET } from '@/app/api/cron/ia-watchdog/route'

const CRON_SECRET = 'test-secret-ia-watchdog'

function req(): Request {
  return new Request('https://x.invalid/api/cron/ia-watchdog', {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  })
}

function filaError(detail: unknown, canal = 'wa') {
  return { canal, detail: JSON.stringify(detail), ts: new Date().toISOString() }
}

beforeEach(() => {
  queryMock.mockReset()
  notifyNahuelMock.mockReset()
  marcarHeartbeatMock.mockReset()
  consumirLimiteMock.mockReset()
  consumirLimiteMock.mockResolvedValue({ permitido: true, contador: 1, limite: 1, resetEn: 3600 })
  process.env.CRON_SECRET = CRON_SECRET
})

describe('GET /api/cron/ia-watchdog', () => {
  it('sin CRON_SECRET configurado, rechaza (falla cerrado) y no toca la base', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(req())
    expect(res.status).toBe(503)
    expect(queryMock).not.toHaveBeenCalled()
  })

  it('con menos errores que el umbral, no avisa a nadie', async () => {
    queryMock.mockResolvedValueOnce({ rows: [filaError({}), filaError({})] }) // 2 < UMBRAL_ERRORES (3)
    const res = await GET(req())
    const body = await res.json()
    expect(body).toMatchObject({ ok: true, total: 2 })
    expect(notifyNahuelMock).not.toHaveBeenCalled()
  })

  it('con el umbral cumplido y "credit balance" en el detalle, avisa el caso de saldo', async () => {
    const filas = [
      filaError({ error: 'Error: 400 {"type":"invalid_request_error","message":"Your credit balance is too low"}' }),
      filaError({ error: 'timeout' }),
      filaError({ error: 'Error: 400 {"message":"credit balance too low"}' }),
    ]
    queryMock.mockResolvedValueOnce({ rows: filas })
    const res = await GET(req())
    const body = await res.json()
    expect(body).toMatchObject({ total: 3, porSaldo: 2 })
    expect(notifyNahuelMock).toHaveBeenCalledTimes(1)
    const [asunto, detalle] = notifyNahuelMock.mock.calls[0] as [string, string]
    expect(asunto).toMatch(/Saldo de Anthropic agotado/)
    expect(detalle).toMatch(/console\.anthropic\.com/)
  })

  it('con el umbral cumplido pero SIN "credit balance", avisa el caso genérico (sin inventar la causa)', async () => {
    const filas = [filaError({ error: 'timeout' }), filaError({ error: 'ETIMEDOUT' }), filaError({ error: '500' })]
    queryMock.mockResolvedValueOnce({ rows: filas })
    await GET(req())
    expect(notifyNahuelMock).toHaveBeenCalledTimes(1)
    const [asunto] = notifyNahuelMock.mock.calls[0] as [string, string]
    expect(asunto).not.toMatch(/Saldo de Anthropic/)
    expect(asunto).toMatch(/fallando al responder/)
  })

  it('respeta el rate limit: no repite el aviso si ya se mandó en la ventana', async () => {
    consumirLimiteMock.mockResolvedValueOnce({ permitido: false, contador: 2, limite: 1, resetEn: 1800 })
    queryMock.mockResolvedValueOnce({ rows: [filaError({}), filaError({}), filaError({})] })
    await GET(req())
    expect(notifyNahuelMock).not.toHaveBeenCalled()
  })

  it('deja constancia del heartbeat con el conteo real, haya avisado o no', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] })
    await GET(req())
    expect(marcarHeartbeatMock).toHaveBeenCalledWith('ia-watchdog', true, expect.stringContaining('errores=0'))
  })

  it('sin pool de base, responde 503 sin explotar', async () => {
    getPoolMock.mockReturnValueOnce(null)
    const res = await GET(req())
    expect(res.status).toBe(503)
  })
})
