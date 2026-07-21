import { NextRequest, NextResponse } from 'next/server'
import { verificarAcceso } from '@/lib/pedidos'
import { COOKIE_CLIENTE_NOMBRE, MAX_AGE_CLIENTE, crearSesionCliente } from '@/lib/session'
import { consumirLimite, ipDe, limpiarVencidos, respuesta429 } from '@/lib/ratelimit'
import { notifyNahuel } from '@/lib/notify'

export const runtime = 'nodejs'

// El acceso es por nº de pedido + segundo factor, ambos adivinables por separado. El rate
// limit por IP y por número de pedido es lo que hace inviable el barrido: sin esto, alguien
// podría probar (pedido, factor) en masa. Al pasar el umbral se avisa a Nahuel.
const LIM_IP = { n: 8, ventana: 15 * 60 }
const LIM_ORDEN = { n: 5, ventana: 15 * 60 }

// Mensaje ÚNICO para todos los fallos: no revela si el pedido existe.
const ERROR_UNICO =
  'No pudimos verificar esos datos. Revisá el número de pedido y los últimos 4 dígitos del ' +
  'teléfono con el que compraste.'

export async function POST(req: NextRequest) {
  const secreto = process.env.DASHBOARD_PASSWORD
  if (!secreto) {
    return NextResponse.json({ error: 'Servicio no disponible' }, { status: 503 })
  }

  const porIp = await consumirLimite(`acceso:ip:${ipDe(req)}`, LIM_IP.n, LIM_IP.ventana)
  if (!porIp.permitido) return respuesta429(porIp)
  void limpiarVencidos()

  const body = await req.json().catch(() => ({}))
  const orden = String(body?.orden ?? '').trim().slice(0, 20)
  const factor = String(body?.factor ?? '').trim().slice(0, 20)
  if (!orden || !factor) {
    return NextResponse.json({ error: ERROR_UNICO }, { status: 400 })
  }

  // Tope por número de pedido: aunque roten la IP, no pueden martillar un mismo pedido.
  const soloNum = orden.replace(/\D/g, '')
  const porOrden = await consumirLimite(`acceso:ord:${soloNum}`, LIM_ORDEN.n, LIM_ORDEN.ventana)
  if (!porOrden.permitido) return respuesta429(porOrden)

  const cliente = await verificarAcceso(orden, factor)
  if (!cliente) {
    // Aviso solo cuando un mismo pedido acumula varios intentos fallidos (posible barrido).
    if (porOrden.contador >= 3) {
      void notifyNahuel(
        'Intentos de acceso al portal',
        `Varios intentos fallidos sobre el pedido #${soloNum} desde ${ipDe(req)}. ` +
          `Puede ser el cliente tecleando mal, o un barrido.`,
      ).catch(() => {})
    }
    return NextResponse.json({ error: ERROR_UNICO }, { status: 401 })
  }

  const cookie = await crearSesionCliente(
    { num: cliente.numero, nom: cliente.nombre, eq: cliente.equipos },
    secreto,
  )
  const res = NextResponse.json({ ok: true, nombre: cliente.nombre })
  res.cookies.set(COOKIE_CLIENTE_NOMBRE, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE_CLIENTE,
    path: '/',
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_CLIENTE_NOMBRE, '', { httpOnly: true, maxAge: 0, path: '/' })
  return res
}
