import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const META_ACCOUNT = 'act_1063192135217249'
const TN_STORE     = process.env.TN_STORE_ID      ?? '1957278'
const TN_TOKEN     = process.env.TN_ACCESS_TOKEN  ?? ''
const TN_UA        = 'Micelium/1.0 (nahuelp182@gmail.com)'

// ── Helpers ───────────────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, '0') }
function monthKey(y: number, m: number) { return `${y}-${pad(m)}` }

function last12Months() {
  const months: { year: number; month: number; key: string; since: string; until: string }[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear(), m = d.getMonth() + 1
    const lastDay = new Date(y, m, 0).getDate()
    months.push({
      year: y, month: m,
      key:   monthKey(y, m),
      since: `${y}-${pad(m)}-01`,
      until: `${y}-${pad(m)}-${pad(lastDay)}`,
    })
  }
  return months
}

// ── Meta: gasto + clicks + reach mensual en un solo call ────────────────────
async function fetchMetaMonthly(since: string, until: string) {
  const token = process.env.META_ADS_TOKEN
  if (!token) return { spend: {} as Record<string,number>, clicks: {} as Record<string,number>, reach: {} as Record<string,number> }
  try {
    const url = `https://graph.facebook.com/v21.0/${META_ACCOUNT}/insights` +
      `?fields=spend,clicks,reach&time_increment=monthly` +
      `&time_range={"since":"${since}","until":"${until}"}` +
      `&limit=24&access_token=${token}`
    const res  = await fetch(url)
    const data = await res.json() as { data?: { date_start: string; spend: string; clicks: string; reach: string }[] }
    const spend: Record<string,number>  = {}
    const clicks: Record<string,number> = {}
    const reach: Record<string,number>  = {}
    for (const d of data.data ?? []) {
      const key = d.date_start.slice(0, 7)
      spend[key]  = (spend[key]  ?? 0) + parseFloat(d.spend  ?? '0')
      clicks[key] = (clicks[key] ?? 0) + parseInt(d.clicks   ?? '0')
      reach[key]  = (reach[key]  ?? 0) + parseInt(d.reach    ?? '0')
    }
    return { spend, clicks, reach }
  } catch {
    return { spend: {} as Record<string,number>, clicks: {} as Record<string,number>, reach: {} as Record<string,number> }
  }
}

// ── TN: órdenes paginadas para un rango ──────────────────────────────────────
async function fetchTNOrders(since: string, until: string) {
  if (!TN_TOKEN) return []
  const all: { total: string; created_at: string; contact_phone?: string; products?: { name: string | {es?:string}; quantity: number; price: string }[] }[] = []
  let page = 1
  while (true) {
    const url = `https://api.tiendanube.com/v1/${TN_STORE}/orders?payment_status=paid` +
      `&created_at_min=${since}T00:00:00-03:00&created_at_max=${until}T23:59:59-03:00` +
      `&per_page=50&page=${page}&fields=id,total,created_at,contact_phone`
    const res  = await fetch(url, { headers: { Authentication: `bearer ${TN_TOKEN}`, 'User-Agent': TN_UA } })
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) break
    all.push(...data)
    if (data.length < 50) break
    page++
    await new Promise(r => setTimeout(r, 150))
  }
  return all
}

// ── Categorías de productos ──────────────────────────────────────────────────
const CAT_RULES: { name: string; re: RegExp }[] = [
  { name: 'Incubadoras', re: /incubadora|inc101/i },
  { name: 'Tabletas',    re: /tableta|pc400/i },
  { name: 'Accesorios',  re: /kit|recipiente/i },
  { name: 'Digitales',   re: /ebook|guía|guia|pdf|gratis/i },
]
function catOf(name: string) {
  for (const r of CAT_RULES) if (r.re.test(name)) return r.name
  return 'Otros'
}

// ── Main ──────────────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest) {
  try {
    const months   = last12Months()
    const earliest = months[0].since
    const latest   = months[months.length - 1].until

    // ── 1. Meta spend + clicks + reach mensual (1 call) ─────────────────────
    const { spend: metaMap, clicks: clicksMap, reach: reachMap } = await fetchMetaMonthly(earliest, latest)

    // ── 2. TN órdenes del período completo ──────────────────────────────────
    const tnOrders = await fetchTNOrders(earliest, latest)

    // Agrupar por mes
    const tnByMonth: Record<string, { revenue: number; orders: number; phones: Set<string> }> = {}
    for (const o of tnOrders) {
      const key = o.created_at.slice(0, 7)
      if (!tnByMonth[key]) tnByMonth[key] = { revenue: 0, orders: 0, phones: new Set() }
      tnByMonth[key].revenue += parseFloat(o.total ?? '0')
      tnByMonth[key].orders  += 1
      if (o.contact_phone) tnByMonth[key].phones.add(o.contact_phone)
    }

    // ── 3. Clientes DB — repeat rate ─────────────────────────────────────────
    // Clientes con fecha de primera compra ANTES del período actual = potencialmente recurrentes
    const now30ago = new Date(); now30ago.setDate(now30ago.getDate() - 30)
    const [totalCustomers, newCustomers30] = await Promise.all([
      prisma.customer.count({}),
      prisma.customer.count({ where: { createdAt: { gte: now30ago } } }),
    ])
    const returningCustomers = totalCustomers - newCustomers30
    const repeatRate = totalCustomers > 0 ? Math.round((returningCustomers / totalCustomers) * 100) : 0

    // ── 4. Repeat rate por mes (TN phones) ──────────────────────────────────
    // Un teléfono que aparece en 2+ meses diferentes = cliente recurrente
    const phoneMonths: Record<string, Set<string>> = {}
    for (const o of tnOrders) {
      if (!o.contact_phone) continue
      if (!phoneMonths[o.contact_phone]) phoneMonths[o.contact_phone] = new Set()
      phoneMonths[o.contact_phone].add(o.created_at.slice(0, 7))
    }
    const repeatPhones = new Set(
      Object.entries(phoneMonths).filter(([, ms]) => ms.size > 1).map(([ph]) => ph)
    )
    const totalUniquePhones = Object.keys(phoneMonths).length
    const repeatRateTN = totalUniquePhones > 0
      ? Math.round((repeatPhones.size / totalUniquePhones) * 100)
      : 0

    // ── 5. Construir serie mensual ─────────────────────────────────────────
    const series = months.map(m => {
      const tn     = tnByMonth[m.key]
      const spend  = metaMap[m.key]  ?? 0
      const clicks = clicksMap[m.key] ?? 0
      const reach  = reachMap[m.key]  ?? 0
      const rev    = tn?.revenue ?? 0
      const orders = tn?.orders  ?? 0
      const net    = rev - spend
      const roas   = spend > 0 ? rev / spend  : 0
      const cac    = orders > 0 ? spend / orders : 0
      return {
        key:    m.key,
        label:  `${m.key.slice(5)} / ${m.key.slice(2, 4)}`,
        month:  m.month,
        year:   m.year,
        revenue: rev,
        spend,
        net,
        orders,
        clicks,
        reach,
        roas:   Math.round(roas * 10) / 10,
        cac:    Math.round(cac),
        avgTicket: orders > 0 ? Math.round(rev / orders) : 0,
      }
    })

    // ── 6. MoM deltas: compara el último mes COMPLETO vs el anterior ────────
    // "Completo" = el más reciente que tenga al menos 1 orden
    const withOrders = series.filter(s => s.orders > 0)
    const cur  = withOrders[withOrders.length - 1] ?? series[series.length - 1]
    const prev = withOrders[withOrders.length - 2] ?? series[series.length - 2]
    function delta(a: number, b: number) {
      if (b === 0) return a > 0 ? 100 : 0
      return Math.round(((a - b) / b) * 100 * 10) / 10
    }
    const mom = {
      revenue:   delta(cur.revenue,   prev.revenue),
      spend:     delta(cur.spend,     prev.spend),
      net:       delta(cur.net,       prev.net),
      orders:    delta(cur.orders,    prev.orders),
      clicks:    delta(cur.clicks,    prev.clicks),
      reach:     delta(cur.reach,     prev.reach),
      roas:      delta(cur.roas,      prev.roas),
      cac:       delta(cur.cac,       prev.cac),
      avgTicket: delta(cur.avgTicket, prev.avgTicket),
      curMonth:  cur.key,
      prevMonth: prev.key,
    }

    return NextResponse.json({
      series,
      mom,
      repeatRate:   repeatRateTN,   // % clientes que compraron en 2+ meses distintos
      repeatCount:  repeatPhones.size,
      totalUnique:  totalUniquePhones,
      totalCustomers,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
