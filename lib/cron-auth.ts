// Autorización de las rutas /api/cron.
//
// Corrige dos cosas que estaban repetidas a mano en cada ruta:
//  1. Tres rutas (radar, resumen-bot, sync-calendario) usaban
//     `if (process.env.CRON_SECRET && auth !== ...)` → si el env var faltaba quedaban
//     PÚBLICAS. Ahora sin secreto configurado se rechaza (falla cerrado).
//  2. La comparación era con `!==`, que corta apenas encuentra una diferencia y filtra
//     información por tiempo. Ahora es de tiempo constante.
import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

function igualSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/**
 * Devuelve null si la request está autorizada, o la respuesta de error que hay que retornar.
 *
 *   const noAuth = chequearCron(req)
 *   if (noAuth) return noAuth
 */
export function chequearCron(req: Request): NextResponse | null {
  const secreto = process.env.CRON_SECRET
  if (!secreto) {
    console.error('[cron] CRON_SECRET no configurado: se rechaza por seguridad')
    return NextResponse.json({ error: 'Servicio mal configurado' }, { status: 503 })
  }
  const auth = req.headers.get('authorization') ?? ''
  if (!igualSeguro(auth, `Bearer ${secreto}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
