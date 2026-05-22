import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// TN store ID fijo — único tenant por ahora
const TN_STORE_ID = process.env.TN_STORE_ID ?? '1957278'

export async function POST(req: NextRequest) {
  let gclid: string
  try {
    const body = await req.json()
    gclid = body.gclid
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  if (!gclid || typeof gclid !== 'string' || gclid.length < 10) {
    return NextResponse.json({ error: 'invalid gclid' }, { status: 400 })
  }

  const store = await prisma.store.findFirst({
    where: { tiendanube_store_id: TN_STORE_ID, is_active: true },
  })
  if (!store) return NextResponse.json({ ok: false })

  // 90 días = ventana máxima de conversión Google Ads
  const expires_at = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)

  await prisma.gclidSession.create({
    data: { store_id: store.id, gclid, expires_at },
  })

  return NextResponse.json({ ok: true })
}
