import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { chequearCron } from '@/lib/cron-auth'
import { marcarHeartbeat } from '@/lib/cron-heartbeat'

// Disparado por cron externo (VPS, 1-2x/día) — mismo patrón que resena-post-entrega.
// curl -H "Authorization: Bearer $CRON_SECRET" https://mw-micelium.vercel.app/api/cron/resenas-google
//
// Trae las reseñas de la ficha de Google Business Profile (Business Profile API) e
// inserta las nuevas en `Review` con source='google', approved=true (ya son públicas y
// moderadas por Google, a diferencia de las del formulario del sitio). `external_id` es
// el reviewId de Google: @@unique([source, external_id]) evita duplicar en cada corrida.
//
// El refresh token vive en GOOGLE_REVIEWS_REFRESH_TOKEN (scope business.manage), separado
// de GOOGLE_REFRESH_TOKEN (Ads/GA4) porque son scopes distintos sobre el mismo client OAuth.

const TN_STORE_ID = process.env.TN_STORE_ID ?? '1957278'

const STARS: Record<string, number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
}

type GoogleReview = {
  reviewId: string
  reviewer?: { displayName?: string }
  starRating?: keyof typeof STARS
  comment?: string
  createTime: string
}

async function accessToken(): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_REVIEWS_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) return null

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { access_token?: string }
  return data.access_token ?? null
}

// Cuando el reviewer escribió en otro idioma, Google antepone la traducción automática y
// deja el texto real bajo "(Original)". Publicar la traducción (o las dos etiquetas
// pegadas) rompe la confianza que el widget viene a construir, así que se queda solo con
// el original; si no hay marcador, el comentario ya estaba en español y se usa tal cual.
function textoOriginal(comment: string): string {
  const marca = comment.lastIndexOf('(Original)')
  if (marca === -1) return comment.trim()
  return comment.slice(marca + '(Original)'.length).trim()
}

async function traerResenas(token: string): Promise<GoogleReview[]> {
  const accountId = process.env.GOOGLE_REVIEWS_ACCOUNT_ID
  const locationId = process.env.GOOGLE_REVIEWS_LOCATION_ID
  if (!accountId || !locationId) return []

  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error(`Google reviews ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as { reviews?: GoogleReview[] }
  return data.reviews ?? []
}

export async function GET(req: NextRequest) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth

  try {
    const store = await prisma.store.findFirst({ where: { tiendanube_store_id: TN_STORE_ID } })
    if (!store) throw new Error('tienda no encontrada')

    const token = await accessToken()
    if (!token) throw new Error('sin credenciales de Google (revisar GOOGLE_REVIEWS_REFRESH_TOKEN)')

    const reviews = await traerResenas(token)

    const antes = await prisma.review.count({ where: { store_id: store.id, source: 'google' } })

    for (const r of reviews) {
      const texto = textoOriginal(r.comment ?? '')
      if (!texto) continue // Google permite reseña solo con estrellas, sin texto: no sirve para el widget.

      await prisma.review.upsert({
        where: { source_external_id: { source: 'google', external_id: r.reviewId } },
        // Solo se refresca el texto: approved/rating pueden haberse tocado a mano en el
        // panel, y una corrida del cron no tiene que pisar esa decisión.
        update: { texto },
        create: {
          store_id: store.id,
          source: 'google',
          external_id: r.reviewId,
          autor: r.reviewer?.displayName ?? 'Cliente de Google',
          texto,
          rating: r.starRating ? STARS[r.starRating] : null,
          approved: false,
          fecha: new Date(r.createTime),
        },
      })
    }

    const despues = await prisma.review.count({ where: { store_id: store.id, source: 'google' } })

    await marcarHeartbeat('resenas-google', true)
    return NextResponse.json({ ok: true, traidas: reviews.length, nuevas: despues - antes })
  } catch (e) {
    await marcarHeartbeat('resenas-google', false, String(e).slice(0, 300))
    throw e
  }
}
