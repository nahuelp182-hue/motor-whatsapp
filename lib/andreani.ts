// Estado REAL de un envío Andreani, headless (sin navegador).
//
// Reversa del sitio andreani.com: la API v3/Tracking recibe un `payload` cifrado
// AES-256-CBC (clave/IV públicas del microfrontend de seguimiento, están en su
// __ENV.js) y un header `authorization` que solo necesita ESTAR PRESENTE (el valor
// no se valida). Así se consulta el estado sin Chrome ni scraping.
import { createCipheriv } from 'crypto'

// Clave/IV públicas del microfrontend traza-microfrontend.andreani.com
const KEY = Buffer.from('12345678901234567890123456789012') // NEXT_PUBLIC_API_KEY (32B = AES-256)
const IV = Buffer.from('1234567890123456') // NEXT_PUBLIC_API_KEY_IV (16B)
const API = 'https://tracking-api.andreani.com/api/v3/Tracking'

// timelines de Andreani: 1 Pendiente · 2 Ingresado · 3 En camino · 4 En sucursal · 5 Entregado
export const ORDEN_EN_SUCURSAL = 4
export const ORDEN_ENTREGADO = 5

export type EstadoAndreani = {
  numero: string
  ok: boolean
  orden: number | null
  ordenMaxima: number | null
  titulo: string | null
  enSucursal: boolean
  entregado: boolean
  timeline: Array<{ orden: number; titulo: string; hecho: boolean }>
  error: string | null
}

function buildPayload(numero: string): string {
  const pt = JSON.stringify({
    idReceptor: 1,
    idSistema: 1,
    userData: JSON.stringify({ mail: '' }),
    numeroAndreani: String(numero),
  })
  const c = createCipheriv('aes-256-cbc', KEY, IV)
  return Buffer.concat([c.update(pt, 'utf8'), c.final()]).toString('base64')
}

export async function getEstadoAndreani(numero: string, timeoutMs = 15000): Promise<EstadoAndreani> {
  const res: EstadoAndreani = {
    numero: String(numero), ok: false, orden: null, ordenMaxima: null,
    titulo: null, enSucursal: false, entregado: false, timeline: [], error: null,
  }
  try {
    const payload = encodeURIComponent(buildPayload(numero))
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    const r = await fetch(`${API}?payload=${payload}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126',
        Accept: 'application/json, text/plain, */*',
        authorization: 'x', // solo debe existir; el valor no se valida
        Origin: 'https://www.andreani.com',
        Referer: 'https://www.andreani.com/',
      },
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t))
    if (!r.ok) { res.error = `HTTP ${r.status}`; return res }
    const data = await r.json()
    if (Array.isArray(data)) { res.error = data[0]?.message ?? 'respuesta vacía'; return res }
    const proc = data.procesoActual ?? {}
    const orden: number | null = proc.orden ?? null
    res.orden = orden
    res.titulo = proc.titulo ?? null
    const tl = Array.isArray(data.timelines) ? data.timelines : []
    res.ordenMaxima = tl.length || data.ordenMaxima || null
    res.timeline = tl.map((s: { orden: number; titulo: string }) => ({
      orden: s.orden, titulo: s.titulo, hecho: (s.orden ?? 99) <= (orden ?? 0),
    }))
    if (orden !== null) {
      res.enSucursal = orden >= ORDEN_EN_SUCURSAL
      res.entregado = orden >= ORDEN_ENTREGADO
    }
    res.ok = true
  } catch (e) {
    res.error = String(e).slice(0, 300)
  }
  return res
}

/**
 * ¿El número de seguimiento TIENE FORMA de Andreani? (15 dígitos, sin letras)
 *
 * Hace falta porque el correo NO se puede deducir del método de envío de Tiendanube: el
 * 27/07/26 un pedido despachado por Andreani figuraba con `shipping_option` = "Punto de
 * retiro", y el bot, al no leer "andreani" ahí, lo trató como Correo Argentino: le dio a la
 * clienta un link inútil y le dijo que su envío estaba viajando cuando Andreani lo tenía
 * como ENTREGADO desde hacía catorce meses.
 *
 * Es solo un filtro barato para decidir si vale la pena preguntarle a la API: la que manda
 * es la respuesta de Andreani. Correo Argentino usa códigos con letras (CD123456789AR) o de
 * otro largo, así que no entran acá.
 */
export function pareceTrackingAndreani(tracking?: string | null): boolean {
  return !!tracking && /^\d{15}$/.test(tracking.trim())
}
