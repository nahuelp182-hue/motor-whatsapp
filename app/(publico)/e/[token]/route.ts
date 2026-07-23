// Entrada pre-autenticada: `/e/<token>`.
//
// Es la puerta principal del portal. El cliente llega desde un mail nuestro, el token trae
// su identidad firmada, se le instala la cookie de 30 días y entra sin escribir nada. El
// formulario de /acceso queda como recuperación, no como camino principal.
//
// Un solo uso: el `jti` se quema en la tabla RateLimit (limite 1, ventana de 1 año), que ya
// existe y es atómica, así que no hizo falta una tabla nueva. Ante caída de la base el
// limitador falla ABIERTO y el token vuelve a ser reutilizable dentro de su vigencia de 7
// días: es una degradación deliberada — preferimos que el cliente entre a que se quede
// afuera por un problema nuestro.
import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_CLIENTE_NOMBRE, MAX_AGE_CLIENTE, crearSesionCliente, verificarTokenEntrada } from '@/lib/session'
import { tomarLatch } from '@/lib/ratelimit'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const secreto = process.env.DASHBOARD_PASSWORD
  const { token } = await ctx.params

  const destino = new URL('/mi-equipo', req.url)
  const caido = new URL('/acceso?link=vencido', req.url)

  if (!secreto) return NextResponse.redirect(caido)

  const t = await verificarTokenEntrada(token, secreto)
  if (!t) return NextResponse.redirect(caido)

  if (!(await tomarLatch(`entrada:${t.jti}`))) {
    return NextResponse.redirect(new URL('/acceso?link=usado', req.url))
  }

  const cookie = await crearSesionCliente({ num: t.num, nom: t.nom, eq: t.eq }, secreto)
  const res = NextResponse.redirect(destino)
  res.cookies.set(COOKIE_CLIENTE_NOMBRE, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE_CLIENTE,
    path: '/',
  })
  return res
}
