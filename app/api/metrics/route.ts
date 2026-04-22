import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
  const storeId = req.nextUrl.searchParams.get('storeId') ?? undefined

  const whereStore = storeId ? { store_id: storeId } : {}

  // Clientes y gasto de marketing por store
  const stores = await prisma.store.findMany({
    where: storeId ? { id: storeId } : {},
    select: { id: true, nombre: true, marketing_spend: true },
  })

  const totalMarketingSpend = stores.reduce((s, st) => s + st.marketing_spend, 0)

  // Nuevos clientes (últimos 30 días)
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const newCustomers = await prisma.customer.count({
    where: { ...whereStore, createdAt: { gte: since30d } },
  })

  // LTV: suma total de total_spent por cliente
  const ltvResult = await prisma.customer.aggregate({
    where: whereStore,
    _sum: { total_spent: true },
    _count: { id: true },
  })
  const totalRevenue = ltvResult._sum.total_spent ?? 0
  const totalCustomers = ltvResult._count.id

  // CAC
  const cac = newCustomers > 0 ? totalMarketingSpend / newCustomers : 0
  const ltv = totalCustomers > 0 ? totalRevenue / totalCustomers : 0

  // ROI WhatsApp: mensajes enviados y ventas recuperadas (orders/paid post-recovery)
  const messagesSent = await prisma.messageLog.count({
    where: { ...whereStore, estado: 'SENT' },
  })
  const messagesFailed = await prisma.messageLog.count({
    where: { ...whereStore, estado: 'FAILED' },
  })
  const recoveryRevenue = await prisma.messageLog.findMany({
    where: { ...whereStore, tipo_evento: 'order/paid', estado: 'SENT' },
    include: { customer: { select: { total_spent: true } } },
  })
  const totalRecoveryRevenue = recoveryRevenue.reduce(
    (s, l) => s + (l.customer.total_spent ?? 0), 0
  )
  const whatsappRoi = messagesSent > 0
    ? ((totalRecoveryRevenue - totalMarketingSpend) / (totalMarketingSpend || 1)) * 100
    : 0

  // Ventas por día (últimos 30 días) para el gráfico
  const recentCustomers = await prisma.customer.findMany({
    where: { ...whereStore, createdAt: { gte: since30d } },
    select: { createdAt: true, total_spent: true },
    orderBy: { createdAt: 'asc' },
  })
  const salesByDay = recentCustomers.reduce<Record<string, number>>((acc, c) => {
    const day = c.createdAt.toISOString().slice(0, 10)
    acc[day] = (acc[day] ?? 0) + c.total_spent
    return acc
  }, {})

  return NextResponse.json({
    stores,
    metrics: { cac, ltv, totalRevenue, totalCustomers, newCustomers, whatsappRoi },
    messages: { sent: messagesSent, failed: messagesFailed },
    salesByDay: Object.entries(salesByDay).map(([date, revenue]) => ({ date, revenue })),
  })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
