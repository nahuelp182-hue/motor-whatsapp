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
//
// ─────────────────────────────────────────────────────────────────────────────
// SEPARACIÓN DE DOMINIOS (arreglo de escalada de privilegios)
//
// Acá conviven tres credenciales distintas —sesión del panel, sesión de cliente y token de
// entrada por mail— y las tres se firmaban con el MISMO secreto (`DASHBOARD_PASSWORD`).
// Como `verificarSesion` solo miraba firma y vencimiento, un cliente podía copiar su cookie
// `mic-cliente` (o el token del mail) al lugar de `dash-auth` y entrar al panel interno:
// la firma verificaba, el `exp` era válido, y nadie chequeaba QUÉ era ese token.
//
// Se corrige en dos capas independientes, a propósito:
//
//  1. VALIDACIÓN DE TIPO EN EL PAYLOAD. Cada verificador exige la forma de su propio token
//     y rechaza las otras dos. Es lo que cierra el agujero de verdad, y sigue cerrándolo
//     aunque mañana alguien vuelva a compartir la clave sin darse cuenta.
//  2. CLAVE DERIVADA POR DOMINIO. Cada tipo firma con una clave distinta derivada del
//     secreto. Así una firma de un dominio ni siquiera verifica en otro.
//
// Una sola de las dos alcanzaría hoy. Van las dos porque la capa 1 protege de un error de
// configuración y la capa 2 de un error de lógica, y no se equivocan juntas.
const COOKIE = 'dash-auth'
const DIAS = 30

/** Tipos de token que emite este módulo. Nunca deben ser intercambiables. */
type Dominio = 'dashboard' | 'cliente' | 'entrada'

/**
 * Deriva la clave de firma de cada dominio a partir del secreto del servidor.
 *
 * El prefijo `mic.v2` es el que hace la separación; el `v2` además invalida de una todas
 * las cookies emitidas con el esquema viejo (ver ACEPTAR_FIRMA_LEGADO abajo).
 */
function secretoDe(secreto: string, dom: Dominio): string {
  return `mic.v2.${dom}.${secreto}`
}

/**
 * Ventana de transición: acepta además firmas del esquema viejo (secreto sin derivar), para
 * que el cambio no deslogueé a los clientes con sesión activa ni rompa los links de acceso
 * que ya salieron por mail (viven 7 días).
 *
 * NO afecta a la seguridad del arreglo: la validación de tipo del payload (capa 1) corre
 * igual sobre los tokens viejos, y es esa la que impide usar uno de cliente como si fuera
 * del panel. Lo único que se posterga es la capa 2.
 *
 * El panel queda afuera a propósito: son dos personas y volver a loguearse es gratis, así
 * que ahí el corte es limpio desde el minuto cero.
 *
 * PONER EN false (y borrar el código muerto) después del 2026-08-15: para esa fecha ya
 * vencieron todos los tokens de entrada y las sesiones se renovaron solas.
 */
const ACEPTAR_FIRMA_LEGADO = true

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

/** Empaqueta un objeto como `<payload>.<firma>` con la clave del dominio. */
async function sellar(datos: object, secreto: string, dom: Dominio): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify(datos)))
  return `${payload}.${await firmar(payload, secretoDe(secreto, dom))}`
}

/**
 * Verifica firma y vencimiento y devuelve el payload crudo. NO valida el tipo: eso lo hace
 * cada verificador público, que es el que sabe qué forma espera.
 */
async function abrir(
  valor: string | undefined,
  secreto: string,
  dom: Dominio,
  legado: boolean,
): Promise<Record<string, unknown> | null> {
  if (!valor) return null
  const punto = valor.lastIndexOf('.')
  if (punto < 1) return null

  const payload = valor.slice(0, punto)
  const firma = valor.slice(punto + 1)

  let firmaOk = igualSeguro(firma, await firmar(payload, secretoDe(secreto, dom)))
  if (!firmaOk && legado && ACEPTAR_FIRMA_LEGADO) {
    firmaOk = igualSeguro(firma, await firmar(payload, secreto))
  }
  if (!firmaOk) return null

  try {
    const o = JSON.parse(desdeB64url(payload)) as Record<string, unknown>
    if (typeof o.exp !== 'number' || o.exp < Math.floor(Date.now() / 1000)) return null
    return o
  } catch {
    return null
  }
}

/** Genera el valor de cookie para un sujeto (`dashboard`, o un id de cliente a futuro). */
export async function crearSesion(sub: string, secreto: string, dias = DIAS): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000)
  const sesion: Sesion = { sub, iat: ahora, exp: ahora + dias * 86400 }
  return sellar(sesion, secreto, 'dashboard')
}

/**
 * Verifica una sesión del PANEL. Devuelve null si algo no cierra.
 *
 * El chequeo de `sub` no es cosmético: es lo que impide que una credencial de cliente
 * —que no lo lleva— pase por sesión de panel.
 */
export async function verificarSesion(
  valor: string | undefined,
  secreto: string,
): Promise<Sesion | null> {
  // legado: false → las cookies del panel viejas no se aceptan, se vuelve a loguear.
  const o = await abrir(valor, secreto, 'dashboard', false)
  if (!o) return null
  if (typeof o.sub !== 'string' || !o.sub) return null
  if ('num' in o || 'jti' in o) return null // forma de cliente o de token de entrada
  return o as unknown as Sesion
}

export const COOKIE_SESION = COOKIE
export const MAX_AGE_SESION = DIAS * 86400

// ─────────────────────────────────────────────────────────────────────────────
// Sesión de CLIENTE (área privada /mi-equipo). Cookie e identidad separadas de la del
// dashboard: un cliente logueado nunca puede ver nada del panel interno, y viceversa.
//
// El payload lleva los datos MÍNIMOS del pedido (número, nombre de pila, qué equipos). Van
// firmados, así el área privada funciona aunque Tiendanube esté caído, sin volver a pedir
// PII. El customerId/orderId sale SIEMPRE de acá (cookie firmada server-side), NUNCA de un
// parámetro de la request: es la defensa contra IDOR (que alguien pida el pedido de otro).

const COOKIE_CLIENTE = 'mic-cliente'
const DIAS_CLIENTE = 30

export type SesionCliente = {
  num: number // número de pedido
  nom: string // nombre de pila
  eq: string[] // equipos comprados
  iat: number
  exp: number
}

export async function crearSesionCliente(
  datos: { num: number; nom: string; eq: string[] },
  secreto: string,
  dias = DIAS_CLIENTE,
): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000)
  const s: SesionCliente = { ...datos, iat: ahora, exp: ahora + dias * 86400 }
  return sellar(s, secreto, 'cliente')
}

export async function verificarSesionCliente(
  valor: string | undefined,
  secreto: string,
): Promise<SesionCliente | null> {
  const o = await abrir(valor, secreto, 'cliente', true)
  if (!o) return null
  if (typeof o.num !== 'number') return null
  // Un token de entrada trae `jti` y es de un solo uso: aceptarlo como sesión sería saltear
  // el quemado de /e/[token] y darle vida de 30 días a un enlace de 7.
  if ('jti' in o) return null
  if ('sub' in o) return null // sesión del panel
  return o as unknown as SesionCliente
}

export const COOKIE_CLIENTE_NOMBRE = COOKIE_CLIENTE
export const MAX_AGE_CLIENTE = DIAS_CLIENTE * 86400

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN DE ENTRADA (link pre-autenticado)
//
// Es el mecanismo que elimina el login: el cliente recibe en su mail un enlace que ya trae
// la identidad firmada, lo abre y queda dentro. Nunca escribe un número de pedido.
//
// Vida corta (7 días por defecto) y de un solo uso: lo que dura 30 días es la COOKIE que el
// enlace instala, no el enlace. Así, si el mail se reenvía o queda en una casilla
// compartida, el link ya no sirve. El `jti` es lo que permite quemarlo (ver /e/[token]).

const DIAS_ENTRADA = 7

export type TokenEntrada = {
  num: number
  nom: string
  eq: string[]
  jti: string // identificador único: es lo que se marca como consumido
  exp: number
}

export async function crearTokenEntrada(
  datos: { num: number; nom: string; eq: string[] },
  secreto: string,
  dias = DIAS_ENTRADA,
): Promise<string> {
  const t: TokenEntrada = {
    ...datos,
    jti: crypto.randomUUID(),
    exp: Math.floor(Date.now() / 1000) + dias * 86400,
  }
  return sellar(t, secreto, 'entrada')
}

export async function verificarTokenEntrada(
  valor: string | undefined,
  secreto: string,
): Promise<TokenEntrada | null> {
  const o = await abrir(valor, secreto, 'entrada', true)
  if (!o) return null
  if (typeof o.num !== 'number' || typeof o.jti !== 'string' || !o.jti) return null
  if ('sub' in o) return null
  return o as unknown as TokenEntrada
}
