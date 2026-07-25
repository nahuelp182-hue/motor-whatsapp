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

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** Resumen de TODAS las reseñas de la tienda, no solo de las que se están viendo. Es lo que
    permite leer el panel de un vistazo: cuántas hay publicadas, con qué puntaje promedio, de
    dónde vienen y si el flujo viene creciendo o se secó. El filtro de la lista no lo toca. */
type FilaResumen = {
  rating: number | null
  source: string
  approved: boolean
  foto_url: string | null
  fecha: Date | null
  createdAt: Date
}

function armarResumen(filas: FilaResumen[]) {
  const cuando = (f: FilaResumen) => f.fecha ?? f.createdAt
  const conPuntaje = filas.filter(f => typeof f.rating === 'number')
  const suma = conPuntaje.reduce((a, f) => a + (f.rating ?? 0), 0)

  const distribucion = [5, 4, 3, 2, 1].map(estrellas => ({
    estrellas,
    n: conPuntaje.filter(f => f.rating === estrellas).length,
  }))

  const fuentes = ['whatsapp', 'google', 'form'].map(source => ({
    source,
    n: filas.filter(f => f.source === source).length,
  }))

  // Últimos 6 meses, incluido el actual aunque esté vacío: un mes en cero es información.
  const hoy = new Date()
  const meses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - (5 - i), 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const delMes = filas.filter(f => {
      const c = cuando(f)
      return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth()
    })
    const p = delMes.filter(f => typeof f.rating === 'number')
    return {
      key,
      label: MES_CORTO[d.getMonth()],
      n: delMes.length,
      promedio: p.length ? Number((p.reduce((a, f) => a + (f.rating ?? 0), 0) / p.length).toFixed(2)) : null,
    }
  })

  const hace30 = new Date(Date.now() - 30 * 864e5)
  const hace60 = new Date(Date.now() - 60 * 864e5)

  return {
    total: filas.length,
    aprobadas: filas.filter(f => f.approved).length,
    pendientes: filas.filter(f => !f.approved).length,
    sinPuntaje: filas.length - conPuntaje.length,
    // Un puntaje bajo publicado es lo primero que hay que ver al entrar.
    negativas: filas.filter(f => typeof f.rating === 'number' && (f.rating ?? 5) <= 3).length,
    conFoto: filas.filter(f => !!f.foto_url).length,
    promedio: conPuntaje.length ? Number((suma / conPuntaje.length).toFixed(2)) : null,
    distribucion,
    fuentes,
    meses,
    ultimos30: filas.filter(f => cuando(f) >= hace30).length,
    previos30: filas.filter(f => cuando(f) >= hace60 && cuando(f) < hace30).length,
  }
}

/** Lista reseñas. ?estado=pendientes | aprobadas | todas (default: pendientes primero). */
export async function GET(req: NextRequest) {
  const sid = await storeId()
  if (!sid) return NextResponse.json({ resenas: [], pendientes: 0, resumen: null })

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

  // Para el resumen se leen todas (campos mínimos): las cuentas tienen que hablar del total
  // de la tienda, no de la pestaña abierta.
  const todas = await prisma.review.findMany({
    where: { store_id: sid },
    select: { rating: true, source: true, approved: true, foto_url: true, fecha: true, createdAt: true },
  })

  const resenas = filas.map(r => ({
    id: r.id,
    autor: r.customer?.nombre ?? r.autor ?? 'Cliente',
    texto: r.texto,
    rating: r.rating,
    source: r.source,
    approved: r.approved,
    producto: r.product_nombre ?? (r.product_id ? `#${r.product_id}` : null),
    foto: r.foto_url,
    fecha: (r.fecha ?? r.createdAt).toISOString().slice(0, 10),
  }))

  return NextResponse.json({ resenas, pendientes, resumen: armarResumen(todas) })
}

/** Aprueba/oculta una reseña y/o le fija el puntaje (útil para las de WhatsApp, que llegan
    sin estrellas). Cada campo es opcional: se toca solo lo que venga en el cuerpo. */
export async function PATCH(req: NextRequest) {
  const sid = await storeId()
  if (!sid) return NextResponse.json({ error: 'tienda no encontrada' }, { status: 400 })

  const b = (await req.json().catch(() => ({}))) as { id?: string; approved?: boolean; rating?: number | null }
  const id = String(b.id ?? '')
  // El where lleva store_id: sin eso, un id de otra tienda se podría moderar desde acá.
  const actual = await prisma.review.findFirst({ where: { id, store_id: sid } })
  if (!actual) return NextResponse.json({ error: 'no existe' }, { status: 404 })

  const data: { approved?: boolean; rating?: number | null } = {}
  if (b.approved !== undefined) data.approved = b.approved === true
  if (b.rating !== undefined) {
    const n = Math.round(Number(b.rating))
    data.rating = Number.isFinite(n) && n >= 1 && n <= 5 ? n : null
  }

  const review = await prisma.review.update({ where: { id }, data })
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
