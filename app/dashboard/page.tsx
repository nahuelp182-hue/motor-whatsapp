'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, LineChart, Line,
} from 'recharts'
import { MetricCard } from '@/components/MetricCard'
import { PaymentDonut } from '@/components/PaymentDonut'
import { CategoryAccordion } from '@/components/CategoryAccordion'
import { Trend7d } from '@/components/Trend7d'
import { MonthlyRevenueChart, RoasCacChart, AvgTicketChart } from '@/components/MonthlyChart'
import { ClaudeUsageChart, type UsageDay } from '@/components/ClaudeUsageChart'
import { FunnelViz } from '@/components/FunnelViz'
import { SalesCadence } from '@/components/SalesCadence'
import { PerformanceSection } from '@/components/PerformanceSection'
import { AttributionSection } from '@/components/AttributionSection'
import { CuriososSection } from '@/components/CuriososSection'
import { GlobalRoasGauge } from '@/components/GlobalRoasGauge'
import { PanelShell } from '@/components/PanelShell'
import { Ayuda } from '@/components/panel/Primitivos'

// Único acento del panel: ámbar. Reemplaza al ThemePicker de 12 temas —
// nadie lo usaba para elegir salvo un tema, y mantenerlo era 12 paletas a
// probar por cada cambio futuro. Hex (no var(--pnl-amber)) porque varios
// componentes concatenan transparencia (`acHex + 'aa'`), inválido sobre var().
const AC_HEX = '#F5A623'

// ── Types ─────────────────────────────────────────────────────────────────────
type TimelineDay = {
  date: string; revenue: number; spend: number; clicks: number; net: number
  meta_ads: number; sin_utm_con_landing: number; sin_dato_de_visita: number; otro: number
}
type Summary = {
  totalRevenue: number; metaSpend: number; netRevenue: number
  newCustomers: number; cac: number; cacMetaReal: number; ltv: number
  clicks: number; impressions: number; reach: number
  roasBlended: number; roasMetaReal: number
  googleSpend: number; totalAdSpend: number; roasGlobal: number
}
type Channel = { key: string; label: string; color: string; orders: number; revenue: number }
type Trend7d = { last7Rev: number; prev7Rev: number; last7Orders: number; prev7Orders: number; delta: number; direction: 'up'|'down'|'neutral' }
type Analytics = { period: { since: string; until: string }; summary: Summary; channels: Channel[]; timeline: TimelineDay[]; trend7d?: Trend7d }

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
  roas: number; roasBlended: number; cac: number; cacMetaReal: number
  metaRevenue: number; metaOrders: number; orgCiegoRevenue: number; avgTicket: number
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
const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
// Período anterior de IGUAL cantidad de días, inmediatamente previo al rango filtrado.
// Ej: filtro 07-01→07-13 (13 días) => compara contra 06-18→06-30 (13 días).
function prevRange(since: string, until: string) {
  const DAY = 86400000
  const d0 = new Date(since + 'T00:00:00'), d1 = new Date(until + 'T00:00:00')
  const span = Math.max(1, Math.round((d1.getTime() - d0.getTime()) / DAY) + 1)
  const pUntil = new Date(d0.getTime() - DAY)
  const pSince = new Date(pUntil.getTime() - (span - 1) * DAY)
  return { since: fmtDate(pSince), until: fmtDate(pUntil) }
}

// Se evalúa en el browser con timezone local
const PRESETS = [
  { label: 'Este mes',  getSince: localMonthStart,                                             getUntil: localDate },
  { label: 'Mes ant.',  getSince: localPrevMonthStart,                                         getUntil: localMonthEnd },
  { label: 'Últ. 14d', getSince: () => { const d = new Date(); d.setDate(d.getDate()-13); return localDate(d) }, getUntil: localDate },
  { label: '2026',      getSince: () => '2026-01-01',                                          getUntil: () => '2026-12-31' },
  { label: '2025',     getSince: () => '2025-01-01',   getUntil: () => '2025-12-31' },
  { label: '2024',     getSince: () => '2024-01-01',   getUntil: () => '2024-12-31' },
  { label: 'Todo',     getSince: () => '2022-01-01',   getUntil: localDate },
]

// ── Tooltip personalizado ─────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: {name:string;value:number;color:string}[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] p-3 text-xs shadow-2xl backdrop-blur-md">
      <p className="text-[var(--pnl-text-3)] mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[var(--pnl-text-2)]">{p.name}:</span>
          <span className="text-[var(--pnl-text)] font-semibold">{typeof p.value === 'number' && p.value > 1000 ? ARS(p.value) : NUM(p.value)}</span>
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
  const [prevPeriod, setPrevPeriod]   = useState<{ reach: number; clicks: number; orders: number } | null>(null)
  const [loading, setLoading]         = useState(true)
  // Distinto de `loading`: el auto-refresh horario (línea ~192) llamaba a la
  // misma `load()` que la carga inicial, y loading=true desmontaba todo el
  // contenido (línea ~386) cada vez — el panel se ponía en blanco cada hora
  // aunque los datos ya estuvieran en pantalla. `refreshing` no gatea el
  // render: solo cambia el indicador de la barra superior.
  const [refreshing, setRefreshing]   = useState(false)
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [monthlyLoading, setMonthlyLoading] = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [chartView, setChartView]     = useState<'revenue'|'spend'|'clicks'|'net'>('revenue')
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [usage, setUsage] = useState<{ series: UsageDay[]; totalCost: number; totalCalls: number } | null>(null)

  const load = useCallback((opts?: { esRefresco?: boolean }) => {
    if (opts?.esRefresco) setRefreshing(true)
    else setLoading(true)
    setOrdersLoading(true); setMonthlyLoading(true); setError(null)

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
      setRefreshing(false)
      setOrdersLoading(false)
    }).catch((e: Error) => { setError(e.message); setLoading(false); setRefreshing(false); setOrdersLoading(false) })

    // Período anterior de igual duración (para el delta del embudo, respeta el filtro)
    const pr = prevRange(since, until)
    setPrevPeriod(null)
    Promise.all([
      fetch(`/api/analytics?since=${pr.since}&until=${pr.until}`).then(r => r.json()),
      fetch(`/api/orders-analytics?since=${pr.since}&until=${pr.until}`).then(r => r.json()),
    ]).then(([pa, po]) => {
      setPrevPeriod({
        reach:  pa?.summary?.reach  ?? 0,
        clicks: pa?.summary?.clicks ?? 0,
        orders: po?.summary?.totalOrders ?? 0,
      })
    }).catch(() => setPrevPeriod(null))

    // Stats mensuales: siempre los últimos 12 meses (independiente del filtro)
    fetch('/api/monthly-stats')
      .then(async r => r.json())
      .then((d: MonthlyData) => { setMonthly(d); setMonthlyLoading(false) })
      .catch(() => setMonthlyLoading(false))

    // Gasto Claude (IG + WhatsApp): últimos 30 días
    fetch('/api/claude-usage?days=30')
      .then(async r => r.json())
      .then((d) => setUsage(d))
      .catch(() => {})
  }, [since, until])

  useEffect(() => {
    load()
    // Auto-refresh cada 60 minutos
    const interval = setInterval(() => load({ esRefresco: true }), 60 * 60 * 1000)
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
  // ROAS real: solo revenue de órdenes confirmadas como Meta Ads (utm/fbclid capturado
  // por TN al click) / gasto Meta. Antes esto era tnRevenue/metaSpend (TODO el revenue,
  // incluida venta orgánica) -> ROAS siempre inflado. Ver lib/attribution.ts.
  const roas        = s?.roasMetaReal ?? 0
  const roasBlended = s?.roasBlended  ?? ((s?.metaSpend ?? 0) > 0 ? tnRevenue / (s?.metaSpend ?? 1) : 0)
  const cac         = s?.cacMetaReal ?? 0

  // ── chart view config
  const chartConfig = {
    revenue: { key: 'revenue', label: 'Ingresos',   color: AC_HEX },
    spend:   { key: 'spend',   label: 'Gasto Meta', color: 'var(--pnl-lilac)' },
    clicks:  { key: 'clicks',  label: 'Clicks',     color: 'var(--pnl-green)' },
    net:     { key: 'net',     label: 'Neto',       color: 'var(--pnl-amber-soft)' },
  }
  const cc = chartConfig[chartView]

  const inputCls  = 'rounded-md border border-[var(--pnl-hair)] bg-[var(--pnl-panel-2)] px-3 py-1.5 text-xs text-[var(--pnl-text-2)] focus:outline-none focus-visible:outline-2 focus-visible:outline-[var(--pnl-amber)] transition-colors'
  const btnBase   = 'px-3 py-1.5 rounded-md text-[11px] font-medium transition-all border'
  const btnSty    = (active: boolean): React.CSSProperties => active
    ? { background: 'color-mix(in srgb, var(--pnl-amber) 15%, transparent)', color: 'var(--pnl-amber)', borderColor: 'color-mix(in srgb, var(--pnl-amber) 30%, transparent)' }
    : { color: 'var(--pnl-text-3)', borderColor: 'transparent' }

  // ── Colores de charts ────────────────────────────────────────────────────
  const cTick  = { fill: 'var(--pnl-text-3)', fontSize: 10 }
  const cTick2 = { fill: 'var(--pnl-text-2)', fontSize: 10 }
  const cGrid  = 'var(--pnl-hair)'
  const cGrid2 = 'var(--pnl-panel)'

  return (
    <PanelShell
      titulo="Panel de métricas"
      sub={
        <div className="flex flex-wrap items-center gap-3">
          <span>{since} → {until}</span>
          {s?.metaSpend ? (
            <>
              <span className="h-3 w-px bg-[var(--pnl-hair)]" />
              <span style={{ color: 'var(--pnl-amber)' }}>Meta: {ARS(s.metaSpend)}</span>
            </>
          ) : null}
        </div>
      }
      accion={
        <div className="flex flex-wrap items-center gap-3">
          {lastUpdated && (
            <span className={`flex items-center gap-1.5 text-[10px] ${refreshing ? 'text-[var(--pnl-amber)]' : 'text-[var(--pnl-text-3)]'}`}>
              {refreshing && <span className="size-1.5 rounded-full bg-[var(--pnl-amber)] animate-pulse" />}
              {refreshing ? 'Actualizando…' : lastUpdated.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}
            </span>
          )}
          <button onClick={() => load()} disabled={loading}
            className="flex min-h-9 items-center gap-1.5 rounded-md border border-[var(--pnl-hair)] px-2.5 text-[10px] text-[var(--pnl-text-2)] hover:border-[var(--pnl-track)] hover:text-[var(--pnl-text)] transition-all disabled:opacity-30">
            <span className={loading?'animate-spin inline-block':''}>↻</span> Actualizar
          </button>
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' })
              window.location.href = '/login'
            }}
            className="min-h-9 px-1 text-[10px] text-[var(--pnl-text-3)] hover:text-[var(--pnl-text-2)] transition-colors"
            title="Cerrar sesión"
          >
            ⎋ Salir
          </button>
        </div>
      }
    >
      {/* ── Controles de fecha ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => applyPreset(p)}
              className={btnBase} style={btnSty(activePreset === p.label)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <input type="date" value={since} max={until}
            onChange={e => { setSince(e.target.value); setPreset('') }}
            className={inputCls} />
          <span className="text-xs text-[var(--pnl-text-3)]">→</span>
          <input type="date" value={until} min={since} max={localDate()}
            onChange={e => { setUntil(e.target.value); setPreset('') }}
            className={inputCls} />
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-32 gap-2">
          {[0,150,300].map(d=>(
            <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--pnl-amber)', animationDelay:`${d}ms` }} />
          ))}
        </div>
      )}
      {error && <div className="rounded-md border border-[var(--pnl-red)] bg-[color-mix(in_srgb,var(--pnl-red)_8%,transparent)] p-4 text-[var(--pnl-red-text)] text-xs font-mono">{error}</div>}

      {!loading && s && (
        <>
          {/* ── ROAS Global del negocio — pulso rápido del período ─────── */}
          <GlobalRoasGauge
            roasGlobal={s.roasGlobal}
            totalRevenue={s.totalRevenue}
            metaSpend={s.metaSpend}
            googleSpend={s.googleSpend}
          />

          {/* ── KPI row ─────────────────────────────────────────────── */}
          {monthly?.mom && (
            <p className="text-[10px] text-[var(--pnl-text-3)]">
              ↕ comparando <span className="font-mono text-[var(--pnl-text-2)]">{monthly.mom.curMonth}</span> vs <span className="font-mono text-[var(--pnl-text-2)]">{monthly.mom.prevMonth}</span>
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <MetricCard label="Ingresos brutos"  value={ARS(tnRevenue)}        sub={`${tnOrders} órdenes`}               mom={monthly?.mom.revenue}   sparkData={mergedTimeline.map(d=>d.revenue)}
              tip="Total facturado en el período según órdenes pagadas en Tiendanube. No descuenta costos." />
            <MetricCard label="Gasto Meta"        value={ARS(s.metaSpend)}      sub="período seleccionado"               mom={monthly?.mom.spend}     momInvert
              tip="Lo que gastaste en publicidad en Meta Ads (Facebook + Instagram) durante el período seleccionado." />
            <MetricCard label="Ingreso neto"      value={ARS(netRev)}           sub="bruto − gasto ads" highlight={netRev > 0} mom={monthly?.mom.net}  sparkData={mergedTimeline.map(d=>d.net)}
              tip="Ingresos brutos menos gasto en Meta Ads. Es lo que te queda en cuenta después de pagar la publicidad. No incluye otros costos operativos." />
            <MetricCard label="ROAS Meta real"   value={`${roas.toFixed(1)}x`} sub="solo revenue de Meta"   highlight={roas >= 3}  mom={monthly?.mom.roas}
              tip={`Return On Ad Spend real: revenue de órdenes CONFIRMADAS como Meta Ads (utm/fbclid capturado por Tiendanube) / gasto Meta. Ya no mezcla venta orgánica. ROAS blended legado (ingreso total/gasto, lo que mostraba antes): ${roasBlended.toFixed(1)}x.`} />
            <MetricCard label="CAC Meta real"    value={ARS(cac)}              sub={`${(data?.channels?.find(c=>c.key==='meta_ads')?.orders) ?? 0} órdenes Meta`}   mom={monthly?.mom.cac}      momInvert
              tip="Costo de Adquisición de Cliente: gasto Meta / órdenes confirmadas como Meta Ads (no todas las órdenes nuevas). Debería ser menor al LTV. Ideal: CAC < LTV / 3." />
            <MetricCard label="LTV"               value={ARS(s.ltv)}            sub="por cliente histórico"
              tip="Lifetime Value: ingreso total promedio que generó cada cliente durante toda su historia de compras. Se calcula sobre todos los clientes registrados, no solo el período. Saludable: LTV ≥ 3× el CAC." />
            <MetricCard label="Ticket promedio"   value={ARS(tnAvgOrder)}       sub="por orden"                          mom={monthly?.mom.avgTicket} sparkData={mergedTimeline.map(d=>d.revenue)}
              tip="Valor promedio de cada orden. Si sube puede indicar upsells o productos más caros. Si baja, más ventas de productos de bajo precio." />
            <MetricCard label="Clicks Meta"       value={NUM(s.clicks)}         sub={`${NUM(s.impressions)} impresiones`}                              sparkData={mergedTimeline.map(d=>d.clicks)}
              tip="Clicks al link del anuncio en Meta Ads. Las impresiones son cuántas veces se mostró el anuncio. CTR = clicks / impresiones." />
            <MetricCard label="Alcance Meta"      value={NUM(s.reach)}          sub="personas únicas"
              tip="Personas únicas que vieron al menos un anuncio tuyo en el período. A diferencia de impresiones, no cuenta la misma persona dos veces." />
          </div>

          {/* ── Net revenue highlight ───────────────────────────────── */}
          <div className="rounded-2xl border p-5 mb-5 flex flex-col sm:flex-row sm:items-center gap-4"
            style={{ borderColor: 'color-mix(in srgb, var(--pnl-amber) 20%, transparent)', background: 'linear-gradient(to right, color-mix(in srgb, var(--pnl-amber) 10%, transparent), transparent)' }}>
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--pnl-text-2)] mb-1">Resultado del período</p>
              <p className="text-3xl font-bold font-mono" style={{ color: netRev >= 0 ? 'var(--pnl-amber)' : 'var(--pnl-red)' }}>
                {ARS(netRev)}
              </p>
              <p className="text-xs text-[var(--pnl-text-3)] mt-1">
                {ARS(tnRevenue)} ingresos ({tnOrders} órd.) − {ARS(s.metaSpend)} ads
              </p>
            </div>
            <div className="flex gap-6 text-center">
              <div>
                <p className="text-lg font-bold font-mono text-[var(--pnl-text)]">{roas.toFixed(2)}x</p>
                <p className="text-[10px] text-[var(--pnl-text-3)]">ROAS</p>
              </div>
              <div>
                <p className="text-lg font-bold font-mono text-[var(--pnl-text)]">{ARS(cac)}</p>
                <p className="text-[10px] text-[var(--pnl-text-3)]">CAC</p>
              </div>
              <div>
                <p className={`text-lg font-bold font-mono ${(s.ltv/cac)>=3?'text-[var(--pnl-green-text)]':'text-[var(--pnl-amber)]'}`}>
                  {cac>0?(s.ltv/cac).toFixed(1):'-'}x
                </p>
                <p className="text-[10px] text-[var(--pnl-text-3)]">LTV/CAC</p>
              </div>
            </div>
          </div>

          {/* ── Indicador 7 días ────────────────────────────────────── */}
          {data?.trend7d && (
            <div className="mb-5">
              <Trend7d trend={data.trend7d} />
            </div>
          )}

          {/* ── Cadencia de ventas ──────────────────────────────────── */}
          <div className="mb-5">
            <SalesCadence key={`${since}-${until}`} since={since} until={until} acHex={AC_HEX} />
          </div>

          {/* ══ EMBUDO DE CONVERSIÓN ═════════════════════════════════ */}
          <div className="rounded-2xl border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] p-6 mb-5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[10px] uppercase tracking-[0.18em] text-[var(--pnl-text-2)] flex items-center">
                Embudo de conversión
                <Ayuda>Dos capas: (1) Tráfico Meta Ads = Alcance y Clicks, que son 100% de la publicidad. (2) Negocio total = Compras y Recompras, que incluyen TODOS los canales (Meta + orgánico + directo + Google). El salto entre clicks y compras NO es la conversión de Meta: solo una parte de las compras vino de Meta (se indica el %). La conversión real de Meta está en el benchmark 'CVR Meta' a la derecha.</Ayuda>
              </h3>
              <div className="flex flex-col items-end leading-tight">
                <span className="text-[10px] text-[var(--pnl-text-3)]">{since} → {until}</span>
                {prevPeriod && (() => {
                  const pr = prevRange(since, until)
                  return <span className="text-[9px] text-[var(--pnl-text-3)]">Δ vs {pr.since} → {pr.until}</span>
                })()}
              </div>
            </div>
            {(() => {
              const metaCh = data?.channels?.find(c => c.key === 'meta_ads')
              return (
                <FunnelViz
                  reach={s.reach}
                  clicks={s.clicks}
                  orders={tnOrders}
                  repeats={monthly?.repeatCount ?? 0}
                  revenue={tnRevenue}
                  avgTicket={tnAvgOrder}
                  metaOrders={metaCh?.orders ?? 0}
                  metaRevenue={metaCh?.revenue ?? 0}
                  prevReach={prevPeriod?.reach}
                  prevClicks={prevPeriod?.clicks}
                  prevOrders={prevPeriod?.orders}
                />
              )
            })()}
          </div>

          {/* ── Main chart ──────────────────────────────────────────── */}
          <div className="rounded-2xl border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] p-6 mb-5">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <h3 className="text-[10px] uppercase tracking-[0.18em] text-[var(--pnl-text-2)]">
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
                    <stop offset="0%"   stopColor={cc.color} stopOpacity={0.45} />
                    <stop offset="45%"  stopColor={cc.color} stopOpacity={0.12} />
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
                  stroke={cc.color} strokeWidth={2.5}
                  fill="url(#areaGrad)" dot={false}
                  activeDot={{ r: 5, fill: cc.color, stroke: '#fff', strokeWidth: 1.5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ── Revenue vs Spend ─────────────────────────────────────── */}
          <div className="mb-5">
            <div className="rounded-2xl border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] p-6">
              <h3 className="text-[10px] uppercase tracking-[0.18em] text-[var(--pnl-text-2)] mb-5">Ingresos TN vs Gasto Meta · {since} → {until}</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={mergedTimeline} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={2}>
                  <defs>
                    <linearGradient id="barRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={AC_HEX} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={AC_HEX} stopOpacity={0.3} />
                    </linearGradient>
                    <linearGradient id="barSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="var(--pnl-lilac-soft)" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="var(--pnl-lilac)" stopOpacity={0.25} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={cGrid} />
                  <XAxis dataKey="date" tick={cTick}
                    tickFormatter={(v:string) => v.slice(5)} axisLine={false} tickLine={false}
                    interval={Math.max(0, Math.floor(mergedTimeline.length / 10))} />
                  <YAxis tick={cTick}
                    tickFormatter={(v:number) => `$${(v/1000).toFixed(0)}k`}
                    axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--pnl-panel-2)' }} />
                  <Bar dataKey="revenue" name="Ingresos TN" fill="url(#barRev)"   radius={[3,3,0,0]} />
                  <Bar dataKey="spend"   name="Gasto Meta"  fill="url(#barSpend)" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Tráfico Meta ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">

            {/* Clicks por día */}
            <div className="rounded-2xl border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[10px] uppercase tracking-[0.18em] text-[var(--pnl-text-2)]">Tráfico Meta Ads / día</h3>
                <span className="text-xs font-bold text-[var(--pnl-green-text)]">{NUM(s.clicks)} clicks</span>
              </div>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={tl} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={cGrid2} />
                  <XAxis dataKey="date" tick={cTick2}
                    tickFormatter={(v:string)=>v.slice(5)} axisLine={false} tickLine={false}
                    interval={Math.max(0, Math.floor(tl.length/8))} />
                  <YAxis tick={cTick2}
                    axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'color-mix(in srgb, var(--pnl-green) 30%, transparent)', strokeWidth: 1 }} />
                  <Line type="monotone" dataKey="clicks" name="Clicks"
                    stroke="var(--pnl-green)" strokeWidth={2.5} dot={false}
                    activeDot={{ r: 4, fill: 'var(--pnl-green)', stroke: '#fff', strokeWidth: 1.5 }} />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-3 pt-3 border-t border-[var(--pnl-hair)] flex justify-between text-[10px] text-[var(--pnl-text-3)]">
                <span>Impresiones totales</span>
                <span className="text-[var(--pnl-text-3)]">{NUM(s.impressions)}</span>
              </div>
            </div>

            {/* Fuentes de tráfico — revenue real por canal, ver AttributionSection abajo */}
            <div className="rounded-2xl border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] p-6">
              <h3 className="text-[10px] uppercase tracking-[0.18em] text-[var(--pnl-text-2)] mb-4">Fuentes de tráfico (órdenes)</h3>
              <div className="space-y-3">
                {(data?.channels ?? []).filter(c => c.orders > 0).map(c => {
                  const totOrders = (data?.channels ?? []).reduce((s2, x) => s2 + x.orders, 0)
                  const pct = totOrders > 0 ? (c.orders / totOrders) * 100 : 0
                  return (
                    <div key={c.key}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-[var(--pnl-text-2)] flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: c.color }} />{c.label}
                        </span>
                        <span className="text-[var(--pnl-text)] font-semibold">{c.orders} órdenes ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--pnl-track)] overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: c.color, opacity: 0.7 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-[var(--pnl-hair)] rounded-xl bg-[var(--pnl-panel)] p-3">
                <p className="text-[10px] text-[var(--pnl-text-2)] leading-relaxed">
                  Clasificación por utm/fbclid capturado por Tiendanube al momento del click. Detalle y ROAS real abajo.
                </p>
              </div>
            </div>
          </div>

          {/* ── De dónde viene la gente: revenue real por canal + ROAS Meta real ── */}
          {data && (
            <div className="mb-5">
              <AttributionSection
                channels={data.channels ?? []}
                timeline={data.timeline}
                summary={{ metaSpend: s.metaSpend, roasMetaReal: s.roasMetaReal, roasBlended: s.roasBlended, cacMetaReal: s.cacMetaReal }}
                since={since} until={until} acHex={AC_HEX}
              />
            </div>
          )}

          {/* ── Curiosos: cohortes de visitantes por canal ───────────── */}
          <div className="mb-5">
            <CuriososSection acHex={AC_HEX} />
          </div>

          {/* ── Bottom: LTV ──────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 mb-5">
            <div className="rounded-2xl border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] p-5 md:max-w-md">
              {/* Título con tooltip */}
              <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--pnl-text-3)] mb-4 flex items-center">
                LTV / CAC ratio
                <Ayuda>Mide cuántas veces el valor de vida de un cliente supera lo que costó conseguirlo. Objetivo ≥3x: si gastás $10.000 en ads por cliente, ese cliente debería generar al menos $30.000 en total. Por debajo de 1x estás perdiendo dinero en publicidad.</Ayuda>
              </p>

              {/* Ratio principal */}
              {(() => {
                const ratio = cac > 0 ? s.ltv / cac : 0
                const pct   = Math.min(100, (ratio / 5) * 100)
                const good  = ratio >= 3
                return (
                  <>
                    <div className="flex items-end gap-2 mb-3">
                      <p className={`text-3xl font-bold font-mono ${good ? 'text-[var(--pnl-green-text)]' : ratio > 0 ? 'text-[var(--pnl-amber)]' : 'text-[var(--pnl-text-3)]'}`}>
                        {cac > 0 ? `${ratio.toFixed(1)}x` : '—'}
                      </p>
                      <p className="text-[10px] text-[var(--pnl-text-3)] mb-1">objetivo ≥3x</p>
                    </div>

                    {/* Barra de progreso */}
                    <div className="w-full h-2 rounded-full bg-[var(--pnl-track)] overflow-hidden mb-3">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: good
                            ? 'linear-gradient(90deg,var(--pnl-green),var(--pnl-green-text))'
                            : ratio > 1
                              ? 'linear-gradient(90deg,var(--pnl-amber),var(--pnl-amber-soft))'
                              : 'linear-gradient(90deg,var(--pnl-red),var(--pnl-red-text))',
                        }} />
                    </div>

                    {/* LTV y CAC como valores separados */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--pnl-hair)]">
                      <div>
                        <p className="text-[9px] text-[var(--pnl-text-3)] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                          LTV
                          <Ayuda>Ingreso total histórico promedio por cliente. Calculado sobre todos los clientes registrados desde siempre (no solo el período seleccionado).</Ayuda>
                        </p>
                        <p className="text-sm font-mono font-bold text-[var(--pnl-text)]">{ARS(s.ltv)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-[var(--pnl-text-3)] uppercase tracking-wider mb-0.5 flex items-center gap-1">
                          CAC
                          <Ayuda>Costo de Adquisición de Cliente: gasto total en Meta Ads del período dividido por los nuevos clientes conseguidos.</Ayuda>
                        </p>
                        <p className="text-sm font-mono font-bold text-[var(--pnl-text)]">{cac > 0 ? ARS(cac) : '—'}</p>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>

          {/* ══ SECCIÓN VENTAS POR PRODUCTO ══════════════════════════ */}
          <div className="mb-2">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-[10px] uppercase tracking-[0.2em] text-[var(--pnl-text-2)]">Ventas por producto</h2>
              {selectedProduct && (
                <button onClick={() => setSelectedProduct(null)}
                  className="text-[10px] rounded-lg px-2 py-0.5 transition-colors border"
                  style={{ color: 'var(--pnl-amber)', borderColor: 'color-mix(in srgb, var(--pnl-amber) 25%, transparent)' }}>
                  ✕ limpiar filtro
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              {/* Categorías con acordeón */}
              <div className="lg:col-span-1 rounded-2xl border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--pnl-text-2)]">
                    Por categoría
                  </p>
                  {selectedProduct && (
                    <button onClick={() => setSelectedProduct(null)}
                      className="text-[10px] rounded-lg px-2 py-0.5 transition-colors border"
                  style={{ color: 'var(--pnl-amber)', borderColor: 'color-mix(in srgb, var(--pnl-amber) 25%, transparent)' }}>
                      ✕ limpiar
                    </button>
                  )}
                </div>
                {ordersLoading
                  ? <div className="text-[var(--pnl-text-3)] text-xs py-8 text-center">Cargando...</div>
                  : <CategoryAccordion
                      categories={ordersData?.categories ?? []}
                      totalRevenue={ordersData?.summary.totalRevenue ?? 0}
                      selectedProduct={selectedProduct}
                      onSelectProduct={setSelectedProduct}
                    />
                }
              </div>

              {/* Timeline filtrada por producto */}
              <div className="lg:col-span-2 rounded-2xl border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] p-5">
                <div className="flex items-baseline justify-between mb-4">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--pnl-text-3)]">
                    {selectedProduct ? `Ingresos — ${selectedProduct.slice(0,30)}…` : 'Ingresos totales por día'}
                  </p>
                  <span className="text-xs font-mono font-bold" style={{ color: 'var(--pnl-amber)' }}>
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
                        <stop offset="0%"   stopColor={AC_HEX} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={AC_HEX} stopOpacity={0} />
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
                      contentStyle={{ background:'var(--pnl-panel)', border:`1px solid ${AC_HEX}33`, borderRadius:10, fontSize:11 }}
                      formatter={(v:unknown) => [ARS(Number(v)), 'Ingresos']}
                      cursor={{ stroke:`${AC_HEX}4d`, strokeWidth:1 }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke={AC_HEX} strokeWidth={2}
                      fill="url(#prodGrad)" dot={false}
                      activeDot={{ r:3, fill:'var(--pnl-amber)', strokeWidth:0 }} />
                  </AreaChart>
                </ResponsiveContainer>
                {/* Ticket promedio */}
                <div className="mt-3 pt-3 border-t border-[var(--pnl-hair)] flex justify-between text-[10px] text-[var(--pnl-text-3)]">
                  <span>Ticket promedio</span>
                  <span className="font-mono text-[var(--pnl-text-3)]">{ARS(ordersData?.summary.avgOrderValue ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ══ SECCIÓN MÉTODOS DE PAGO ══════════════════════════════ */}
          <div>
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-[var(--pnl-text-2)] mb-4">Métodos de pago</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Donut */}
              <div className="rounded-2xl border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] p-5">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--pnl-text-3)] mb-4">
                  {selectedProduct ? `Filtrado: ${selectedProduct.slice(0,20)}…` : 'Distribución general'}
                </p>
                {ordersLoading
                  ? <div className="text-[var(--pnl-text-3)] text-xs py-16 text-center">Cargando...</div>
                  : <PaymentDonut data={ordersData?.payments ?? []} />
                }
              </div>

              {/* Tabla detalle */}
              <div className="lg:col-span-2 rounded-2xl border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] p-5">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--pnl-text-3)] mb-4">Detalle por método</p>
                {ordersLoading
                  ? <div className="text-[var(--pnl-text-3)] text-xs py-8 text-center">Cargando...</div>
                  : <div className="space-y-1">
                      {/* Header */}
                      <div className="grid grid-cols-4 text-[10px] uppercase tracking-widest text-[var(--pnl-text-3)] px-3 pb-2 border-b border-[var(--pnl-hair)]">
                        <span className="col-span-2">Método</span>
                        <span className="text-right">Órdenes</span>
                        <span className="text-right">Total</span>
                      </div>
                      {(ordersData?.payments ?? []).map(p => (
                        <div key={p.label}
                          className="grid grid-cols-4 items-center rounded-xl px-3 py-2.5 hover:bg-[var(--pnl-panel-2)] transition-colors group">
                          <div className="col-span-2 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
                            <span className="text-[11px] text-[var(--pnl-text)] truncate">{p.label}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] font-mono text-[var(--pnl-text-3)]">{p.count}</span>
                            <span className="text-[10px] text-[var(--pnl-text-3)] ml-1">({p.pct}%)</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] font-mono text-[var(--pnl-text)]">{ARS(p.revenue)}</span>
                          </div>
                        </div>
                      ))}
                      {/* Total */}
                      <div className="grid grid-cols-4 items-center rounded-xl px-3 py-2.5 border-t border-[var(--pnl-hair)] mt-1 pt-3">
                        <div className="col-span-2 text-[11px] text-[var(--pnl-text-3)] font-medium">Total período</div>
                        <div className="text-right text-[11px] font-mono text-[var(--pnl-text-3)]">
                          {(ordersData?.payments ?? []).reduce((s,p)=>s+p.count,0)}
                        </div>
                        <div className="text-right text-[11px] font-mono font-semibold" style={{ color: 'var(--pnl-amber)' }}>
                          {ARS((ordersData?.payments ?? []).reduce((s,p)=>s+p.revenue,0))}
                        </div>
                      </div>
                    </div>
                }
              </div>
            </div>
          </div>

          {/* ══ RENDIMIENTO DE CANALES ══════════════════════════════ */}
          <div className="mt-8 mb-8">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-[10px] uppercase tracking-[0.2em] text-[var(--pnl-text-3)]">Rendimiento de canales digitales</h2>
            </div>
            <PerformanceSection since={since} until={until} acHex={AC_HEX} />
          </div>

          {/* ══ GASTO CLAUDE (bots IG + WhatsApp) ════════════════════ */}
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-[10px] uppercase tracking-[0.2em] text-[var(--pnl-text-3)]">Gasto de los bots (Claude API)</h2>
            </div>
            <div className="rounded-2xl border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] p-6">
              <div className="flex items-baseline justify-between mb-5 flex-wrap gap-2">
                <h3 className="text-[10px] uppercase tracking-[0.18em] text-[var(--pnl-text-2)] flex items-center">
                  Costo diario por canal · últimos 30 días
                  <Ayuda>Tokens consumidos por los asistentes de Instagram y WhatsApp, convertidos a USD (Haiku 4.5). Se registra en cada respuesta del bot. WhatsApp aparece cuando el bridge esté reconectado.</Ayuda>
                </h3>
                {usage && (
                  <span className="text-[10px] font-mono text-[var(--pnl-text-3)]">
                    total 30d <span className="text-[var(--pnl-green-text)] font-semibold">${usage.totalCost?.toFixed(2) ?? '0.00'}</span>
                    <span className="text-[var(--pnl-text-3)]"> · {usage.totalCalls ?? 0} respuestas</span>
                  </span>
                )}
              </div>
              {usage && usage.series?.length
                ? <ClaudeUsageChart data={usage.series} />
                : <div className="h-[200px] flex items-center justify-center text-[var(--pnl-text-3)] text-xs">
                    {usage ? 'Sin consumo registrado todavía' : 'Cargando...'}
                  </div>
              }
              <p className="text-[9px] text-[var(--pnl-text-3)] mt-2">Prompt caching activo: la base de conocimiento se cachea (~$0.10/M vs $1/M) → costo real muy bajo por respuesta.</p>
            </div>
          </div>

          {/* ══ SECCIÓN HISTÓRICO MENSUAL ════════════════════════════ */}
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-[10px] uppercase tracking-[0.2em] text-[var(--pnl-text-3)]">Análisis histórico — últimos 12 meses</h2>
              {monthlyLoading && <span className="text-[10px] text-[var(--pnl-text-3)] animate-pulse">cargando...</span>}
            </div>

            {/* ── Gráfico 12 meses Revenue / Spend / Neto ── */}
            <div className="rounded-2xl border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] p-6 mb-4">
              <div className="flex items-baseline justify-between mb-5">
                <h3 className="text-[10px] uppercase tracking-[0.18em] text-[var(--pnl-text-2)]">Ingresos · Gasto Meta · Neto mensual</h3>
                {monthly && (
                  <span className="text-[10px] font-mono text-[var(--pnl-text-3)]">
                    acum. {ARS(monthly.series.reduce((s,m)=>s+m.revenue,0))}
                  </span>
                )}
              </div>
              {monthly
                ? <MonthlyRevenueChart data={monthly.series} />
                : <div className="h-[220px] flex items-center justify-center text-[var(--pnl-text-3)] text-xs">Cargando...</div>
              }
            </div>

            {/* ── ROAS + CAC trend | Ticket + Órdenes ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

              <div className="rounded-2xl border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] p-6">
                <h3 className="text-[10px] uppercase tracking-[0.18em] text-[var(--pnl-text-2)] mb-5 flex items-center">ROAS y CAC mensual<Ayuda>ROAS mide el retorno de la inversión publicitaria. CAC es cuánto cuesta adquirir cada cliente nuevo. Si el ROAS baja o el CAC sube mes a mes, los anuncios están perdiendo eficiencia.</Ayuda></h3>
                {monthly
                  ? <RoasCacChart data={monthly.series} />
                  : <div className="h-[180px] flex items-center justify-center text-[var(--pnl-text-3)] text-xs">Cargando...</div>
                }
                <p className="text-[9px] text-[var(--pnl-text-3)] mt-2">ROAS baja = Meta se encarece · CAC sube = cuesta más adquirir cada cliente</p>
              </div>

              <div className="rounded-2xl border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] p-6">
                <h3 className="text-[10px] uppercase tracking-[0.18em] text-[var(--pnl-text-2)] mb-5 flex items-center">Ticket y volumen<Ayuda>Ticket promedio = valor promedio por orden. Órdenes = cantidad de ventas. Si el ticket sube sin más órdenes, estás vendiendo productos más caros. Si suben las órdenes, hay más demanda.</Ayuda></h3>
                {monthly
                  ? <AvgTicketChart data={monthly.series} />
                  : <div className="h-[160px] flex items-center justify-center text-[var(--pnl-text-3)] text-xs">Cargando...</div>
                }
                <p className="text-[9px] text-[var(--pnl-text-3)] mt-2">Ticket baja + órdenes suben = ventas más accesibles · Ticket sube = clientes de mayor valor</p>
              </div>
            </div>

            {/* ── Repeat rate + Resumen mensual tabla ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Repeat rate card */}
              <div className="rounded-2xl border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] p-6">
                <h3 className="text-[10px] uppercase tracking-[0.18em] text-[var(--pnl-text-2)] mb-4 flex items-center">Tasa de recompra<Ayuda>% de clientes únicos que compraron en dos o más meses distintos. Un número alto indica fidelidad y reduce la dependencia de publicidad para generar ventas. Saludable: ≥20%.</Ayuda></h3>
                {monthly ? (
                  <>
                    <div className="flex items-end gap-2 mb-3">
                      <p className={`text-3xl font-bold font-mono ${monthly.repeatRate >= 20 ? 'text-[var(--pnl-green-text)]' : monthly.repeatRate >= 10 ? 'text-[var(--pnl-amber)]' : 'text-[var(--pnl-red-text)]'}`}>
                        {monthly.repeatRate}%
                      </p>
                      <p className="text-[10px] text-[var(--pnl-text-3)] mb-1">de clientes únicos</p>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[var(--pnl-track)] overflow-hidden mb-3">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.min(100, monthly.repeatRate * 2)}%`,
                          background: monthly.repeatRate >= 20 ? 'linear-gradient(90deg,var(--pnl-green),var(--pnl-green-text))'
                                    : monthly.repeatRate >= 10 ? 'linear-gradient(90deg,var(--pnl-amber),var(--pnl-amber-soft))'
                                    : 'linear-gradient(90deg,var(--pnl-red),var(--pnl-red-text))',
                        }} />
                    </div>
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-[var(--pnl-text-3)]">Compraron 2+ meses</span>
                        <span className="font-mono text-[var(--pnl-text)]">{monthly.repeatCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--pnl-text-3)]">Clientes únicos totales</span>
                        <span className="font-mono text-[var(--pnl-text)]">{monthly.totalUnique}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-[var(--pnl-hair)]">
                        <span className="text-[var(--pnl-text-3)] text-[9px]">Objetivo saludable</span>
                        <span className="text-[var(--pnl-text-3)] text-[9px]">≥ 20%</span>
                      </div>
                    </div>
                  </>
                ) : <div className="h-24 flex items-center justify-center text-[var(--pnl-text-3)] text-xs">Cargando...</div>}
              </div>

              {/* Tabla mensual resumen */}
              <div className="lg:col-span-2 rounded-2xl border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] p-6 overflow-x-auto">
                <h3 className="text-[10px] uppercase tracking-[0.18em] text-[var(--pnl-text-2)] mb-4">Resumen por mes</h3>
                {monthly ? (
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-[9px] uppercase tracking-widest text-[var(--pnl-text-3)] border-b border-[var(--pnl-hair)]">
                        <th className="text-left pb-2 font-medium">Mes</th>
                        <th className="text-right pb-2 font-medium">Ingresos</th>
                        <th className="text-right pb-2 font-medium">Meta</th>
                        <th className="text-right pb-2 font-medium">Neto</th>
                        <th className="text-right pb-2 font-medium">ROAS Meta</th>
                        <th className="text-right pb-2 font-medium">ROAS Negocio</th>
                        <th className="text-right pb-2 font-medium">Rev. Meta</th>
                        <th className="text-right pb-2 font-medium">Rev. Org.+Ciego</th>
                        <th className="text-right pb-2 font-medium">Órd.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...monthly.series].reverse().map((m, i) => {
                        const isCurrent = i === 0
                        return (
                          <tr key={m.key}
                            className="border-b border-[var(--pnl-hair)]"
                            style={isCurrent ? { background: 'color-mix(in srgb, var(--pnl-amber) 6%, transparent)' } : undefined}>
                            <td className="py-2 font-mono"
                              style={{ color: isCurrent ? 'var(--pnl-amber)' : 'var(--pnl-text-2)' }}>
                              {m.label} {isCurrent && <span className="text-[9px]" style={{ color: 'color-mix(in srgb, var(--pnl-amber) 65%, transparent)' }}>← actual</span>}
                            </td>
                            <td className="py-2 text-right font-mono text-[var(--pnl-text)]">{ARS(m.revenue)}</td>
                            <td className="py-2 text-right font-mono text-[var(--pnl-text-3)]">{ARS(m.spend)}</td>
                            <td className={`py-2 text-right font-mono font-semibold ${m.net >= 0 ? 'text-[var(--pnl-green-text)]' : 'text-[var(--pnl-red-text)]'}`}>
                              {ARS(m.net)}
                            </td>
                            <td className={`py-2 text-right font-mono ${m.roas >= 3 ? 'text-[var(--pnl-green-text)]' : m.roas > 0 ? 'text-[var(--pnl-amber)]' : 'text-[var(--pnl-text-3)]'}`}
                              title="Revenue confirmado Meta (utm/fbclid) / gasto Meta -- ver lib/attribution.ts">
                              {m.roas > 0 ? `${m.roas}x` : '—'}
                            </td>
                            <td className={`py-2 text-right font-mono ${m.roasBlended >= 3 ? 'text-[var(--pnl-green-text)]' : m.roasBlended > 0 ? 'text-[var(--pnl-amber)]' : 'text-[var(--pnl-text-3)]'}`}
                              title="Ingresos totales TN / gasto Meta -- mezcla venta orgánica, sirve para ver salud general del negocio, NO para decidir presupuesto de ads.">
                              {m.roasBlended > 0 ? `${m.roasBlended}x` : '—'}
                            </td>
                            <td className="py-2 text-right font-mono text-[var(--pnl-amber)]">{ARS(m.metaRevenue)}</td>
                            <td className="py-2 text-right font-mono text-[var(--pnl-green-text)]">{ARS(m.orgCiegoRevenue)}</td>
                            <td className="py-2 text-right font-mono text-[var(--pnl-text-2)]">{m.orders || '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : <div className="h-40 flex items-center justify-center text-[var(--pnl-text-3)] text-xs">Cargando...</div>}
              </div>
            </div>
          </div>
        </>
      )}
    </PanelShell>
  )
}
