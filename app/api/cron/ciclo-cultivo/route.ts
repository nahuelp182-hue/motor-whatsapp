// Acompañamiento del ciclo de cultivo por email.
//
// Es la pieza de mayor valor del portal y la que no tiene nadie más: el cliente recibe el
// dato que necesita EN EL DÍA en que lo necesita, sin haber pedido nada. Convierte la duda
// ("¿esto va bien?") en una referencia, que es exactamente lo que hoy llega por WhatsApp.
//
// Canal: email. Es el default para notificar al cliente — WhatsApp iniciado por nosotros
// requiere plantillas aprobadas por Meta y no se puede improvisar desde acá.
//
// Deduplicación: cada hito se "late" una sola vez por pedido usando la tabla RateLimit
// (limite 1, ventana de un año). No hizo falta tabla nueva ni migración. Ante caída de la
// base el limitador falla ABIERTO, así que en el peor caso se repite un mail: preferimos esa
// molestia a callarnos el aviso.
import { NextRequest, NextResponse } from 'next/server'
import { chequearCron } from '@/lib/cron-auth'
import { comprasParaSeguimiento, type CompraSeguimiento } from '@/lib/pedidos'
import { crearTokenEntrada } from '@/lib/session'
import {
  BASE_URL,
  enviarMail,
  mailBienvenida,
  mailCosecha,
  mailEntrega,
  mailShock,
} from '@/lib/mails-cliente'
import { tomarLatch } from '@/lib/ratelimit'

export const runtime = 'nodejs'
export const maxDuration = 60

// Los hitos, contados desde la entrega (o desde el pago si es material digital). La ventana
// evita que un cron que no corrió un día se saltee el aviso, y que uno que corre dos veces
// mande dos: para eso está el latch.
type Hito = {
  id: string
  /** Desde qué reloj se cuenta: el pago (bienvenida) o la entrega (ciclo de cultivo). */
  reloj: 'pago' | 'entrega'
  desde: number
  hasta: number
  arma: (nombre: string, url: string, soloDigital: boolean) => { subject: string; html: string }
}

const HITOS: Hito[] = [
  { id: 'bienvenida', reloj: 'pago', desde: 0, hasta: 2, arma: mailBienvenida },
  { id: 'entrega', reloj: 'entrega', desde: 1, hasta: 4, arma: mailEntrega },
  { id: 'shock', reloj: 'entrega', desde: 21, hasta: 25, arma: mailShock },
  { id: 'cosecha', reloj: 'entrega', desde: 35, hasta: 40, arma: mailCosecha },
]

function hitoDe(c: CompraSeguimiento): Hito | null {
  // SOLO compradores de la incubadora INC101. Los mails hablan de la sonda, del shock
  // térmico y de la cosecha: asumen ese equipo. Mantas calefactoras (pc400), material
  // digital (ebook) y compras sin clasificar (otro) quedan afuera a propósito.
  if (!c.equipos.includes('inc101')) return null
  for (const h of HITOS) {
    // Sin entrega confirmada no corre el reloj del cultivo: el equipo todavía no llegó.
    const base = h.reloj === 'pago' ? c.pagado : c.entrega
    if (!base) continue
    const dias = (Date.now() - base.getTime()) / 86_400_000
    if (dias >= h.desde && dias < h.hasta) return h
  }
  return null
}

export async function GET(req: NextRequest) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth

  const secreto = process.env.DASHBOARD_PASSWORD
  if (!secreto) return NextResponse.json({ error: 'sin secreto' }, { status: 503 })

  // Franja horaria humana: un mail a las 4 de la mañana se lee como spam automático.
  const horaAr = (new Date().getUTCHours() + 24 - 3) % 24
  if (horaAr < 9 || horaAr >= 21) {
    return NextResponse.json({ enviados: 0, motivo: 'fuera de horario 9-21 AR' })
  }

  const compras = await comprasParaSeguimiento()
  const enviados: Array<{ pedido: number; hito: string }> = []
  let fallidos = 0

  for (const c of compras) {
    const hito = hitoDe(c)
    if (!hito) continue

    if (!(await tomarLatch(`ciclo:${c.numero}:${hito.id}`))) continue

    const token = await crearTokenEntrada(
      { num: c.numero, nom: c.nombre, eq: c.equipos },
      secreto,
    )
    const ok = await enviarMail(
      c.email,
      // Siempre INC101 (hardware), nunca material digital: soloDigital = false.
      hito.arma(c.nombre, `${BASE_URL}/e/${token}`, false),
    )
    if (ok) enviados.push({ pedido: c.numero, hito: hito.id })
    else fallidos++
  }

  return NextResponse.json({ revisadas: compras.length, enviados, fallidos })
}
