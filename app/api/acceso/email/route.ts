// Acceso por email (magic link). La puerta de menor fricción y la única que sirve para
// clientes viejos, que no tienen a mano el número de pedido.
//
// Seguridad: la respuesta es SIEMPRE la misma, exista o no una compra con ese email. Así no
// se puede usar para averiguar quién compró. El acceso viaja por la casilla, de modo que
// conocer la dirección no alcanza: hay que poder abrirla.
import { NextRequest, NextResponse } from 'next/server'
import { buscarPorEmail } from '@/lib/pedidos'
import { crearTokenEntrada } from '@/lib/session'
import { consumirLimite, ipDe, respuesta429 } from '@/lib/ratelimit'
import { BASE_URL, enviarMail, mailAcceso } from '@/lib/mails-cliente'

export const runtime = 'nodejs'

const LIM_IP = { n: 6, ventana: 15 * 60 }
const LIM_MAIL = { n: 4, ventana: 60 * 60 }

// Mensaje único, deliberadamente ambiguo respecto de si el email existe.
const RESPUESTA =
  'Si esa dirección tiene una compra registrada, en un minuto te llega el acceso. Revisá ' +
  'también la carpeta de correo no deseado.'

export async function POST(req: NextRequest) {
  const secreto = process.env.DASHBOARD_PASSWORD
  if (!secreto) return NextResponse.json({ error: 'Servicio no disponible' }, { status: 503 })

  const porIp = await consumirLimite(`accmail:ip:${ipDe(req)}`, LIM_IP.n, LIM_IP.ventana)
  if (!porIp.permitido) return respuesta429(porIp)

  const body = await req.json().catch(() => ({}))
  const email = String(body?.email ?? '').trim().toLowerCase().slice(0, 120)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'Revisá la dirección de correo.' }, { status: 400 })
  }

  // Tope por dirección: evita que se use para bombardear la casilla de un tercero.
  const porMail = await consumirLimite(`accmail:dir:${email}`, LIM_MAIL.n, LIM_MAIL.ventana)
  if (!porMail.permitido) return NextResponse.json({ ok: true, mensaje: RESPUESTA })

  const cliente = await buscarPorEmail(email)
  if (cliente) {
    const token = await crearTokenEntrada(
      { num: cliente.numero, nom: cliente.nombre, eq: cliente.equipos },
      secreto,
    )
    // No se espera al envío para responder: el resultado no debe filtrar si existía o no.
    void enviarMail(email, mailAcceso(cliente.nombre, `${BASE_URL}/e/${token}`)).catch(() => {})
  }

  return NextResponse.json({ ok: true, mensaje: RESPUESTA })
}
