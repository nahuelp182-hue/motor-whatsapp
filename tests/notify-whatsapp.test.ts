import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mismo cambio de criterio que cron-ia-watchdog.test.ts: acá se mockea `fetch` para poder
// probar el comportamiento real del canal WhatsApp de notifyNahuel.
//
// Vale la pena por DOS bugs reales que ya pasaron en este archivo sin que nada los agarrara:
//  1. notify.ts leía WA_TOKEN/WA_PHONE_NUMBER_ID, que nunca se cargaron en producción — el
//     canal estuvo muerto en silencio desde que se escribió (encontrado 20/08/2026).
//  2. La plantilla aprobada tiene que intentarse ANTES que el texto plano, porque el texto
//     solo entrega con ventana de 24h abierta — si alguien invierte el orden sin querer, la
//     alerta vuelve a fallar en silencio la mayoría de las veces.
// `notify.ts` no exporta las funciones internas (viaWhatsApp*) a propósito — son detalle de
// implementación. Se prueban a través de la API pública (notifyNahuel), inspeccionando las
// llamadas a fetch, igual que se verificaría contra el tráfico real.
const fetchMock = vi.fn()

/** Recarga lib/notify.ts con un set de env vars controlado (son consts de módulo: se leen
 *  una sola vez al importar, así que hace falta resetModules + import dinámico por caso). */
async function cargarNotifyConCreds(env: Record<string, string | undefined>) {
  vi.resetModules()
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  return import('@/lib/notify')
}

function llamadasA(host: string) {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes(host))
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  // Sin GMAIL_APP_PASSWORD, viaEmail() no-opea sola (getTransporter devuelve null) — así
  // notifyNahuel no intenta mandar un mail real durante el test.
  delete process.env.GMAIL_APP_PASSWORD
  delete process.env.TELEGRAM_BOT_TOKEN
  delete process.env.TELEGRAM_CHAT_ID
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('notifyNahuel — canal WhatsApp', () => {
  it('usa WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID cuando WA_TOKEN/WA_PHONE_NUMBER_ID no existen', async () => {
    const { notifyNahuel } = await cargarNotifyConCreds({
      WA_TOKEN: undefined, WA_PHONE_NUMBER_ID: undefined,
      WHATSAPP_TOKEN: 'tok-real', WHATSAPP_PHONE_NUMBER_ID: 'phone-real',
    })
    fetchMock.mockResolvedValue({ ok: true, text: async () => '' })
    await notifyNahuel('Asunto', 'Cuerpo')
    const llamadas = llamadasA('graph.facebook.com')
    expect(llamadas.length).toBeGreaterThan(0)
    expect(String(llamadas[0][0])).toContain('phone-real')
  })

  it('sin ninguna credencial (ni WA_* ni WHATSAPP_*), no llama a Meta', async () => {
    const { notifyNahuel } = await cargarNotifyConCreds({
      WA_TOKEN: undefined, WA_PHONE_NUMBER_ID: undefined,
      WHATSAPP_TOKEN: undefined, WHATSAPP_PHONE_NUMBER_ID: undefined,
    })
    await notifyNahuel('Asunto', 'Cuerpo')
    expect(llamadasA('graph.facebook.com')).toHaveLength(0)
  })

  it('intenta la plantilla primero; si Meta la rechaza, cae a texto plano', async () => {
    const { notifyNahuel } = await cargarNotifyConCreds({
      WHATSAPP_TOKEN: 'tok', WHATSAPP_PHONE_NUMBER_ID: 'phone',
    })
    fetchMock
      .mockResolvedValueOnce({ ok: false, text: async () => 'template not approved yet' })
      .mockResolvedValueOnce({ ok: true, text: async () => '' })
    await notifyNahuel('Asunto', 'Cuerpo')
    const llamadas = llamadasA('graph.facebook.com')
    expect(llamadas).toHaveLength(2)
    expect(JSON.parse(llamadas[0][1].body).type).toBe('template')
    expect(JSON.parse(llamadas[1][1].body).type).toBe('text')
  })

  it('si la plantilla entrega OK, no intenta el texto (no manda dos avisos)', async () => {
    const { notifyNahuel } = await cargarNotifyConCreds({
      WHATSAPP_TOKEN: 'tok', WHATSAPP_PHONE_NUMBER_ID: 'phone',
    })
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '' })
    await notifyNahuel('Asunto', 'Cuerpo')
    const llamadas = llamadasA('graph.facebook.com')
    expect(llamadas).toHaveLength(1)
    expect(JSON.parse(llamadas[0][1].body).type).toBe('template')
  })

  it('los parámetros de la plantilla no llevan saltos de línea (Meta los rechaza)', async () => {
    const { notifyNahuel } = await cargarNotifyConCreds({
      WHATSAPP_TOKEN: 'tok', WHATSAPP_PHONE_NUMBER_ID: 'phone',
    })
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => '' })
    await notifyNahuel('Asunto', 'Línea 1\nLínea 2\n\nLínea 3')
    const [, init] = fetchMock.mock.calls[0]
    const payload = JSON.parse(init.body)
    const textoParam = payload.template.components[0].parameters[1].text as string
    expect(textoParam).not.toContain('\n')
  })
})
