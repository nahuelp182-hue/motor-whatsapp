// Cookie de sesión firmada.
//
// Antes la cookie `dash-auth` guardaba la contraseña EN CLARO y el middleware la comparaba
// contra el env var. Eso implicaba: la clave real viajaba en cada request, quedaba en
// cualquier log de cabeceras, y no había forma de expirar una sesión sin cambiar la clave.
//
// Ahora la cookie es `<payload base64url>.<hmac>`: lleva vencimiento propio y se puede
// invalidar sin tocar la contraseña.
//
// Usa Web Crypto (`crypto.subtle`), NO `node:crypto`, porque el middleware de Next corre en
// el runtime Edge donde los módulos de Node no existen. Web Crypto anda en Edge y en Node.
const COOKIE = 'dash-auth'
const DIAS = 30

export type Sesion = { sub: string; iat: number; exp: number }

const enc = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function desdeB64url(s: string): string {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/')
  return atob(pad + '='.repeat((4 - (pad.length % 4)) % 4))
}

async function clave(secreto: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
}

async function firmar(payload: string, secreto: string): Promise<string> {
  const mac = await crypto.subtle.sign('HMAC', await clave(secreto), enc.encode(payload))
  return b64url(new Uint8Array(mac))
}

/** Comparación de tiempo constante (no hay timingSafeEqual en Edge). */
function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let dif = 0
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return dif === 0
}

/** Genera el valor de cookie para un sujeto (`dashboard`, o un id de cliente a futuro). */
export async function crearSesion(sub: string, secreto: string, dias = DIAS): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000)
  const sesion: Sesion = { sub, iat: ahora, exp: ahora + dias * 86400 }
  const payload = b64url(enc.encode(JSON.stringify(sesion)))
  return `${payload}.${await firmar(payload, secreto)}`
}

/** Verifica firma y vencimiento. Devuelve null si algo no cierra. */
export async function verificarSesion(
  valor: string | undefined,
  secreto: string,
): Promise<Sesion | null> {
  if (!valor) return null
  const punto = valor.lastIndexOf('.')
  if (punto < 1) return null

  const payload = valor.slice(0, punto)
  const firma = valor.slice(punto + 1)
  if (!igualSeguro(firma, await firmar(payload, secreto))) return null

  try {
    const s = JSON.parse(desdeB64url(payload)) as Sesion
    if (typeof s.exp !== 'number' || s.exp < Math.floor(Date.now() / 1000)) return null
    return s
  } catch {
    return null
  }
}

export const COOKIE_SESION = COOKIE
export const MAX_AGE_SESION = DIAS * 86400
