import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tokenWhatsApp, tokenTiendanube } from '@/lib/credenciales'

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
