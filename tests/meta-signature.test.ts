import { describe, it, expect, vi, afterEach } from 'vitest'
import { createHmac } from 'crypto'
import { verificarFirmaMeta } from '@/lib/meta-signature'

const SECRETO = 'app-secret-de-prueba'

function firmar(body: string, secreto = SECRETO): string {
  return 'sha256=' + createHmac('sha256', secreto).update(body).digest('hex')
}

// Reproduce lo mínimo de la Request real: verificarFirmaMeta necesita `.text()` y `.headers`.
function reqCon(body: string, firma?: string): Request {
  const headers = new Headers()
  if (firma !== undefined) headers.set('x-hub-signature-256', firma)
  return new Request('https://mw-micelium.vercel.app/api/webhooks/whatsapp', {
    method: 'POST',
    headers,
    body,
  })
}

// Esta es la única barrera entre un POST de cualquiera y que el bot conteste, gaste
// Claude y mande un WhatsApp real desde el número oficial. Ver la nota de riesgo en
// lib/meta-signature.ts.
describe('verificarFirmaMeta', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('acepta un cuerpo firmado con el secreto correcto', async () => {
    const body = JSON.stringify({ object: 'whatsapp_business_account' })
    const r = await verificarFirmaMeta(reqCon(body, firmar(body)), SECRETO)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.body).toBe(body)
  })

  it('rechaza un cuerpo sin firma', async () => {
    const r = await verificarFirmaMeta(reqCon('{}'), SECRETO)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.motivo).toBe('sin_firma')
      expect(r.status).toBe(401)
    }
  })

  it('rechaza una firma que no empieza con sha256=', async () => {
    const r = await verificarFirmaMeta(reqCon('{}', 'md5=abc'), SECRETO)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('sin_firma')
  })

  it('rechaza una firma calculada con OTRO secreto (mensaje inyectado)', async () => {
    const body = JSON.stringify({ inyectado: true })
    const r = await verificarFirmaMeta(reqCon(body, firmar(body, 'secreto-atacante')), SECRETO)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.motivo).toBe('firma_invalida')
      expect(r.status).toBe(401)
    }
  })

  it('rechaza si el cuerpo cambió después de firmarlo (integridad)', async () => {
    const original = JSON.stringify({ text: 'original' })
    const firma = firmar(original)
    const modificado = JSON.stringify({ text: 'modificado' })
    const r = await verificarFirmaMeta(reqCon(modificado, firma), SECRETO)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toBe('firma_invalida')
  })

  it('en producción, SIN secreto configurado, falla cerrado', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const r = await verificarFirmaMeta(reqCon('{}'), undefined)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.motivo).toBe('sin_secreto')
      expect(r.status).toBe(503)
    }
  })

  it('fuera de producción, SIN secreto configurado, deja pasar (para probar con curl)', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    const r = await verificarFirmaMeta(reqCon('{}'), undefined)
    expect(r.ok).toBe(true)
  })
})
