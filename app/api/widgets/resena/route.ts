// Envío público de reseña desde el widget del sitio. NO se publica sola: nace con
// approved=false y espera la aprobación en la sección Reseñas del panel. Así el formulario
// abierto no puede meter relleno ni spam en la vitrina de confianza.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { consumirLimite, ipDe, limpiarVencidos, respuesta429 } from '@/lib/ratelimit'

export const runtime = 'nodejs'

const TN_STORE_ID = process.env.TN_STORE_ID ?? '1957278'

// Mismo criterio que /api/lead: solo el storefront y la capa de guías pueden postear acá.
const ORIGENES = [
  'https://infomicelium.com.ar',
  'https://www.infomicelium.com.ar',
  'https://micelium2.mitiendanube.com',
  'https://mw-micelium.vercel.app',
  'https://guias.infomicelium.com.ar',
  'https://guia.infomicelium.com.ar',
]

function cors(req: NextRequest): Record<string, string> {
  const origen = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ORIGENES.includes(origen) ? origen : ORIGENES[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

export function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) })
}

export async function POST(req: NextRequest) {
  const CORS = cors(req)
  try {
    // Tope por IP: una persona no deja veinte reseñas seguidas; un bot sí lo intentaría.
    const porIp = await consumirLimite(`resena:ip:${ipDe(req)}`, 4, 60 * 60)
    if (!porIp.permitido) return respuesta429(porIp, CORS)
    void limpiarVencidos()

    const body = await req.json().catch(() => ({}))

    // Honeypot: campo oculto que un humano nunca completa y un bot sí.
    if (String(body?.website ?? '').trim() !== '') {
      return NextResponse.json({ ok: true }, { headers: CORS }) // silencioso a propósito
    }

    const autor = String(body?.autor ?? '').trim().slice(0, 80)
    const texto = String(body?.texto ?? '').trim().slice(0, 1000)
    const rating = Math.round(Number(body?.rating))

    if (autor.length < 2) {
      return NextResponse.json({ ok: false, error: 'nombre' }, { status: 400, headers: CORS })
    }
    if (texto.length < 10) {
      return NextResponse.json({ ok: false, error: 'texto' }, { status: 400, headers: CORS })
    }
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ ok: false, error: 'rating' }, { status: 400, headers: CORS })
    }

    const store = await prisma.store.findFirst({
      where: { tiendanube_store_id: TN_STORE_ID, is_active: true },
      select: { id: true },
    })
    if (!store) return NextResponse.json({ ok: false, error: 'tienda' }, { status: 400, headers: CORS })

    await prisma.review.create({
      data: { store_id: store.id, autor, texto, rating, source: 'form', approved: false },
    })

    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch {
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500, headers: CORS })
  }
}
