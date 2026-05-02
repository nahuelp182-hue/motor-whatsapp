'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, LineChart, Line,
} from 'recharts'
import { MetricCard } from '@/components/MetricCard'
import { EcommerceCalendar } from '@/components/EcommerceCalendar'
import { PaymentDonut } from '@/components/PaymentDonut'
import { CategoryAccordion } from '@/components/CategoryAccordion'
import { Trend7d } from '@/components/Trend7d'
import { MonthlyRevenueChart, RoasCacChart, AvgTicketChart } from '@/components/MonthlyChart'
import { HelpTip } from '@/components/HelpTip'
import { FunnelViz } from '@/components/FunnelViz'
import { ThemePicker, THEMES, type Theme } from '@/components/ThemePicker'

// ── Types ─────────────────────────────────────────────────────────────────────
type TimelineDay = { date: string; revenue: number; spend: number; clicks: number; net: number }
type Summary = {
  totalRevenue: number; metaSpend: number; netRevenue: number
  newCustomers: number; cac: number; ltv: number
  clicks: number; impressions: number; reach: number; roas: number
}
type Trend7d = { last7Rev: number; prev7Rev: number; last7Orders: number; prev7Orders: number; delta: number; direction: 'up'|'down'|'neutral' }
type Analytics = { period: { since: string; until: string }; summary: Summary; timeline: TimelineDay[]; trend7d?: Trend7d }

type Product  = { name: string; units: number; revenue: number; orders: number; pct: number }
type Category = { name: string; color: string; revenue: number; orders: number; units: number; pct: number; products: Product[] }
type Payment  = { label: string; count: number; revenue: number; pct: number; color: string }
type OrdersData = {
  products: Product[]; categories: Category[]; payments: Payment[]
  timeline: { date: string; revenue: number }[]
  summary: { totalOrders: number; totalRevenue: number; avgOrderValue: number }
}
type MonthStat = {
  key: string; label: string; revenue: number; spend: number
  net: number; orders: number; clicks: number; reach: number
  roas: number; cac: number; avgTicket: number
}
type MoM = { revenue: number; spend: number; net: number; orders: number; clicks: number; reach: number; roas: number; cac: number; avgTicket: number; curMonth: string; prevMonth: string }
type MonthlyData = {
  series: MonthStat[]; mom: MoM
  repeatRate: number; repeatCount: number; totalUnique: number; totalCustomers: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const ARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
const NUM = (n: number) =>
  new Intl.NumberFormat('es-AR').format(n)

// Fechas en timezone local (Argentina, no UTC)
const pad = (n: number) => String(n).padStart(2, '0')
function localDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}
function localMonthStart(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-01`
}
function localPrevMonthStart(d = new Date()) {
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1)
  return localMonthStart(prev)
}
function localMonthEnd(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-01`
}

// Se evalúa en el browser con timezone local
const PRESETS = [
  { label: 'Este mes', getSince: localMonthStart,     getUntil: localDate },
  { label: 'Mes ant.', getSince: localPrevMonthStart,  getUntil: localMonthEnd },
  { label: '2026',     getSince: () => '2026-01-01',   getUntil: () => '2026-12-31' },
  { label: '2025',     getSince: () => '2025-01-01',   getUntil: () => '2025-12-31' },
  { label: '2024',     getSince: () => '2024-01-01',   getUntil: () => '2024-12-31' },
  { label: 'Todo',     getSince: () => '2022-01-01',   getUntil: localDate },
]

// ── Tooltip personalizado ─────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: {name:string;value:number;color:string}[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/10 bg-[#0d0d18]/95 p-3 text-xs shadow-2xl backdrop-blur-md">
      <p className="text-white/40 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-white/60">{p.name}:</span>
          <span className="text-white font-semibold">{typeof p.value === 'number' && p.value > 1000 ? ARS(p.value) : NUM(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [since, setSince]             = useState(() => localMonthStart())
  const [until, setUntil]             = useState(() => localDate())
  const [activePreset, setPreset]     = useState('Este mes')
  const [data, setData]               = useState<Analytics | null>(null)
  const [ordersData, setOrdersData]   = useState<OrdersData | null>(null)
  const [monthly, setMonthly]         = useState<MonthlyData | null>(null)
  const [loading, setLoading]         = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [monthlyLoading, setMonthlyLoading] = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [chartView, setChartView]     = useState<'revenue'|'spend'|'clicks'|'net'>('revenue')
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return THEMES[0]
    return THEMES.find(t => t.id === (localStorage.getItem('dash-theme') ?? '')) ?? THEMES[0]
  })
  function applyTheme(t: Theme) { setTheme(t); localStorage.setItem('dash-theme', t.id) }

  const load = useCallback(() => {
    setLoading(true); setOrdersLoading(true); setMonthlyLoading(true); setError(null)

    // Carga periódica (depende del rango seleccionado)
    Promise.all([
      fetch(`/api/analytics?since=${since}&until=${until}`)
        .then(async r => { if (!r.ok) throw new Error(await r.text()); return r.json() }),
      fetch(`/api/orders-analytics?since=${since}&until=${until}`)
        .then(async r => r.json()),
    ]).then(([analytics, orders]) => {
      setData(analytics as Analytics)
      setOrdersData(orders as OrdersData)
      setLastUpdated(new Date())
      setLoading(false)
      setOrdersLoading(false)
    }).catch((e: Error) => { setError(e.message); setLoading(false); setOrdersLoading(false) })

    // Stats mensuales: siempre los últimos 12 meses (independiente del filtro)
    fetch('/api/monthly-stats')
      .then(async r => r.json())
      .then((d: MonthlyData) => { setMonthly(d); setMonthlyLoading(false) })
      .catch(() => setMonthlyLoading(false))
  }, [since, until])

  useEffect(() => {
    load()
    // Auto-refresh cada 60 minutos
    const interval = setInterval(load, 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [load])

  function applyPreset(p: typeof PRESETS[0]) {
    setPreset(p.label)
    setSince(p.getSince())
    setUntil(p.getUntil())
    setSelectedProduct(null)
  }

  const s = data?.summary
  const tl = data?.timeline ?? []
  const sparkRevenue = tl.map(d => d.revenue)

  // ── Merge revenue (TN directo) con spend (Meta API) para charts ──
  const mergedTimeline = (() => {
    const spendMap: Record<string, number> = {}
    const clicksMap: Record<string, number> = {}
    tl.forEach(d => { spendMap[d.date] = d.spend; clicksMap[d.date] = d.clicks })
    return (ordersData?.timeline ?? tl).map(d => ({
      date:    d.date,
      revenue: d.revenue,
      spend:   spendMap[d.date] ?? 0,
      clicks:  clicksMap[d.date] ?? 0,
      net:     d.revenue - (spendMap[d.date] ?? 0),
    }))
  })()

  // Revenue real del período (TN directo)
  const tnRevenue  = ordersData?.summary.totalRevenue ?? s?.totalRevenue ?? 0
  const tnOrders   = ordersData?.summary.totalOrders  ?? 0
  const tnAvgOrder = ordersData?.summary.avgOrderValue ?? 0
  const netRev     = tnRevenue - (s?.metaSpend ?? 0)
  const roas       = (s?.metaSpend ?? 0) > 0 ? tnRevenue / (s?.metaSpend ?? 1) : 0

  // ── chart view config
  const chartConfig = {
    revenue: { key: 'revenue', label: 'Ingresos',   color: theme.acHex },
    spend:   { key: 'spend',   label: 'Gasto Meta', color: '#818cf8' },
    clicks:  { key: 'clicks',  label: 'Clicks',     color: '#34d399' },
    net:     { key: 'net',     label: 'Neto',        color: '#facc15' },
  }
  const cc = chartConfig[chartView]

  const isLight     = theme.light     ?? false
  const isGrayscale = theme.grayscale ?? false

  const inputCls  = 'rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:border-white/20 transition-colors'
  const btnBase   = 'px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all border'
  const btnSty    = (active: boolean): React.CSSProperties => active
    ? { background: 'rgb(var(--ac) / 0.15)', color: 'rgb(var(--ac) / 0.9)', borderColor: 'rgb(var(--ac) / 0.3)' }
    : { color: isLight ? 'rgba(15,23,42,0.5)' : 'rgba(255,255,255,0.5)', borderColor: 'transparent' }
  const acStr     = (alpha: number) => `rgb(var(--ac) / ${alpha})`

  // ── Colores de charts (dependen del modo claro/oscuro) ──────────────────────
  const cTick  = { fill: isLight ? 'rgba(15,23,42,0.45)'  : 'rgba(255,255,255,0.5)',  fontSize: 10 }
  const cTick2 = { fill: isLight ? 'rgba(15,23,42,0.45)'  : 'rgba(255,255,255,0.55)', fontSize: 10 }
  const cGrid  = isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.05)'
  const cGrid2 = isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.03)'

  return (
    <main
      className="min-h-screen p-5 md:p-8 font-sans"
      data-light={isLight ? '' : undefined}
      data-grayscale={isGrayscale ? '' : undefined}
      style={{
        '--ac':       theme.ac,
        '--t-text':   isLight ? '#0f172a'               : '#ffffff',
        '--t-muted':  isLight ? 'rgba(15,23,42,0.60)'   : 'rgba(255,255,255,0.60)',
        '--t-dim':    isLight ? 'rgba(15,23,42,0.38)'   : 'rgba(255,255,255,0.38)',
        '--t-border': isLight ? 'rgba(15,23,42,0.10)'   : 'rgba(255,255,255,0.08)',
        '--t-card-bg':isLight ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.03)',
        color: isLight ? '#0f172a' : 'white',
        background: isLight
          ? theme.bg
          : `radial-gradient(ellipse 90% 40% at 50% -5%, rgb(${theme.ac} / 0.07) 0%, transparent 60%), ${theme.bg}`,
      } as React.CSSProperties}
    >

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 mb-7 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] mb-1" style={{ color: acStr(0.65) }}>Motor WhatsApp</p>
          <h1 className="text-lg font-bold tracking-tight">Panel de métricas</h1>
        </div>

        {/* Controles de fecha */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Presets */}
          <div className="flex gap-1 flex-wrap">
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p)}
                className={btnBase} style={btnSty(activePreset === p.label)}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Rango custom */}
          <div className="flex items-center gap-1">
            <input type="date" value={since} max={until}
              onChange={e => { setSince(e.target.value); setPreset('') }}
              className={inputCls} />
            <span className="text-white/50 text-xs">→</span>
            <input type="date" value={until} min={since} max={localDate()}
              onChange={e => { setUntil(e.target.value); setPreset('') }}
              className={inputCls} />
          </div>

          {/* Theme picker */}
          <ThemePicker current={theme.id} onChange={applyTheme} />
        </div>
      </div>

      {/* ── Wrapper de contenido — filtro grayscale para temas B&N ─── */}
      <div style={isGrayscale ? { filter: 'saturate(0) contrast(1.05)' } : undefined}>

      {/* ── Period label + last updated ─────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/50">
          {since} → {until}
        </span>
        {s?.metaSpend ? (
          <><span className="w-px h-3 bg-white/10" />
          <span className="text-[10px]" style={{ color: acStr(0.5) }}>Meta: {ARS(s.metaSpend)}</span></>
        ) : null}
      </div>
      {/* Refresh */}
      <div className="flex items-center gap-3">
        {lastUpdated && (
          <span className="text-[10px] text-white/15">
            {lastUpdated.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}
          </span>
        )}
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 text-[10px] text-white/55 hover:text-white/60 border border-white/10 hover:border-white/20 rounded-lg px-2.5 py-1 transition-all disabled:opacity-30">
          <span className={loading?'animate-spin inline-block':''}>↻</span> Actualizar
        </button>
        <button
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' })
            window.location.href = '/login'
          }}
          className="text-[10px] text-white/25 hover:text-white/50 transition-colors px-1"
          title="Cerrar sesión"
        >
          ⎋ Salir
        </button>
      </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-32 gap-2">
          {[0,150,300].map(d=>(
            <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'rgb(var(--ac))', animationDelay:`${d}ms` }} />
          ))}
        </div>
      )}
      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-red-400/80 text-xs font-mono">{error}</div>}

      {!loading && s && (
        <>
          {/* ── KPI row ─────────────────────────────────────────────── */}
          {monthly?.mom && (
            <p className="text-[10px] text-white/25 mb-3">
              ↕ comparando <span className="text-white/40 font-mono">{monthly.mom.curMonth}</span> vs <span className="text-white/40 font-mono">{monthly.mom.prevMonth}</span>
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-5">
            <MetricCard label="Ingresos brutos"  value={ARS(tnRevenue)}        sub={`${tnOrders} órdenes`}               mom={monthly?.mom.revenue}   sparkData={mergedTimeline.map(d=>d.revenue)}
              tip="Total facturado en el período según órdenes pagadas en Tiendanube. No descuenta costos." />
            <MetricCard label="Gasto Meta"        value={ARS(s.metaSpend)}      sub="período seleccionado"               mom={monthly?.mom.spend}     momInvert
              tip="Lo que gastaste en publicidad en Meta Ads (Facebook + Instagram) durante el período seleccionado." />
            <MetricCard label="Ingreso neto"      value={ARS(netRev)}           sub="bruto − gasto ads" highlight={netRev > 0} mom={monthly?.mom.net}  sparkData={mergedTimeline.map(d=>d.net)}
              tip="Ingresos brutos menos gasto en Meta Ads. Es lo que te queda en cuenta después de pagar la publicidad. No incluye otros costos operativos." />
            <MetricCard label="ROAS"              value={`${roas.toFixed(1)}x`} sub="revenue / spend"   highlight={roas >= 3}  mom={monthly?.mom.roas}
              tip="Return On Ad Spend: por cada peso invertido en Meta, cuántos pesos en ventas generaste. ROAS 3x = $3 vendidos por cada $1 gastado. Saludable: ≥3x." />
            <MetricCard label="CAC"               value={ARS(s.cac)}            sub={`${s.newCustomers} nuevos clientes`} mom={monthly?.mom.cac}      momInvert
              tip="Costo de Adquisición de Cliente: cuánto gastaste en Meta para conseguir cada nuevo cliente. Debería ser menor al LTV. Ideal: CAC < LTV / 3." />
            <MetricCard label="Ticket promedio"   value={ARS(tnAvgOrder)}       sub="por orden"                          mom={monthly?.mom.avgTicket} sparkData={mergedTimeline.map(d=>d.revenue)}
              tip="Valor promedio de cada orden. Si sube puede indicar upsells o productos más caros. Si baja, más ventas de productos de bajo precio." />
            <MetricCard label="Clicks Meta"       value={NUM(s.clicks)}         sub={`${NUM(s.impressions)} impresiones`}                              sparkData={mergedTimeline.map(d=>d.clicks)}
              tip="Clicks al link del anuncio en Meta Ads. Las impresiones son cuántas veces se mostró el anuncio. CTR = clicks / impresiones." />
            <MetricCard label="Alcance Meta"      value={NUM(s.reach)}          sub="personas únicas"
              tip="Personas únicas que vieron al menos un anuncio tuyo en el período. A diferencia de impresiones, no cuenta la misma persona dos veces." />
          </div>

          {/* ── Net revenue highlight ───────────────────────────────── */}
          <div className="rounded-2xl border p-5 mb-5 flex flex-col sm:flex-row sm:items-center gap-4"
            style={{ borderColor: acStr(0.15), background: `linear-gradient(to right, rgb(var(--ac) / 0.08), transparent)` }}>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/60 mb-1">Resultado del período</p>
              <p className="text-3xl font-bold font-mono" style={{ color: netRev >= 0 ? 'rgb(var(--ac))' : '#f87171' }}>
                {ARS(netRev)}
              </p>
              <p className="text-xs text-white/50 mt-1">
                {ARS(tnRevenue)} ingresos ({tnOrders} órd.) − {ARS(s.metaSpend)} ads
              </p>
            </div>
            <div className="flex gap-6 text-center">
              <div>
                <p className="text-lg font-bold font-mono text-white">{roas.toFixed(2)}x</p>
                <p className="text-[10px] text-white/50">ROAS</p>
              </div>
              <div>
                <p className="text-lg font-bold font-mono text-white">{ARS(s.cac)}</p>
                <p className="text-[10px] text-white/50">CAC</p>
              </div>
              <div>
                <p className={`text-lg font-bold font-mono ${(s.ltv/s.cac)>=3?'text-emerald-400':'text-orange-400'}`}>
                  {s.cac>0?(s.ltv/s.cac).toFixed(1):'-'}x
                </p>
                <p className="text-[10px] text-white/50">LTV/CAC</p>
              </div>
            </div>
          </div>

          {/* ── Indicador 7 días ────────────────────────────────────── */}
          {data?.trend7d && (
            <div className="mb-5">
              <Trend7d trend={data.trend7d} />
            </div>
          )}

          {/* ══ EMBUDO DE CONVERSIÓN ═════════════════════════════════ */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 mb-5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[10px] uppercase tracking-[0.18em] text-white/55 flex items-center">
                Embudo de conversión
                <HelpTip text="Muestra cuántas personas pasan por cada etapa del proceso de compra: desde que ven el anuncio hasta que recompran. Las tasas entre etapas indican dónde hay más fricción o pérdida." />
              </h3>
              <span className="text-[10px] text-white/25">{since} → {until}</span>
            </div>
            {(() => {
              const prev = monthly?.series[monthly.series.length - 2]
              return (
                <FunnelViz
                  reach={s.reach}
                  clicks={s.clicks}
                  orders={tnOrders}
                  repeats={monthly?.repeatCount ?? 0}
                  revenue={tnRevenue}
                  avgTicket={tnAvgOrder}
                  prevReach={prev?.reach}
                  prevClicks={prev?.clicks}
                  prevOrders={prev?.orders}
                  grayscale={isGrayscale}
                />
              )
            })()}
          </div>

          {/* ── Main chart ──────────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 mb-5">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <h3 className="text-[10px] uppercase tracking-[0.18em] text-white/60">
                Evolución del período
              </h3>
              <div className="flex gap-1">
                {(Object.keys(chartConfig) as (keyof typeof chartConfig)[]).map(k => (
                  <button key={k} onClick={() => setChartView(k)}
                    className={btnBase} style={btnSty(chartView === k)}>
                    {chartConfig[k].label}
                  </button>
                ))}
              </div>
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={mergedTimeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={cc.color} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={cc.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={cGrid} />
                <XAxis dataKey="date" tick={cTick}
                  tickFormatter={(v:string) => v.slice(5)} axisLine={false} tickLine={false}
                  interval={Math.max(0, Math.floor(mergedTimeline.length / 12))} />
                <YAxis tick={cTick}
                  tickFormatter={(v:number) => v>999?`$${(v/1000).toFixed(0)}k`:String(v)}
                  axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: `${cc.color}40`, strokeWidth: 1 }} />
                <Area type="monotone" dataKey={cc.key} name={cc.label}
                  stroke={cc.color} strokeWidth={2}
                  fill="url(#areaGrad)" dot={false}
                  activeDot={{ r: 4, fill: cc.color, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ── Revenue vs Spend + Calendar ─────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">

            {/* Combo chart Revenue vs Spend — usa mergedTimeline (TN directo + Meta) */}
            <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <h3 className="text-[10px] uppercase tracking-[0.18em] text-white/60 mb-5">Ingresos TN vs Gasto Meta · {since} → {until}</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={mergedTimeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={2}>
                  <CartesianGrid vertical={false} stroke={cGrid} />
                  <XAxis dataKey="date" tick={cTick}
                    tickFormatter={(v:string) => v.slice(5)} axisLine={false} tickLine={false}
                    interval={Math.max(0, Math.floor(mergedTimeline.length / 10))} />
                  <YAxis tick={cTick}
                    tickFormatter={(v:number) => `$${(v/1000).toFixed(0)}k`}
                    axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                  <Bar dataKey="revenue" name="Ingresos TN" fill={theme.acHex} opacity={0.85} radius={[2,2,0,0]} />
                  <Bar dataKey="spend"   name="Gasto Meta"  fill="#818cf8" opacity={0.7}  radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <EcommerceCalendar />
          </div>

          {/* ── Tráfico Meta ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">

            {/* Clicks por día */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[10px] uppercase tracking-[0.18em] text-white/55">Tráfico Meta Ads / día</h3>
                <span className="text-xs font-bold text-emerald-400">{NUM(s.clicks)} clicks</span>
              </div>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={tl} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={cGrid2} />
                  <XAxis dataKey="date" tick={cTick2}
                    tickFormatter={(v:string)=>v.slice(5)} axisLine={false} tickLine={false}
                    interval={Math.max(0, Math.floor(tl.length/8))} />
                  <YAxis tick={cTick2}
                    axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(52,211,153,0.3)', strokeWidth: 1 }} />
                  <Line type="monotone" dataKey="clicks" name="Clicks"
                    stroke="#34d399" strokeWidth={2} dot={false}
                    activeDot={{ r: 3, fill: '#34d399', strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-3 pt-3 border-t border-white/5 flex justify-between text-[10px] text-white/50">
                <span>Impresiones totales</span>
                <span className="text-white/50">{NUM(s.impressions)}</span>
              </div>
            </div>

            {/* Fuentes de tráfico */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <h3 className="text-[10px] uppercase tracking-[0.18em] text-white/55 mb-4">Fuentes de tráfico</h3>
              <div className="space-y-3">
                {/* Meta Ads */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-white/60 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: 'rgb(var(--ac))' }} />Meta Ads (pago)
                    </span>
                    <span className="text-white/80 font-semibold">{NUM(s.clicks)} clicks</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: '100%', background: 'rgb(var(--ac) / 0.6)' }} />
                  </div>
                </div>
                {/* Orgánico - requiere GA4 */}
                <div className="opacity-30">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-white/60 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />Orgánico
                    </span>
                    <span className="text-white/40 text-[10px]">requiere GA4</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5" />
                </div>
                <div className="opacity-30">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-white/60 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />Directo
                    </span>
                    <span className="text-white/40 text-[10px]">requiere GA4</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5" />
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 rounded-xl bg-white/[0.02] p-3">
                <p className="text-[10px] text-white/55 leading-relaxed">
                  Para ver orgánico y directo conectá <span className="text-indigo-300">Google Analytics 4</span> con el store ID de GA4.
                </p>
              </div>
            </div>
          </div>

          {/* ── Bottom: Mensajes + LTV ───────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/50 mb-3">Mensajes WhatsApp</p>
              <div className="flex gap-8">
                <div><p className="text-2xl font-bold font-mono text-emerald-400">0</p><p className="text-[10px] text-white/50 mt-1">Enviados</p></div>
                <div><p className="text-2xl font-bold font-mono text-red-400/70">0</p><p className="text-[10px] text-white/50 mt-1">Fallidos</p></div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/50 mb-3">LTV / CAC ratio</p>
              <div className="flex items-end gap-2 mb-3">
                <p className={`text-2xl font-bold font-mono ${(s.ltv/s.cac)>=3?'text-emerald-400':'text-orange-400'}`}>
                  {s.cac>0?(s.ltv/s.cac).toFixed(1):'-'}x
                </p>
                <p className="text-[10px] text-white/55 mb-0.5">objetivo ≥3x</p>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width:`${Math.min(100,(s.ltv/s.cac/5)*100)}%`, background:(s.ltv/s.cac)>=3?'linear-gradient(90deg,#34d399,#10b981)':'linear-gradient(90deg,#f97316,#fb923c)' }} />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-white/50">
                <span>LTV {ARS(s.ltv)}</span><span>CAC {ARS(s.cac)}</span>
              </div>
            </div>
          </div>

          {/* ══ SECCIÓN VENTAS POR PRODUCTO ══════════════════════════ */}
          <div className="mb-2">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-[10px] uppercase tracking-[0.2em] text-white/55">Ventas por producto</h2>
              {selectedProduct && (
                <button onClick={() => setSelectedProduct(null)}
                  className="text-[10px] rounded-lg px-2 py-0.5 transition-colors border"
                  style={{ color: acStr(0.7), borderColor: acStr(0.2) }}>
                  ✕ limpiar filtro
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              {/* Categorías con acordeón */}
              <div className="lg:col-span-1 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/55">
                    Por categoría
                  </p>
                  {selectedProduct && (
                    <button onClick={() => setSelectedProduct(null)}
                      className="text-[10px] rounded-lg px-2 py-0.5 transition-colors border"
                  style={{ color: acStr(0.7), borderColor: acStr(0.2) }}>
                      ✕ limpiar
                    </button>
                  )}
                </div>
                {ordersLoading
                  ? <div className="text-white/50 text-xs py-8 text-center">Cargando...</div>
                  : <CategoryAccordion
                      categories={ordersData?.categories ?? []}
                      totalRevenue={ordersData?.summary.totalRevenue ?? 0}
                      selectedProduct={selectedProduct}
                      onSelectProduct={setSelectedProduct}
                    />
                }
              </div>

              {/* Timeline filtrada por producto */}
              <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="flex items-baseline justify-between mb-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/50">
                    {selectedProduct ? `Ingresos — ${selectedProduct.slice(0,30)}…` : 'Ingresos totales por día'}
                  </p>
                  <span className="text-xs font-mono font-bold" style={{ color: 'rgb(var(--ac))' }}>
                    {ARS(ordersData?.summary.totalRevenue ?? 0)}
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart
                    data={ordersData?.timeline ?? []}
                    margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="prodGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={theme.acHex} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={theme.acHex} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke={cGrid2} />
                    <XAxis dataKey="date" tick={cTick2}
                      tickFormatter={(v:string) => v.slice(5)} axisLine={false} tickLine={false}
                      interval={Math.max(0, Math.floor((ordersData?.timeline.length??1)/10))} />
                    <YAxis tick={cTick2}
                      tickFormatter={(v:number) => `$${(v/1000).toFixed(0)}k`}
                      axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background:'rgba(10,10,20,0.95)', border:`1px solid ${theme.acHex}33`, borderRadius:10, fontSize:11 }}
                      formatter={(v:unknown) => [ARS(Number(v)), 'Ingresos']}
                      cursor={{ stroke:`${theme.acHex}4d`, strokeWidth:1 }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke={theme.acHex} strokeWidth={2}
                      fill="url(#prodGrad)" dot={false}
                      activeDot={{ r:3, fill:'#f97316', strokeWidth:0 }} />
                  </AreaChart>
                </ResponsiveContainer>
                {/* Ticket promedio */}
                <div className="mt-3 pt-3 border-t border-white/5 flex justify-between text-[10px] text-white/50">
                  <span>Ticket promedio</span>
                  <span className="font-mono text-white/50">{ARS(ordersData?.summary.avgOrderValue ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ══ SECCIÓN MÉTODOS DE PAGO ══════════════════════════════ */}
          <div>
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-white/55 mb-4">Métodos de pago</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Donut */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/50 mb-4">
                  {selectedProduct ? `Filtrado: ${selectedProduct.slice(0,20)}…` : 'Distribución general'}
                </p>
                {ordersLoading
                  ? <div className="text-white/50 text-xs py-16 text-center">Cargando...</div>
                  : <PaymentDonut data={ordersData?.payments ?? []} />
                }
              </div>

              {/* Tabla detalle */}
              <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/50 mb-4">Detalle por método</p>
                {ordersLoading
                  ? <div className="text-white/50 text-xs py-8 text-center">Cargando...</div>
                  : <div className="space-y-1">
                      {/* Header */}
                      <div className="grid grid-cols-4 text-[10px] uppercase tracking-widest text-white/50 px-3 pb-2 border-b border-white/5">
                        <span className="col-span-2">Método</span>
                        <span className="text-right">Órdenes</span>
                        <span className="text-right">Total</span>
                      </div>
                      {(ordersData?.payments ?? []).map(p => (
                        <div key={p.label}
                          className="grid grid-cols-4 items-center rounded-xl px-3 py-2.5 hover:bg-white/[0.03] transition-colors group">
                          <div className="col-span-2 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                            <span className="text-[11px] text-white/70 truncate">{p.label}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] font-mono text-white/50">{p.count}</span>
                            <span className="text-[10px] text-white/50 ml-1">({p.pct}%)</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] font-mono text-white/80">{ARS(p.revenue)}</span>
                          </div>
                        </div>
                      ))}
                      {/* Total */}
                      <div className="grid grid-cols-4 items-center rounded-xl px-3 py-2.5 border-t border-white/5 mt-1 pt-3">
                        <div className="col-span-2 text-[11px] text-white/40 font-medium">Total período</div>
                        <div className="text-right text-[11px] font-mono text-white/50">
                          {(ordersData?.payments ?? []).reduce((s,p)=>s+p.count,0)}
                        </div>
                        <div className="text-right text-[11px] font-mono font-semibold" style={{ color: 'rgb(var(--ac))' }}>
                          {ARS((ordersData?.payments ?? []).reduce((s,p)=>s+p.revenue,0))}
                        </div>
                      </div>
                    </div>
                }
              </div>
            </div>
          </div>

          {/* ══ SECCIÓN HISTÓRICO MENSUAL ════════════════════════════ */}
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-[10px] uppercase tracking-[0.2em] text-white/50">Análisis histórico — últimos 12 meses</h2>
              {monthlyLoading && <span className="text-[10px] text-white/25 animate-pulse">cargando...</span>}
            </div>

            {/* ── Gráfico 12 meses Revenue / Spend / Neto ── */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 mb-4">
              <div className="flex items-baseline justify-between mb-5">
                <h3 className="text-[10px] uppercase tracking-[0.18em] text-white/55">Ingresos · Gasto Meta · Neto mensual</h3>
                {monthly && (
                  <span className="text-[10px] font-mono text-white/35">
                    acum. {ARS(monthly.series.reduce((s,m)=>s+m.revenue,0))}
                  </span>
                )}
              </div>
              {monthly
                ? <MonthlyRevenueChart data={monthly.series} />
                : <div className="h-[220px] flex items-center justify-center text-white/20 text-xs">Cargando...</div>
              }
            </div>

            {/* ── ROAS + CAC trend | Ticket + Órdenes ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h3 className="text-[10px] uppercase tracking-[0.18em] text-white/55 mb-5 flex items-center">ROAS y CAC mensual<HelpTip text="ROAS mide el retorno de la inversión publicitaria. CAC es cuánto cuesta adquirir cada cliente nuevo. Si el ROAS baja o el CAC sube mes a mes, los anuncios están perdiendo eficiencia." /></h3>
                {monthly
                  ? <RoasCacChart data={monthly.series} />
                  : <div className="h-[180px] flex items-center justify-center text-white/20 text-xs">Cargando...</div>
                }
                <p className="text-[9px] text-white/25 mt-2">ROAS baja = Meta se encarece · CAC sube = cuesta más adquirir cada cliente</p>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h3 className="text-[10px] uppercase tracking-[0.18em] text-white/55 mb-5 flex items-center">Ticket y volumen<HelpTip text="Ticket promedio = valor promedio por orden. Órdenes = cantidad de ventas. Si el ticket sube sin más órdenes, estás vendiendo productos más caros. Si suben las órdenes, hay más demanda." /></h3>
                {monthly
                  ? <AvgTicketChart data={monthly.series} />
                  : <div className="h-[160px] flex items-center justify-center text-white/20 text-xs">Cargando...</div>
                }
                <p className="text-[9px] text-white/25 mt-2">Ticket baja + órdenes suben = ventas más accesibles · Ticket sube = clientes de mayor valor</p>
              </div>
            </div>

            {/* ── Repeat rate + Resumen mensual tabla ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Repeat rate card */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h3 className="text-[10px] uppercase tracking-[0.18em] text-white/55 mb-4 flex items-center">Tasa de recompra<HelpTip text="% de clientes únicos que compraron en dos o más meses distintos. Un número alto indica fidelidad y reduce la dependencia de publicidad para generar ventas. Saludable: ≥20%." /></h3>
                {monthly ? (
                  <>
                    <div className="flex items-end gap-2 mb-3">
                      <p className={`text-3xl font-bold font-mono ${monthly.repeatRate >= 20 ? 'text-emerald-400' : monthly.repeatRate >= 10 ? 'text-orange-400' : 'text-red-400'}`}>
                        {monthly.repeatRate}%
                      </p>
                      <p className="text-[10px] text-white/35 mb-1">de clientes únicos</p>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden mb-3">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(100, monthly.repeatRate * 2)}%`,
                          background: monthly.repeatRate >= 20 ? 'linear-gradient(90deg,#34d399,#10b981)'
                                    : monthly.repeatRate >= 10 ? 'linear-gradient(90deg,#f97316,#fb923c)'
                                    : 'linear-gradient(90deg,#f43f5e,#fb7185)',
                        }} />
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-white/45">Compraron 2+ meses</span>
                        <span className="font-mono text-white/70">{monthly.repeatCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/45">Clientes únicos totales</span>
                        <span className="font-mono text-white/70">{monthly.totalUnique}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-white/5">
                        <span className="text-white/30 text-[9px]">Objetivo saludable</span>
                        <span className="text-white/30 text-[9px]">≥ 20%</span>
                      </div>
                    </div>
                  </>
                ) : <div className="h-24 flex items-center justify-center text-white/20 text-xs">Cargando...</div>}
              </div>

              {/* Tabla mensual resumen */}
              <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 overflow-x-auto">
                <h3 className="text-[10px] uppercase tracking-[0.18em] text-white/55 mb-4">Resumen por mes</h3>
                {monthly ? (
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-[9px] uppercase tracking-widest text-white/30 border-b border-white/5">
                        <th className="text-left pb-2 font-medium">Mes</th>
                        <th className="text-right pb-2 font-medium">Ingresos</th>
                        <th className="text-right pb-2 font-medium">Meta</th>
                        <th className="text-right pb-2 font-medium">Neto</th>
                        <th className="text-right pb-2 font-medium">ROAS</th>
                        <th className="text-right pb-2 font-medium">Órd.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...monthly.series].reverse().map((m, i) => {
                        const isCurrent = i === 0
                        return (
                          <tr key={m.key}
                            className="border-b border-white/[0.04]"
                            style={isCurrent ? { background: 'rgb(var(--ac) / 0.05)' } : undefined}>
                            <td className="py-2 font-mono"
                              style={{ color: isCurrent ? 'rgb(var(--ac))' : 'var(--t-muted)' }}>
                              {m.label} {isCurrent && <span className="text-[9px]" style={{ color: 'rgb(var(--ac) / 0.6)' }}>← actual</span>}
                            </td>
                            <td className="py-2 text-right font-mono text-white/80">{ARS(m.revenue)}</td>
                            <td className="py-2 text-right font-mono text-white/45">{ARS(m.spend)}</td>
                            <td className={`py-2 text-right font-mono font-semibold ${m.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {ARS(m.net)}
                            </td>
                            <td className={`py-2 text-right font-mono ${m.roas >= 3 ? 'text-emerald-400' : m.roas > 0 ? 'text-orange-400' : 'text-white/20'}`}>
                              {m.roas > 0 ? `${m.roas}x` : '—'}
                            </td>
                            <td className="py-2 text-right font-mono text-white/55">{m.orders || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : <div className="h-40 flex items-center justify-center text-white/20 text-xs">Cargando...</div>}
              </div>
            </div>
          </div>
        </>
      )}
      </div>{/* fin wrapper grayscale */}
    </main>
  )
}
