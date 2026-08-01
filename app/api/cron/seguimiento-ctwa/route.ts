import { NextRequest, NextResponse } from 'next/server'
import { chequearCron } from '@/lib/cron-auth'
import { marcarHeartbeat } from '@/lib/cron-heartbeat'
import { diag } from '@/lib/diag'
import { candidatos, MENSAJES } from '@/lib/seguimiento-ctwa'

// Seguimiento gratis dentro de la ventana de 72 h de los anuncios click-to-WhatsApp.
// Disparado por cron del VPS cada ~2 h — es trabajo de negocio, no vigilancia:
// curl -H "Authorization: Bearer $CRON_SECRET" https://mw-micelium.vercel.app/api/cron/seguimiento-ctwa
//
// INERTE HASTA QUE HAYA CAMPAÑA. Solo mira conversaciones con `ctwa_origen`, y hoy no hay
// ninguna: no existe todavía una campaña CTWA. Se puede instalar y programar sin que le
// escriba a nadie. Cuando la campaña arranque, empieza a trabajar solo.
//
// Ver lib/seguimiento-ctwa.ts para por qué estas horas y a quién NO se le escribe.

export const runtime = 'nodejs'

const WA_TOKEN = process.env.WHATSAPP_TOKEN ?? ''
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? ''

const TN_STORE = process.env.TN_STORE_ID ?? '1957278'
const TN_TOKEN = process.env.TN_ACCESS_TOKEN ?? ''

/**
 * ¿Este teléfono compró en los últimos días?
 *
 * Va contra Tiendanube y no contra ig_diag porque en ig_diag no hay ninguna marca de
 * compra: la primera versión de la query filtraba por un kind `compra_confirmada` que no
 * existe, así que no excluía a nadie. Mandarle "¿te quedó alguna duda?" a alguien que
 * acaba de pagar $288.000 es exactamente el mensaje que no hay que mandar.
 *
 * Ante un error de red devuelve `true` (= no mandar). El costo de saltear un seguimiento
 * es cero; el de escribirle a un comprador, no.
 */
async function yaCompro(telefono: string): Promise<boolean> {
  if (!TN_TOKEN) return true
  const ultimos8 = telefono.replace(/\D/g, '').slice(-8)
  if (ultimos8.length < 8) return true
  try {
    const desde = new Date(Date.now() - 10 * 86400_000).toISOString().slice(0, 10)
    const res = await fetch(
      `https://api.tiendanube.com/v1/${TN_STORE}/orders?created_at_min=${desde}T00:00:00-03:00` +
      `&per_page=50&fields=id,contact_phone,customer,payment_status`,
      { headers: { Authentication: `bearer ${TN_TOKEN}`, 'User-Agent': 'Micelium/1.0 (nahuelp182@gmail.com)' } },
    )
    if (!res.ok) return true
    const ordenes = (await res.json()) as Array<{
      contact_phone?: string; payment_status?: string; customer?: { phone?: string }
    }>
    if (!Array.isArray(ordenes)) return true
    return ordenes.some((o) => {
      if (o.payment_status !== 'paid') return false
      const tels = [o.contact_phone, o.customer?.phone].filter(Boolean) as string[]
      return tels.some((t) => t.replace(/\D/g, '').slice(-8) === ultimos8)
    })
  } catch {
    return true
  }
}

async function enviar(to: string, texto: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: texto },
      }),
    })
    if (!res.ok) {
      const e = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      return { ok: false, error: e?.error?.message ?? `HTTP ${res.status}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

export async function GET(req: NextRequest) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth

  try {
    if (!WA_TOKEN || !WA_PHONE_ID) {
      // Falta la credencial (pasa en preview: WHATSAPP_TOKEN está solo en Production).
      // No es un error del cron y no tiene que marcar el heartbeat en rojo.
      await marcarHeartbeat('seguimiento-ctwa', true)
      return NextResponse.json({ enviados: 0, motivo: 'sin credenciales de WhatsApp' })
    }

    const lista = await candidatos()
    const resultados = []
    for (const c of lista) {
      if (await yaCompro(c.sender)) {
        // Se registra igual, para que el próximo pase no lo vuelva a evaluar y para que
        // quede en el historial por qué no se le escribió.
        await diag('ctwa_seguimiento', c.sender, {
          etapa: c.etapa, horas: Math.round(c.horas), source_id: c.sourceId,
          ok: false, omitido: 'ya compró',
        }, 'wa')
        resultados.push({ sender: c.sender, etapa: c.etapa, ok: false, omitido: 'ya compró' })
        continue
      }
      const r = await enviar(c.sender, MENSAJES[c.etapa])
      // Se registra SIEMPRE, salga o no. Si solo se registrara el éxito, un fallo
      // transitorio de la Cloud API haría que el próximo pase lo tome de nuevo y el
      // cliente terminara recibiendo el mismo mensaje varias veces.
      await diag('ctwa_seguimiento', c.sender, {
        etapa: c.etapa,
        horas: Math.round(c.horas),
        source_id: c.sourceId,
        ok: r.ok,
        error: r.error ?? null,
      }, 'wa')
      resultados.push({ sender: c.sender, etapa: c.etapa, ok: r.ok, error: r.error })
    }

    await marcarHeartbeat('seguimiento-ctwa', true)
    return NextResponse.json({ enviados: resultados.filter((r) => r.ok).length, resultados })
  } catch (e) {
    await marcarHeartbeat('seguimiento-ctwa', false, String(e).slice(0, 300))
    throw e
  }
}
