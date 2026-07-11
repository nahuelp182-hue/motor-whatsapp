import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// IDs de plantillas de Meta a monitorear (ver [[project_carrito_abandonado_wsp]])
const TEMPLATES = [
  { key: 'cart_recovery', name: 'recuperacion_carrito', id: '1434809655337052' },
  { key: 'review_request', name: 'resena_post_entrega', id: '1744047919975524' },
] as const

const EVENTOS = ['cart_recovery_1', 'cart_recovery_2', 'review_request'] as const

async function fetchTemplateStatus(id: string, token: string) {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${id}?fields=status,name,category`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return { status: 'DESCONOCIDO' }
    const j = (await res.json()) as { status?: string; category?: string }
    return { status: j.status ?? 'DESCONOCIDO', category: j.category }
  } catch {
    return { status: 'DESCONOCIDO' }
  }
}

export async function GET(req: NextRequest) {
  const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days') ?? 30), 1), 90)
  const since = new Date(Date.now() - days * 86_400_000)

  const store = await prisma.store.findFirst({ where: { is_active: true } })
  if (!store) return NextResponse.json({ error: 'Sin store activa' }, { status: 404 })

  const [logs, campaigns] = await Promise.all([
    prisma.messageLog.findMany({
      where: { store_id: store.id, tipo_evento: { in: [...EVENTOS] }, createdAt: { gte: since } },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.campaign.findMany({ where: { store_id: store.id } }),
  ])

  const porEvento = Object.fromEntries(
    EVENTOS.map((ev) => {
      const deEvento = logs.filter((l) => l.tipo_evento === ev)
      return [
        ev,
        {
          enviados: deEvento.filter((l) => l.estado === 'SENT').length,
          fallidos: deEvento.filter((l) => l.estado === 'FAILED').length,
          pendientes: deEvento.filter((l) => l.estado === 'PENDING').length,
        },
      ]
    })
  )

  const templates = await Promise.all(
    TEMPLATES.map(async (t) => ({ ...t, ...(await fetchTemplateStatus(t.id, store.whatsapp_api_token)) }))
  )

  const recientes = logs.slice(0, 30).map((l) => ({
    ts: l.createdAt,
    tipo_evento: l.tipo_evento,
    estado: l.estado,
    cliente: l.customer.nombre,
    telefono: l.customer.telefono,
    error: l.estado === 'FAILED' ? l.error_details : null,
  }))

  const campanas = campaigns.map((c) => ({ tipo: c.tipo, is_active: c.is_active }))

  return NextResponse.json({ days, porEvento, templates, campanas, recientes })
}
