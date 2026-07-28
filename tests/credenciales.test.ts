import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tokenWhatsApp, tokenTiendanube, phoneNumberIdWhatsApp } from '@/lib/credenciales'

const tienda = (id: string) => ({
  tiendanube_store_id: id,
  whatsapp_api_token: 'wa-de-la-base',
  tiendanube_access_token: 'tn-de-la-base',
})

const env = { ...process.env }
beforeEach(() => {
  process.env.TN_STORE_ID = '1957278'
  process.env.WHATSAPP_TOKEN = 'wa-del-entorno'
  process.env.TN_ACCESS_TOKEN = 'tn-del-entorno'
  process.env.WHATSAPP_PHONE_NUMBER_ID = 'numero-del-entorno'
})
afterEach(() => {
  process.env = { ...env }
})

describe('credenciales de la tienda', () => {
  it('la tienda propia usa el entorno: es la copia que se rota', () => {
    expect(tokenWhatsApp(tienda('1957278'))).toBe('wa-del-entorno')
    expect(tokenTiendanube(tienda('1957278'))).toBe('tn-del-entorno')
  })

  it('una tienda de terceros usa su propia fila, no el token nuestro', () => {
    // Es el caso que importa el día que haya clientes: pasarle el token de Micelium a otra
    // tienda sería mandarle mensajes a sus clientes desde nuestro WABA.
    expect(tokenWhatsApp(tienda('999999'))).toBe('wa-de-la-base')
    expect(tokenTiendanube(tienda('999999'))).toBe('tn-de-la-base')
  })

  it('sin el env var cae a la base: no rompe nada que hoy ande', () => {
    delete process.env.WHATSAPP_TOKEN
    delete process.env.TN_ACCESS_TOKEN
    expect(tokenWhatsApp(tienda('1957278'))).toBe('wa-de-la-base')
    expect(tokenTiendanube(tienda('1957278'))).toBe('tn-de-la-base')
  })

  it('sin TN_STORE_ID ninguna tienda es la propia', () => {
    delete process.env.TN_STORE_ID
    expect(tokenWhatsApp(tienda('1957278'))).toBe('wa-de-la-base')
  })
})

// El número emisor tenía dos fuentes de verdad —el entorno en el webhook, la config de la
// campaña en CampaignService— y podían discrepar sin que nada avisara. Estos tests fijan
// cuál gana.
describe('número emisor de WhatsApp', () => {
  it('la tienda propia usa el entorno, no la config de la campaña', () => {
    expect(phoneNumberIdWhatsApp(tienda('1957278'), 'numero-de-la-campana'))
      .toBe('numero-del-entorno')
  })

  it('una tienda de terceros usa la config de su campaña: tiene su propio WABA', () => {
    expect(phoneNumberIdWhatsApp(tienda('999999'), 'numero-de-la-campana'))
      .toBe('numero-de-la-campana')
  })

  it('sin el env var cae a la config: no rompe lo que hoy anda', () => {
    delete process.env.WHATSAPP_PHONE_NUMBER_ID
    expect(phoneNumberIdWhatsApp(tienda('1957278'), 'numero-de-la-campana'))
      .toBe('numero-de-la-campana')
  })

  it('sin ninguna de las dos devuelve vacío, no undefined', () => {
    delete process.env.WHATSAPP_PHONE_NUMBER_ID
    expect(phoneNumberIdWhatsApp(tienda('1957278'), null)).toBe('')
  })
})
