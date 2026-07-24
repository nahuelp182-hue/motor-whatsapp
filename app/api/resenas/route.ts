import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Moderación de reseñas. Privada: NO figura en API_ABIERTAS del middleware, así que exige
// sesión de dashboard. Vive fuera de /api/widgets/resena a propósito: ese prefijo es público
// y el middleware compara con startsWith, así que colgar la moderación ahí la dejaría abierta.

const TN_STORE_ID = process.env.TN_STORE_ID ?? '1957278'

async function storeId(): Promise<string | null> {
  const s = await prisma.store.findFirst({
    where: { tiendanube_store_id: TN_STORE_ID },
    select: { id: true },
  })
  return s?.id ?? null
}

/** Lista reseñas. ?estado=pendientes | aprobadas | todas (default: pendientes primero). */
export async function GET(req: NextRequest) {
  const sid = await storeId()
  if (!sid) return NextResponse.json({ resenas: [], pendientes: 0 })

  const estado = req.nextUrl.searchParams.get('estado') ?? 'todas'
  const where: { store_id: string; approved?: boolean } = { store_id: sid }
  if (estado === 'pendientes') where.approved = false
  if (estado === 'aprobadas') where.approved = true

  const filas = await prisma.review.findMany({
    where,
    orderBy: [{ approved: 'asc' }, { fecha: 'desc' }, { createdAt: 'desc' }],
    take: 300,
    include: { customer: { select: { nombre: true } } },
  })

  const pendientes = await prisma.review.count({ where: { store_id: sid, approved: false } })

  const resenas = filas.map(r => ({
    id: r.id,
    autor: r.customer?.nombre ?? r.autor ?? 'Cliente',
    texto: r.texto,
    rating: r.rating,
    source: r.source,
    approved: r.approved,
    fecha: (r.fecha ?? r.createdAt).toISOString().slice(0, 10),
  }))

  return NextResponse.json({ resenas, pendientes })
}

/** Aprueba o vuelve a ocultar una reseña. */
export async function PATCH(req: NextRequest) {
  const sid = await storeId()
  if (!sid) return NextResponse.json({ error: 'tienda no encontrada' }, { status: 400 })

  const b = (await req.json().catch(() => ({}))) as { id?: string; approved?: boolean }
  const id = String(b.id ?? '')
  // El where lleva store_id: sin eso, un id de otra tienda se podría moderar desde acá.
  const actual = await prisma.review.findFirst({ where: { id, store_id: sid } })
  if (!actual) return NextResponse.json({ error: 'no existe' }, { status: 404 })

  const review = await prisma.review.update({
    where: { id },
    data: { approved: b.approved === true },
  })
  return NextResponse.json({ review })
}

/** Descarta una reseña (spam / ofensiva). */
export async function DELETE(req: NextRequest) {
  const sid = await storeId()
  const id = req.nextUrl.searchParams.get('id') ?? ''
  const actual = await prisma.review.findFirst({ where: { id, store_id: sid ?? '' } })
  if (!actual) return NextResponse.json({ error: 'no existe' }, { status: 404 })

  await prisma.review.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
