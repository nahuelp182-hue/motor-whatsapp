// Envío público de reseña desde el widget del sitio. NO se publica sola: nace con
// approved=false y espera la aprobación en la sección Reseñas del panel. Así el formulario
// abierto no puede meter relleno ni spam en la vitrina de confianza.
//
// Llega como multipart/form-data porque puede traer una foto adjunta (ya redimensionada en
// el navegador). La foto se sube a Vercel Blob desde el servidor y se guarda su URL.
import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { consumirLimite, ipDe, limpiarVencidos, respuesta429 } from '@/lib/ratelimit'
import { productosTN } from '@/lib/widgets/productos'

export const runtime = 'nodejs'

const TN_STORE_ID = process.env.TN_STORE_ID ?? '1957278'
const FOTO_TIPOS = ['image/jpeg', 'image/webp', 'image/png']
const FOTO_TOPE = 4 * 1024 * 1024 // el navegador ya la achica a ~1200px; esto es el techo duro

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

    const form = await req.formData().catch(() => null)
    if (!form) return NextResponse.json({ ok: false, error: 'formato' }, { status: 400, headers: CORS })

    // Honeypot: campo oculto que un humano nunca completa y un bot sí.
    if (String(form.get('website') ?? '').trim() !== '') {
      return NextResponse.json({ ok: true }, { headers: CORS }) // silencioso a propósito
    }

    const autor = String(form.get('autor') ?? '').trim().slice(0, 80)
    const texto = String(form.get('texto') ?? '').trim().slice(0, 1000)
    const rating = Math.round(Number(form.get('rating')))
    const productId = String(form.get('product_id') ?? '').replace(/\D/g, '').slice(0, 12) || null

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

    // Nombre del producto (para verlo en el panel sin resolverlo cada vez).
    let productNombre: string | null = null
    if (productId) {
      try {
        const cat = await productosTN()
        productNombre = cat.find(p => p.id === productId)?.nombre ?? null
      } catch { /* si el catálogo falla, la reseña igual se guarda con el id */ }
    }

    // Foto opcional: solo imagen, con techo de tamaño. Se sube a Blob y guardamos la URL.
    let fotoUrl: string | null = null
    const foto = form.get('foto')
    if (foto && typeof foto === 'object' && 'arrayBuffer' in foto) {
      const f = foto as File
      if (FOTO_TIPOS.includes(f.type) && f.size > 0 && f.size <= FOTO_TOPE) {
        try {
          const blob = await put(`resenas/${Date.now()}.jpg`, f, {
            access: 'public',
            addRandomSuffix: true,
            contentType: f.type,
          })
          fotoUrl = blob.url
        } catch { /* si la subida falla, la reseña se guarda igual sin foto */ }
      }
    }

    await prisma.review.create({
      data: {
        store_id: store.id,
        autor,
        texto,
        rating,
        source: 'form',
        approved: false,
        product_id: productId,
        product_nombre: productNombre,
        foto_url: fotoUrl,
      },
    })

    return NextResponse.json({ ok: true }, { headers: CORS })
  } catch {
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500, headers: CORS })
  }
}
