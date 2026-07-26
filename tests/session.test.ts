import { describe, it, expect } from 'vitest'
import {
  crearSesion,
  verificarSesion,
  crearSesionCliente,
  verificarSesionCliente,
  crearTokenEntrada,
  verificarTokenEntrada,
} from '@/lib/session'

const SECRETO = 'contraseña-de-prueba-no-real'

// ─────────────────────────────────────────────────────────────────────────────
// Reproduce el esquema de firma VIEJO (secreto sin derivar por dominio) para poder probar
// dos cosas a la vez: que los tokens ya emitidos siguen andando donde corresponde, y que
// —aun siendo válidos— no sirven para entrar al panel.
const enc = new TextEncoder()
function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
async function sellarLegado(datos: object, secreto: string): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify(datos)))
  const k = await crypto.subtle.importKey(
    'raw',
    enc.encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign('HMAC', k, enc.encode(payload))
  return `${payload}.${b64url(new Uint8Array(mac))}`
}
const enUnMes = () => Math.floor(Date.now() / 1000) + 30 * 86400

describe('sesión del panel', () => {
  it('acepta la cookie que ella misma emite', async () => {
    const s = await verificarSesion(await crearSesion('dashboard', SECRETO), SECRETO)
    expect(s?.sub).toBe('dashboard')
  })

  it('rechaza otro secreto', async () => {
    const c = await crearSesion('dashboard', SECRETO)
    expect(await verificarSesion(c, 'otra-contraseña')).toBeNull()
  })

  it('rechaza una cookie vencida', async () => {
    const c = await crearSesion('dashboard', SECRETO, -1)
    expect(await verificarSesion(c, SECRETO)).toBeNull()
  })

  it('rechaza un payload manipulado', async () => {
    const c = await crearSesion('dashboard', SECRETO)
    const [payload, firma] = c.split('.')
    const otro = b64url(enc.encode(JSON.stringify({ sub: 'dashboard', iat: 0, exp: enUnMes() })))
    expect(await verificarSesion(`${otro}.${firma}`, SECRETO)).toBeNull()
    expect(payload).not.toBe(otro)
  })

  it('rechaza basura', async () => {
    for (const v of [undefined, '', '.', 'sinpunto', 'a.b']) {
      expect(await verificarSesion(v as string | undefined, SECRETO)).toBeNull()
    }
  })
})

// El agujero real que hubo: las tres credenciales se firmaban con el mismo secreto y
// `verificarSesion` solo miraba firma y vencimiento. Un cliente copiaba su cookie
// `mic-cliente` (o el token del mail) al lugar de `dash-auth` y entraba a facturación,
// clientes y conversaciones. Estos tests son los que no pueden volver a pasar en verde.
describe('REGRESIÓN: ninguna credencial de cliente abre el panel', () => {
  it('la cookie de cliente no sirve como sesión de panel', async () => {
    const cli = await crearSesionCliente({ num: 1598, nom: 'Ana', eq: ['inc101'] }, SECRETO)
    expect(await verificarSesionCliente(cli, SECRETO)).not.toBeNull() // es válida donde debe
    expect(await verificarSesion(cli, SECRETO)).toBeNull() // y solo ahí
  })

  it('el token de entrada del mail no sirve como sesión de panel', async () => {
    const tok = await crearTokenEntrada({ num: 1598, nom: 'Ana', eq: ['inc101'] }, SECRETO)
    expect(await verificarTokenEntrada(tok, SECRETO)).not.toBeNull()
    expect(await verificarSesion(tok, SECRETO)).toBeNull()
  })

  it('tampoco sirven las credenciales viejas, firmadas con el secreto sin derivar', async () => {
    const cliViejo = await sellarLegado(
      { num: 1598, nom: 'Ana', eq: ['inc101'], iat: 0, exp: enUnMes() },
      SECRETO,
    )
    const tokViejo = await sellarLegado(
      { num: 1598, nom: 'Ana', eq: ['inc101'], jti: 'abc', exp: enUnMes() },
      SECRETO,
    )
    expect(await verificarSesion(cliViejo, SECRETO)).toBeNull()
    expect(await verificarSesion(tokViejo, SECRETO)).toBeNull()
  })

  it('una sesión de panel tampoco pasa por sesión de cliente', async () => {
    const dash = await crearSesion('dashboard', SECRETO)
    expect(await verificarSesionCliente(dash, SECRETO)).toBeNull()
  })
})

describe('sesión de cliente', () => {
  it('conserva los datos del pedido', async () => {
    const c = await crearSesionCliente({ num: 1598, nom: 'Ana', eq: ['inc101', 'pc400'] }, SECRETO)
    const s = await verificarSesionCliente(c, SECRETO)
    expect(s?.num).toBe(1598)
    expect(s?.eq).toEqual(['inc101', 'pc400'])
  })

  it('acepta num 0 (acceso por código, sin pedido asociado)', async () => {
    const c = await crearSesionCliente({ num: 0, nom: '', eq: ['inc101'] }, SECRETO)
    expect(await verificarSesionCliente(c, SECRETO)).not.toBeNull()
  })

  it('rechaza el token de entrada: es de un solo uso y dura 7 días, no 30', async () => {
    const tok = await crearTokenEntrada({ num: 1598, nom: 'Ana', eq: ['inc101'] }, SECRETO)
    expect(await verificarSesionCliente(tok, SECRETO)).toBeNull()
  })

  it('sigue aceptando la cookie vieja durante la transición', async () => {
    const viejo = await sellarLegado(
      { num: 1598, nom: 'Ana', eq: ['inc101'], iat: 0, exp: enUnMes() },
      SECRETO,
    )
    expect((await verificarSesionCliente(viejo, SECRETO))?.num).toBe(1598)
  })
})

describe('token de entrada', () => {
  it('trae un jti distinto en cada emisión (es lo que permite quemarlo)', async () => {
    const a = await crearTokenEntrada({ num: 1, nom: 'A', eq: [] }, SECRETO)
    const b = await crearTokenEntrada({ num: 1, nom: 'A', eq: [] }, SECRETO)
    const jtiA = (await verificarTokenEntrada(a, SECRETO))?.jti
    const jtiB = (await verificarTokenEntrada(b, SECRETO))?.jti
    expect(jtiA).toBeTruthy()
    expect(jtiA).not.toBe(jtiB)
  })

  it('rechaza la cookie de cliente (no tiene jti que quemar)', async () => {
    const cli = await crearSesionCliente({ num: 1598, nom: 'Ana', eq: ['inc101'] }, SECRETO)
    expect(await verificarTokenEntrada(cli, SECRETO)).toBeNull()
  })

  it('sigue aceptando los links ya enviados por mail', async () => {
    const viejo = await sellarLegado(
      { num: 1598, nom: 'Ana', eq: ['inc101'], jti: 'abc-123', exp: enUnMes() },
      SECRETO,
    )
    expect((await verificarTokenEntrada(viejo, SECRETO))?.jti).toBe('abc-123')
  })

  it('vence', async () => {
    const t = await crearTokenEntrada({ num: 1, nom: 'A', eq: [] }, SECRETO, -1)
    expect(await verificarTokenEntrada(t, SECRETO)).toBeNull()
  })
})
