import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// "¿Cómo nos conociste?" post-compra. El widget (public/cnc.js) corre en la
// página de gracias del storefront y postea acá; guardamos la respuesta como
// owner_note (nota privada del vendedor) en la orden de Tiendanube.
const TN_STORE = process.env.TN_STORE_ID ?? '1957278'
const TN_TOKEN = process.env.TN_ACCESS_TOKEN ?? ''
const TN_BASE  = 'https://api.tiendanube.com/v1'
const UA       = 'Micelium/1.0 (nahuelp182@gmail.com)'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const SOURCES: Record<string, string> = {
  instagram:     'Instagram',
  facebook:      'Facebook',
  google:        'Google / Búsqueda',
  recomendacion: 'Recomendación',
  mercadolibre:  'MercadoLibre',
  youtube:       'YouTube',
  otro:          'Otro',
}

const NOTE_PREFIX = '[Cómo nos conoció:'

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  let order_id: unknown, source: unknown
  try {
    const body = await req.json()
    order_id = body.order_id
    source = body.source
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400, headers: CORS })
  }

  const oid = String(order_id ?? '').replace(/[^0-9]/g, '')
  const label = SOURCES[String(source ?? '').toLowerCase()]
  if (!oid || !label) {
    return NextResponse.json({ error: 'invalid params' }, { status: 400, headers: CORS })
  }
  if (!TN_TOKEN) {
    return NextResponse.json({ error: 'TN not configured' }, { status: 500, headers: CORS })
  }

  const headers = {
    Authentication: `bearer ${TN_TOKEN}`,
    'User-Agent': UA,
    'Content-Type': 'application/json',
  }
  const tag = `${NOTE_PREFIX} ${label}]`

  try {
    // leer nota actual: no pisar nada y evitar duplicar si reenvían
    const getRes = await fetch(`${TN_BASE}/${TN_STORE}/orders/${oid}`, { headers })
    if (!getRes.ok) {
      return NextResponse.json({ ok: false, error: `order ${getRes.status}` }, { headers: CORS })
    }
    const order = (await getRes.json()) as { owner_note?: string | null }
    const prev = (order.owner_note ?? '').trim()
    if (prev.includes(NOTE_PREFIX)) {
      return NextResponse.json({ ok: true, already: true }, { headers: CORS })
    }
    const note = prev ? `${prev}\n${tag}` : tag

    const putRes = await fetch(`${TN_BASE}/${TN_STORE}/orders/${oid}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ owner_note: note }),
    })
    if (!putRes.ok) {
      return NextResponse.json({ ok: false, error: `put ${putRes.status}` }, { headers: CORS })
    }
    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch {
    return NextResponse.json({ ok: false, error: 'exception' }, { headers: CORS })
  }
}
