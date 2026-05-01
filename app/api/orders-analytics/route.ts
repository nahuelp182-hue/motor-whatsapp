import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const TN_STORE  = process.env.TN_STORE_ID  ?? '1957278'
const TN_TOKEN  = process.env.TN_ACCESS_TOKEN ?? ''
const TN_BASE   = 'https://api.tiendanube.com/v1'
const UA        = 'Micelium/1.0 (nahuelp182@gmail.com)'

interface TNProduct { name: string | { es?: string }; quantity: number; price: string }
interface TNOrder {
  id: number; number: number; total: string; created_at: string
  gateway: string
  payment_details?: { method?: string; installments?: number; credit_card_company?: string }
  products: TNProduct[]
}

async function fetchOrders(since: string, until: string): Promise<TNOrder[]> {
  const all: TNOrder[] = []
  let page = 1
  while (true) {
    const url = `${TN_BASE}/${TN_STORE}/orders?payment_status=paid` +
      `&created_at_min=${since}T00:00:00-03:00` +
      `&created_at_max=${until}T23:59:59-03:00` +
      `&per_page=50&page=${page}`
    const res  = await fetch(url, { headers: { Authentication: `bearer ${TN_TOKEN}`, 'User-Agent': UA } })
    const data = await res.json() as TNOrder[]
    if (!Array.isArray(data) || data.length === 0) break
    all.push(...data)
    if (data.length < 50) break
    page++
    await new Promise(r => setTimeout(r, 200))
  }
  return all
}

function productName(p: TNProduct): string {
  if (typeof p.name === 'string') return p.name
  return p.name?.es ?? 'Producto'
}

function classifyPayment(o: TNOrder): string {
  const gw   = o.gateway ?? ''
  const met  = o.payment_details?.method ?? ''
  const inst = o.payment_details?.installments ?? 1
  if (gw === 'offline' || met === 'custom') return 'Transferencia bancaria'
  if (gw === 'mercado-pago') {
    if (met === 'wallet')      return 'MP Billetera'
    if (met === 'debit_card')  return 'MP Débito'
    if (met === 'credit_card') return inst > 1 ? `MP Crédito ${inst} cuotas` : 'MP Crédito 1 cuota'
    return 'MercadoPago'
  }
  return gw || 'Otro'
}

// Colores por método
const PAYMENT_COLORS: Record<string, string> = {
  'Transferencia bancaria': '#34d399',
  'MP Billetera':           '#f97316',
  'MP Débito':              '#818cf8',
  'MP Crédito 1 cuota':     '#facc15',
  'MP Crédito 3 cuotas':    '#fb923c',
  'MP Crédito 6 cuotas':    '#f43f5e',
  'MP Crédito 12 cuotas':   '#e879f9',
  'MercadoPago':            '#60a5fa',
  'Otro':                   '#6b7280',
}
function payColor(label: string): string {
  return PAYMENT_COLORS[label] ?? '#6b7280'
}

export async function GET(req: NextRequest) {
  try {
    const p     = req.nextUrl.searchParams
    const since = p.get('since') ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10)
    const until = p.get('until') ?? new Date().toISOString().slice(0,10)
    const filterProduct = p.get('product') // null = todos

    const orders = await fetchOrders(since, until)

    // ── Productos ─────────────────────────────────────────────────
    const productMap: Record<string, { units: number; revenue: number; orders: number }> = {}
    for (const o of orders) {
      for (const prod of o.products ?? []) {
        const name    = productName(prod)
        const revenue = parseFloat(prod.price) * (prod.quantity ?? 1)
        if (!productMap[name]) productMap[name] = { units: 0, revenue: 0, orders: 0 }
        productMap[name].units   += prod.quantity ?? 1
        productMap[name].revenue += revenue
        productMap[name].orders  += 1
      }
    }

    const totalRevenue = Object.values(productMap).reduce((s, v) => s + v.revenue, 0)
    const products = Object.entries(productMap)
      .map(([name, v]) => ({
        name,
        units:   v.units,
        revenue: v.revenue,
        orders:  v.orders,
        pct:     totalRevenue > 0 ? Math.round((v.revenue / totalRevenue) * 100) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    // ── Filtrar órdenes por producto seleccionado ─────────────────
    const filteredOrders = filterProduct
      ? orders.filter(o => o.products?.some(p => productName(p) === filterProduct))
      : orders

    // ── Pagos ─────────────────────────────────────────────────────
    const payMap: Record<string, { count: number; revenue: number }> = {}
    for (const o of filteredOrders) {
      const label   = classifyPayment(o)
      const revenue = parseFloat(o.total ?? '0')
      if (!payMap[label]) payMap[label] = { count: 0, revenue: 0 }
      payMap[label].count   += 1
      payMap[label].revenue += revenue
    }

    const filteredRevenue = Object.values(payMap).reduce((s, v) => s + v.revenue, 0)
    const payments = Object.entries(payMap)
      .map(([label, v]) => ({
        label,
        count:   v.count,
        revenue: v.revenue,
        pct:     filteredRevenue > 0 ? Math.round((v.revenue / filteredRevenue) * 100) : 0,
        color:   payColor(label),
      }))
      .sort((a, b) => b.revenue - a.revenue)

    // ── Timeline por producto ─────────────────────────────────────
    const timelineMap: Record<string, number> = {}
    for (const o of filteredOrders) {
      const day = o.created_at.slice(0, 10)
      timelineMap[day] = (timelineMap[day] ?? 0) + parseFloat(o.total ?? '0')
    }
    const timeline = Object.entries(timelineMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date, revenue }))

    // ── Summary filtrado ──────────────────────────────────────────
    const summary = {
      totalOrders:   filteredOrders.length,
      totalRevenue:  filteredRevenue,
      avgOrderValue: filteredOrders.length > 0 ? filteredRevenue / filteredOrders.length : 0,
    }

    return NextResponse.json({ since, until, products, payments, timeline, summary })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
