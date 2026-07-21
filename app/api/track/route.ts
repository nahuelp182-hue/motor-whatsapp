import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { consumirLimite, limpiarVencidos, respuesta429 } from '@/lib/ratelimit'

// TN store ID fijo — único tenant por ahora (igual que /api/gclid)
const TN_STORE_ID = process.env.TN_STORE_ID ?? '1957278'

// El beacon llega de otro origen (storefront TN) → CORS abierto para POST simple.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

type Payload = {
  vid?: string
  event?: 'session' | 'purchase'
  channel?: string // meta_ads | google_ads | seo | directo | otro_utm
  source?: string
  campaign?: string
  landing?: string
  duration_ms?: number
  max_scroll?: number
  pageviews?: number
  viewed_product?: boolean
  engaged?: boolean
  email?: string
  order_number?: number
}

const VALID_CHANNELS = ['meta_ads', 'google_ads', 'seo', 'directo', 'otro_utm']

export async function POST(req: NextRequest) {
  // sendBeacon manda text/plain (request simple, sin preflight) → parseamos a mano.
  let b: Payload
  try {
    b = JSON.parse(await req.text())
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400, headers: CORS })
  }

  const vid = typeof b.vid === 'string' ? b.vid.slice(0, 64) : ''
  if (!vid || vid.length < 8) {
    return NextResponse.json({ error: 'invalid vid' }, { status: 400, headers: CORS })
  }
  const channel = VALID_CHANNELS.includes(b.channel ?? '') ? b.channel! : 'directo'

  // Tope por visitante: sin esto se puede inflar la tabla `Visit` sin límite (el tier de
  // Supabase son 500 MB) y ensuciar todas las métricas del dashboard.
  const limite = await consumirLimite(`track:${vid}`, 120, 60 * 60)
  if (!limite.permitido) return respuesta429(limite, CORS)
  void limpiarVencidos()

  const store = await prisma.store.findFirst({
    where: { tiendanube_store_id: TN_STORE_ID, is_active: true },
  })
  if (!store) return NextResponse.json({ ok: false }, { headers: CORS })

  // Upsert del visitante. El first-touch se sella SOLO al crear; en updates
  // jamás se toca (por eso el bloque `update` no incluye ningún ft_*).
  const visitor = await prisma.visitor.upsert({
    where: { store_id_vid: { store_id: store.id, vid } },
    create: {
      store_id: store.id,
      vid,
      ft_channel: channel,
      ft_source: b.source?.slice(0, 120) ?? null,
      ft_campaign: b.campaign?.slice(0, 120) ?? null,
      ft_landing: b.landing?.slice(0, 500) ?? null,
    },
    update: { last_seen: new Date() },
  })

  if (b.event === 'purchase') {
    // El navegador NO es fuente de verdad: `email` y `order_number` llegan del cliente y sin
    // verificar permitían marcar visitantes como compradores y escribir mails arbitrarios,
    // envenenando la atribución con la que se decide el presupuesto de Meta. Se confirma
    // contra Tiendanube antes de escribir.
    const orden = await confirmarOrden(b.order_number, b.email)
    if (!orden) {
      return NextResponse.json({ ok: false, error: 'orden no verificada' }, { status: 202, headers: CORS })
    }
    // Cosido anónimo → comprador. No pisamos una compra ya registrada.
    if (!visitor.order_number) {
      await prisma.visitor.update({
        where: { id: visitor.id },
        data: {
          email: orden.email ?? visitor.email,
          order_number: orden.numero,
          purchased_at: new Date(),
        },
      })
    }
    await prisma.visit.create({
      data: {
        visitor_id: visitor.id,
        channel,
        landing: b.landing?.slice(0, 500) ?? null,
        duration_ms: clampInt(b.duration_ms, 0, 6 * 60 * 60 * 1000),
        max_scroll: clampInt(b.max_scroll, 0, 100),
        pageviews: clampInt(b.pageviews, 1, 500),
        viewed_product: true,
        engaged: true,
      },
    })
    return NextResponse.json({ ok: true, purchase: true }, { headers: CORS })
  }

  // Evento de sesión normal.
  await prisma.visit.create({
    data: {
      visitor_id: visitor.id,
      channel,
      landing: b.landing?.slice(0, 500) ?? null,
      duration_ms: clampInt(b.duration_ms, 0, 6 * 60 * 60 * 1000),
      max_scroll: clampInt(b.max_scroll, 0, 100),
      pageviews: clampInt(b.pageviews, 1, 500),
      viewed_product: !!b.viewed_product,
      engaged: !!b.engaged,
    },
  })

  return NextResponse.json({ ok: true }, { headers: CORS })
}

/**
 * Confirma contra Tiendanube que la orden existe y que el mail declarado es el suyo.
 * Devuelve los datos ya saneados, o null si no verifica.
 */
async function confirmarOrden(
  numero: unknown,
  email: unknown,
): Promise<{ numero: number; email: string | null } | null> {
  const n = Number(numero)
  if (!Number.isFinite(n) || n <= 0) return null

  const token = process.env.TN_ACCESS_TOKEN
  const store = process.env.TN_STORE_ID ?? TN_STORE_ID
  // Sin credenciales no se puede verificar: se descarta en vez de confiar en el navegador.
  if (!token) return null

  try {
    const r = await fetch(
      `https://api.tiendanube.com/v1/${store}/orders?status=any&per_page=5&q=${encodeURIComponent(String(n))}`,
      {
        headers: {
          Authentication: `bearer ${token}`,
          'User-Agent': 'MiceliumApp (nahuelp182@gmail.com)',
          'Content-Type': 'application/json',
        },
      },
    )
    if (!r.ok) return null
    const ordenes = (await r.json()) as Array<{
      number?: number
      contact_email?: string
      customer?: { email?: string }
    }>
    const o = ordenes.find(x => Number(x.number) === n)
    if (!o) return null

    const mailReal = (o.contact_email ?? o.customer?.email ?? '').toLowerCase() || null
    const mailDeclarado = String(email ?? '').trim().toLowerCase()
    // Si declara un mail y no es el de la orden, es un intento de inyección.
    if (mailDeclarado && mailReal && mailDeclarado !== mailReal) return null

    return { numero: n, email: mailReal }
  } catch {
    return null
  }
}

function clampInt(v: unknown, min: number, max: number): number {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, n))
}
