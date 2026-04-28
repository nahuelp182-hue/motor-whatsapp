import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function fetchMetaSpend(year: number, month: number): Promise<number> {
  const token = process.env.META_ADS_TOKEN
  if (!token) return 0
  const actId = 'act_1063192135217249'
  const mm = String(month).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  const since = `${year}-${mm}-01`
  const until = `${year}-${mm}-${lastDay}`
  try {
    const url = `https://graph.facebook.com/v21.0/${actId}/insights?fields=spend&time_range={"since":"${since}","until":"${until}"}&access_token=${token}`
    const res = await fetch(url)
    const data = await res.json() as { data?: { spend: string }[] }
    return parseFloat(data.data?.[0]?.spend ?? '0') * 1 // Meta devuelve ARS directo
  } catch {
    return 0
  }
}

export async function GET(req: NextRequest) {
  try {
    const storeId = req.nextUrl.searchParams.get('storeId') ?? undefined
    const now = new Date()
    const year  = parseInt(req.nextUrl.searchParams.get('year')  ?? String(now.getFullYear()))
    const month = parseInt(req.nextUrl.searchParams.get('month') ?? String(now.getMonth() + 1))

    const startDate = new Date(year, month - 1, 1)
    const endDate   = new Date(year, month, 0, 23, 59, 59)

    const whereStore = storeId ? { store_id: storeId } : {}
    const wherePeriod = { ...whereStore, createdAt: { gte: startDate, lte: endDate } }

    // Stores
    const stores = await prisma.store.findMany({
      where: storeId ? { id: storeId } : {},
      select: { id: true, nombre: true },
    })

    // Gasto Meta Ads real del mes seleccionado
    const metaSpend = await fetchMetaSpend(year, month)

    // Clientes nuevos en el período
    const newCustomers = await prisma.customer.count({ where: wherePeriod })

    // LTV: todos los clientes (lifetime, no filtrado por mes)
    const ltvResult = await prisma.customer.aggregate({
      where: whereStore,
      _sum: { total_spent: true },
      _count: { id: true },
    })
    const totalRevenue = ltvResult._sum.total_spent ?? 0
    const totalCustomers = ltvResult._count.id

    // Revenue del período (clientes adquiridos en ese mes)
    const periodRevenue = await prisma.customer.aggregate({
      where: wherePeriod,
      _sum: { total_spent: true },
    })
    const monthRevenue = periodRevenue._sum.total_spent ?? 0

    // CAC basado en gasto Meta real del mes
    const cac = newCustomers > 0 ? metaSpend / newCustomers : 0
    const ltv = totalCustomers > 0 ? totalRevenue / totalCustomers : 0

    // Mensajes del período
    const messagesSent = await prisma.messageLog.count({
      where: { ...whereStore, estado: 'SENT', createdAt: { gte: startDate, lte: endDate } },
    })
    const messagesFailed = await prisma.messageLog.count({
      where: { ...whereStore, estado: 'FAILED', createdAt: { gte: startDate, lte: endDate } },
    })

    // ROI WhatsApp del período
    const whatsappRoi = metaSpend > 0
      ? ((monthRevenue - metaSpend) / metaSpend) * 100
      : 0

    // Ventas por día del período para el gráfico
    const periodCustomers = await prisma.customer.findMany({
      where: wherePeriod,
      select: { createdAt: true, total_spent: true },
      orderBy: { createdAt: 'asc' },
    })
    const salesByDay = periodCustomers.reduce<Record<string, number>>((acc, c) => {
      const day = c.createdAt.toISOString().slice(0, 10)
      acc[day] = (acc[day] ?? 0) + c.total_spent
      return acc
    }, {})

    return NextResponse.json({
      stores,
      period: { year, month },
      metaSpend,
      metrics: { cac, ltv, totalRevenue: monthRevenue, totalCustomers, newCustomers, whatsappRoi },
      messages: { sent: messagesSent, failed: messagesFailed },
      salesByDay: Object.entries(salesByDay).map(([date, revenue]) => ({ date, revenue })),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
