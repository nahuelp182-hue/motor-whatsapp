import { describe, it, expect, vi, beforeEach } from 'vitest'

// El caso que motivó esto (Gerchu Bollati, 19/08/2026): el bot derivó bien un pedido de
// cancelación por 10 días de demora, nadie atendió, y a las 6 h venció HANDOFF_HORAS. El
// bot retomó el chat, repitió "EN CAMINO 🚚 plazo 3-5 días hábiles" y en el turno siguiente
// inventó un número de reclamo. El cliente contestó "Mentira" y anunció una denuncia.
//
// Lo que se prueba acá NO es que se derive (eso ya funcionaba): es que la derivación de un
// caso delicado NO EXPIRE, y —igual de importante— que SÍ se pueda cerrar a mano. Un
// handoff que no se puede cerrar deja al bot mudo con ese cliente durante semanas.
const { queryMock, getPoolMock } = vi.hoisted(() => {
  const queryMock = vi.fn()
  return { queryMock, getPoolMock: vi.fn((): { query: typeof queryMock } | null => ({ query: queryMock })) }
})

vi.mock('@/lib/db', () => ({ getPool: getPoolMock }))

import { handoffEsPermanente, esCierreDeHandoff } from '@/lib/diag'

const TS = '2026-08-19T21:39:31.818Z'

/**
 * Las cuatro consultas en orden: (1) última derivación, (2) ¿fue cerrada a mano?,
 * (3) ¿sigue vivo el caso?, (4) textos del cliente alrededor de esa derivación.
 */
function base(
  derivacion: unknown,
  opts: { cerrado?: boolean; vivo?: boolean; textos?: string[] } = {},
) {
  const { cerrado = false, vivo = true, textos = [] } = opts
  queryMock.mockReset()
  queryMock
    .mockResolvedValueOnce({ rows: derivacion ? [derivacion] : [], rowCount: derivacion ? 1 : 0 })
    .mockResolvedValueOnce({ rows: cerrado ? [{ ok: 1 }] : [], rowCount: cerrado ? 1 : 0 })
    .mockResolvedValueOnce({ rows: vivo ? [{ ok: 1 }] : [], rowCount: vivo ? 1 : 0 })
    .mockResolvedValueOnce({ rows: textos.map((texto) => ({ texto })), rowCount: textos.length })
}

beforeEach(() => {
  queryMock.mockReset()
  getPoolMock.mockReturnValue({ query: queryMock })
})

describe('handoffEsPermanente', () => {
  it('es permanente cuando el motivo del modelo habla de cancelación', async () => {
    base({ ts: TS, accion: null, motivo: 'Cliente solicita cancelación de compra por demora en envío — requiere gestión de reintegro/dinero' })
    expect(await handoffEsPermanente('549351')).toBe(true)
  })

  it('es permanente cuando el cliente mencionó Defensa del Consumidor, aunque el motivo venga vacío', async () => {
    // Exactamente el caso Gerchu: el 'pensado' que derivó la segunda vez tenía motivo
    // genérico, y la señal fuerte estaba en el mensaje del cliente.
    base({ ts: TS, accion: null, motivo: 'Demora en envío Andreani que requiere seguimiento' },
      { textos: ['Haré la denuncia a defensa del consumidor', 'Ya van 10 dias'] })
    expect(await handoffEsPermanente('549351')).toBe(true)
  })

  it('es permanente por acción, para quien cree que le cobraron algo que no compró', async () => {
    base({ ts: TS, accion: 'no_reconoce_compra', motivo: '' })
    expect(await handoffEsPermanente('549351')).toBe(true)
  })

  it('DEJA de ser permanente cuando una persona cerró el caso a mano', async () => {
    // Sin esto, marcar un caso como permanente lo volvía irreversible: el bot no le
    // contestaba a ese cliente hasta que la derivación saliera de la ventana larga.
    base({ ts: TS, accion: 'no_reconoce_compra', motivo: '' }, { cerrado: true })
    expect(await handoffEsPermanente('549351')).toBe(false)
  })

  it('DEJA de ser permanente un caso sin ninguna señal en semanas', async () => {
    // Verificado en la base real: dos personas que en julio avisaron "no compré nada"
    // (envío masivo mal dirigido, ya resuelto) seguían marcadas 27 días después. Sin el
    // tope de antigüedad, el bot les quedaba mudo si volvían a escribir.
    base({ ts: TS, accion: 'no_reconoce_compra', motivo: '' }, { vivo: false })
    expect(await handoffEsPermanente('549351')).toBe(false)
  })
  it('NO es permanente una consulta de uso derivada por no tener el dato', async () => {
    base({ ts: TS, accion: 'seguimiento_sin_dato', motivo: 'no hay estado del envío al día' },
      { textos: ['Hola', 'cuándo llega?'] })
    expect(await handoffEsPermanente('549351')).toBe(false)
  })

  it('no marca permanente a quien nunca fue derivado', async () => {
    base(null)
    expect(await handoffEsPermanente('549351')).toBe(false)
  })

  it('ante un fallo de base devuelve false: nadie queda mudo para siempre por un error', async () => {
    queryMock.mockReset()
    queryMock.mockRejectedValue(new Error('pool caído'))
    expect(await handoffEsPermanente('549351')).toBe(false)
  })

  it('busca los textos del cliente acotados a la derivación y al canal wa', async () => {
    // Los textos se miran HACIA ATRÁS DESDE LA DERIVACIÓN, no desde ahora: lo que importa
    // es con qué contexto se derivó, no lo que el cliente escriba días después. Y solo del
    // canal 'wa' — el mismo número puede haber escrito por Instagram (hay 61 filas de otros
    // canales en la base real).
    base({ ts: TS, accion: null, motivo: 'algo neutro' }, { textos: [] })
    await handoffEsPermanente('549351')
    const sqlTextos = String(queryMock.mock.calls[3][0])
    expect(sqlTextos).toContain("canal = 'wa'")
    expect(sqlTextos).toContain('ts <= $2')
    expect(queryMock.mock.calls[3][1]).toContain(TS)
  })
})

describe('esCierreDeHandoff', () => {
  it('reconoce la orden con el teléfono pelado', () => {
    expect(esCierreDeHandoff('cerrar 5493513298375')).toBe('5493513298375')
  })

  it('tolera +, espacios y guiones', () => {
    expect(esCierreDeHandoff('Cerrar +54 9 3513-298375')).toBe('5493513298375')
  })

  it('ignora un mensaje normal de Nahuel', () => {
    expect(esCierreDeHandoff('Hola una consulta')).toBeNull()
    expect(esCierreDeHandoff('hay que cerrar la caja hoy')).toBeNull()
  })
})
