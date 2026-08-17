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
import {
  comprasParaSeguimiento,
  leadsParaSeguimiento,
  type CompraSeguimiento,
  type LeadSeguimiento,
} from '@/lib/pedidos'
import { crearTokenEntrada } from '@/lib/session'
import {
  BASE_URL,
  enviarMail,
  mailBienvenida,
  mailCosecha,
  mailEntrega,
  mailShock,
} from '@/lib/mails-cliente'
import { mailLead1, mailLead2, mailLead3 } from '@/lib/mails-lead'
import { tomarLatch } from '@/lib/ratelimit'
import { marcarHeartbeat } from '@/lib/cron-heartbeat'

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

// Los tres toques de quien descargó la guía y todavía no compró. Mismo mecanismo que los
// hitos de compra: ventana amplia + latch, contados desde el alta en la lista.
const HITOS_LEAD = [
  { id: 'lead1', desde: 2, hasta: 5, arma: mailLead1 },
  { id: 'lead2', desde: 6, hasta: 10, arma: mailLead2 },
  { id: 'lead3', desde: 12, hasta: 16, arma: mailLead3 },
]

/**
 * Interruptor de la secuencia de leads. Mientras esté apagado el cron igual la recorre y
 * devuelve a quién le tocaría, pero no manda nada: sirve para ver el volumen real antes
 * de que el primer mail salga a gente que no es cliente todavía.
 */
const LEADS_ACTIVO = process.env.LEADS_NURTURE_ENABLED === '1'

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
  if (!secreto) {
    await marcarHeartbeat('ciclo-cultivo', false, 'sin DASHBOARD_PASSWORD')
    return NextResponse.json({ error: 'sin secreto' }, { status: 503 })
  }

  // Franja horaria humana: un mail a las 4 de la mañana se lee como spam automático.
  const horaAr = (new Date().getUTCHours() + 24 - 3) % 24
  if (horaAr < 9 || horaAr >= 21) {
    return NextResponse.json({ enviados: 0, motivo: 'fuera de horario 9-21 AR' })
  }

  const compras = await comprasParaSeguimiento()
  const enviados: Array<{ pedido: number; hito: string }> = []
  let fallidos = 0

  // En paralelo: antes era un for...of secuencial y con varios hitos pendientes en una
  // misma corrida (típico después de un fin de semana) el total de round-trips de DB +
  // SMTP superaba el maxDuration de 60s (FUNCTION_INVOCATION_TIMEOUT recurrente desde el
  // 31/07). El pool de Postgres sigue con max:1 así que esas queries se siguen encolando,
  // pero el SMTP (el costo dominante, un handshake TLS por mail) ahora corre concurrente.
  const resultadosCompras = await Promise.allSettled(
    compras.map(async (c) => {
      const hito = hitoDe(c)
      if (!hito) return null
      if (!(await tomarLatch(`ciclo:${c.numero}:${hito.id}`))) return null

      const token = await crearTokenEntrada(
        { num: c.numero, nom: c.nombre, eq: c.equipos },
        secreto,
      )
      const ok = await enviarMail(
        c.email,
        // Siempre INC101 (hardware), nunca material digital: soloDigital = false.
        hito.arma(c.nombre, `${BASE_URL}/e/${token}`, false),
      )
      return { pedido: c.numero, hito: hito.id, ok }
    }),
  )
  for (const r of resultadosCompras) {
    if (r.status === 'rejected') {
      console.error('[ciclo-cultivo] falló un envío de compra:', r.reason)
      fallidos++
      continue
    }
    if (!r.value) continue
    if (r.value.ok) enviados.push({ pedido: r.value.pedido, hito: r.value.hito })
    else fallidos++
  }

  // ── Secuencia de leads ────────────────────────────────────────────────────────────
  // Va después de las compras y en su propio try: un error acá no puede dejar sin mail a
  // alguien que ya pagó.
  const leads: Array<{ email: string; hito: string; enviado: boolean }> = []
  try {
    const candidatos = (await leadsParaSeguimiento())
      .map((l) => {
        const dias = (Date.now() - l.alta.getTime()) / 86_400_000
        const hito = HITOS_LEAD.find((h) => dias >= h.desde && dias < h.hasta)
        return hito ? { l, hito } : null
      })
      .filter((x): x is { l: LeadSeguimiento; hito: (typeof HITOS_LEAD)[number] } => x !== null)

    const resultadosLeads = await Promise.allSettled(
      candidatos.map(async ({ l, hito }) => {
        // El latch se toma solo cuando la secuencia está activa. Si se tomara en seco, el
        // día que se encienda todos estos leads ya figurarían como avisados y se perderían.
        if (!LEADS_ACTIVO) return { email: l.email, hito: hito.id, enviado: false }
        if (!(await tomarLatch(`lead:${l.email}:${hito.id}`))) return null
        const ok = await enviarMail(l.email, hito.arma())
        return { email: l.email, hito: hito.id, enviado: ok }
      }),
    )
    for (const r of resultadosLeads) {
      if (r.status === 'rejected') {
        console.error('[ciclo-cultivo] falló un envío de lead:', r.reason)
        fallidos++
        continue
      }
      if (!r.value) continue
      leads.push(r.value)
      if (!r.value.enviado && LEADS_ACTIVO) fallidos++
    }
  } catch (e) {
    console.error('[ciclo-cultivo] falló la secuencia de leads:', e)
  }

  await marcarHeartbeat('ciclo-cultivo', true, fallidos ? `${fallidos} fallidos` : undefined)
  return NextResponse.json({
    revisadas: compras.length,
    enviados,
    fallidos,
    leads: { activo: LEADS_ACTIVO, tocados: leads },
  })
}
