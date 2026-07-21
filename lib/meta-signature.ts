// Verificación de firma de los webhooks de Meta (WhatsApp Cloud API e Instagram).
//
// Meta firma cada POST con HMAC-SHA256 del cuerpo CRUDO usando el App Secret, y lo manda
// en `x-hub-signature-256`. Sin esta verificación cualquiera que conozca la URL del webhook
// puede inyectar mensajes falsos: el bot los procesa, le pega a Claude (gasto) y ENVÍA
// WhatsApp desde el número oficial al destinatario que elija el atacante → riesgo de baneo
// del WABA. El webhook de Tiendanube ya lo hacía; estos no.
//
// Falla CERRADO: si el secreto no está configurado en producción, se rechaza. Un webhook
// mudo se nota y se arregla; uno abierto no se nota hasta que es tarde.
import { createHmac, timingSafeEqual } from 'crypto'

export type VerificacionFirma =
  | { ok: true; body: string }
  | { ok: false; motivo: 'sin_secreto' | 'sin_firma' | 'firma_invalida'; status: number }

/**
 * Lee el cuerpo crudo y valida la firma. Devuelve el texto para que el handler lo parsee:
 * NO se puede usar `req.json()` antes, porque la firma es sobre los bytes exactos.
 */
export async function verificarFirmaMeta(
  req: Request,
  secreto: string | undefined,
): Promise<VerificacionFirma> {
  const body = await req.text()

  if (!secreto) {
    // En dev sin secreto se deja pasar para poder probar con curl; en producción nunca.
    if (process.env.NODE_ENV !== 'production') return { ok: true, body }
    return { ok: false, motivo: 'sin_secreto', status: 503 }
  }

  const recibida = req.headers.get('x-hub-signature-256') ?? ''
  if (!recibida.startsWith('sha256=')) {
    return { ok: false, motivo: 'sin_firma', status: 401 }
  }

  const esperada = 'sha256=' + createHmac('sha256', secreto).update(body).digest('hex')
  if (!igualSeguro(recibida, esperada)) {
    return { ok: false, motivo: 'firma_invalida', status: 401 }
  }

  return { ok: true, body }
}

/** Comparación de tiempo constante: `===` filtra información por cuánto tarda en fallar. */
export function igualSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}
