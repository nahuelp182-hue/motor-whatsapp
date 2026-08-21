import { describe, it, expect, vi, beforeEach } from 'vitest'

// El resumen diario vigilaba cola, crons, errores de envío y gasto de Claude: todo sobre la
// máquina, nada sobre la atención. Un bot que deriva el 100% de los chats y deja a la gente
// esperando pasaba las cuatro alertas en verde — y así pasó el caso del 19/08/2026, que
// terminó con un cliente anunciando una denuncia en Defensa del Consumidor sin que se
// encendiera una sola luz.
//
// Lo que se prueba acá es que la métrica NO afirme lo que no puede saber (si Mateo contestó)
// y que la señal que sí existe —el cliente que insiste después del handoff— no se pierda.
const { queryMock, getPoolMock } = vi.hoisted(() => {
  const queryMock = vi.fn()
  return { queryMock, getPoolMock: vi.fn((): { query: typeof queryMock } | null => ({ query: queryMock })) }
})

vi.mock('@/lib/db', () => ({ getPool: getPoolMock }))

import { saludDelMostrador24h } from '@/lib/diag'

function fila(f: Record<string, unknown>) {
  queryMock.mockReset()
  queryMock.mockResolvedValueOnce({ rows: [f], rowCount: 1 })
}

beforeEach(() => {
  queryMock.mockReset()
  getPoolMock.mockReturnValue({ query: queryMock })
})

describe('saludDelMostrador24h', () => {
  it('cuenta derivados, resueltos y los que siguieron escribiendo', async () => {
    fila({ derivados: 5, sin_atender: 1, espera_max: '0.20826752', patinaron: 4, resueltos: 13 })
    expect(await saludDelMostrador24h()).toEqual({
      derivados: 5, sinAtender: 1, esperaMaxHoras: 0.2, patinaron: 4, resueltos: 13,
    })
  })

  it('redondea la espera máxima a una decimal legible', async () => {
    // El valor crudo viene como '0.30618995305555555556' — un mail no muestra eso.
    fila({ derivados: 2, sin_atender: 2, espera_max: '0.30618995305555555556', patinaron: 0, resueltos: 0 })
    expect((await saludDelMostrador24h())?.esperaMaxHoras).toBe(0.3)
  })

  it('un día sin nadie esperando no inventa una espera', async () => {
    fila({ derivados: 3, sin_atender: 0, espera_max: 0, patinaron: 0, resueltos: 20 })
    const s = await saludDelMostrador24h()
    expect(s?.sinAtender).toBe(0)
    expect(s?.esperaMaxHoras).toBe(0)
  })

  it('ante un fallo de base devuelve null y no un cero engañoso', async () => {
    // Un 0 se leería como "todo bien" en el mail. null hace que el bloque no se imprima.
    queryMock.mockReset()
    queryMock.mockRejectedValue(new Error('pool caído'))
    expect(await saludDelMostrador24h()).toBeNull()
  })

  it('sin base configurada devuelve null', async () => {
    getPoolMock.mockReturnValue(null)
    expect(await saludDelMostrador24h()).toBeNull()
  })

  it('mide la insistencia del cliente, no el tiempo de respuesta de Mateo', async () => {
    // Invariante de honestidad: las respuestas de Mateo salen de su teléfono y NO se
    // loguean (bridge bloqueado por WhatsApp, confirmado 20/08/2026). Cualquier métrica que
    // afirme "tardó X en responder" estaría inventando. La query solo puede mirar
    // 'handoff_activo', que son mensajes DEL CLIENTE tras la derivación.
    fila({ derivados: 1, sin_atender: 1, espera_max: 1, patinaron: 0, resueltos: 0 })
    await saludDelMostrador24h()
    const sql = String(queryMock.mock.calls[0][0])
    expect(sql).toContain('handoff_activo')
    expect(sql).toContain("detail->>'derivar' = 'true'")
  })
})
