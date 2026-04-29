'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, LineChart, Line,
} from 'recharts'
import { MetricCard } from '@/components/MetricCard'
import { EcommerceCalendar } from '@/components/EcommerceCalendar'

// ── Types ─────────────────────────────────────────────────────────────────────
type TimelineDay = { date: string; revenue: number; spend: number; clicks: number; net: number }
type Summary = {
  totalRevenue: number; metaSpend: number; netRevenue: number
  newCustomers: number; cac: number; ltv: number
  clicks: number; impressions: number; reach: number; roas: number
}
type Analytics = { period: { since: string; until: string }; summary: Summary; timeline: TimelineDay[] }

// ── Helpers ───────────────────────────────────────────────────────────────────
const ARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
const NUM = (n: number) =>
  new Intl.NumberFormat('es-AR').format(n)

const today  = new Date().toISOString().slice(0, 10)
const y = new Date().getFullYear()
const m = new Date().getMonth() + 1
const pad = (n: number) => String(n).padStart(2, '0')
const monthStart = `${y}-${pad(m)}-01`

const PRESETS = [
  { label: 'Este mes',   since: monthStart, until: today },
  { label: 'Mes ant.',   since: `${m === 1 ? y-1 : y}-${pad(m===1?12:m-1)}-01`, until: `${y}-${pad(m)}-01` },
  { label: '2026',       since: '2026-01-01', until: '2026-12-31' },
  { label: '2025',       since: '2025-01-01', until: '2025-12-31' },
  { label: '2024',       since: '2024-01-01', until: '2024-12-31' },
  { label: 'Todo',       since: '2022-01-01', until: today },
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
  const [since, setSince]       = useState(monthStart)
  const [until, setUntil]       = useState(today)
  const [activePreset, setPreset] = useState('Este mes')
  const [data, setData]         = useState<Analytics | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [chartView, setChartView] = useState<'revenue'|'spend'|'clicks'|'net'>('revenue')

  const load = useCallback(() => {
    setLoading(true); setError(null)
    fetch(`/api/analytics?since=${since}&until=${until}`)
      .then(async r => { if (!r.ok) throw new Error(await r.text()); return r.json() })
      .then((d: Analytics) => { setData(d); setLoading(false) })
      .catch((e: Error) => { setError(e.message); setLoading(false) })
  }, [since, until])

  useEffect(() => { load() }, [load])

  function applyPreset(p: typeof PRESETS[0]) {
    setPreset(p.label); setSince(p.since); setUntil(p.until)
  }

  const s = data?.summary
  const tl = data?.timeline ?? []
  const sparkRevenue = tl.map(d => d.revenue)

  // ── chart view config
  const chartConfig = {
    revenue: { key: 'revenue', label: 'Ingresos',   color: '#f97316' },
    spend:   { key: 'spend',   label: 'Gasto Meta', color: '#818cf8' },
    clicks:  { key: 'clicks',  label: 'Clicks',     color: '#34d399' },
    net:     { key: 'net',     label: 'Neto',        color: '#facc15' },
  }
  const cc = chartConfig[chartView]

  const inputCls = 'rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:border-orange-500/40 transition-colors'
  const btnCls   = (active: boolean) => `px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all ${active ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' : 'text-white/30 hover:text-white/60 border border-transparent'}`

  return (
    <main className="min-h-screen text-white p-5 md:p-8 font-sans"
      style={{ background: 'radial-gradient(ellipse 90% 40% at 50% -5%, rgba(249,115,22,0.07) 0%, transparent 60%), #07070f' }}
    >

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 mb-7 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-orange-400/60 mb-1">Motor WhatsApp</p>
          <h1 className="text-lg font-bold tracking-tight">Panel de métricas</h1>
        </div>

        {/* Controles de fecha */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Presets */}
          <div className="flex gap-1 flex-wrap">
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p)} className={btnCls(activePreset === p.label)}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Rango custom */}
          <div className="flex items-center gap-1">
            <input type="date" value={since} max={until}
              onChange={e => { setSince(e.target.value); setPreset('') }}
              className={inputCls} />
            <span className="text-white/20 text-xs">→</span>
            <input type="date" value={until} min={since} max={today}
              onChange={e => { setUntil(e.target.value); setPreset('') }}
              className={inputCls} />
          </div>
        </div>
      </div>

      {/* ── Period label ────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/20">
          {since} → {until}
        </span>
        {s?.metaSpend ? (
          <><span className="w-px h-3 bg-white/10" />
          <span className="text-[10px] text-orange-400/50">Meta: {ARS(s.metaSpend)}</span></>
        ) : null}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-32 gap-2">
          {[0,150,300].map(d=>(
            <span key={d} className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce" style={{animationDelay:`${d}ms`}} />
          ))}
        </div>
      )}
      {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-red-400/80 text-xs font-mono">{error}</div>}

      {!loading && s && (
        <>
          {/* ── KPI row ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-5">
            <MetricCard label="Ingresos brutos"   value={ARS(s.totalRevenue)} sub={`${s.newCustomers} ventas`} sparkData={sparkRevenue} />
            <MetricCard label="Gasto Meta"         value={ARS(s.metaSpend)}   sub="período seleccionado" />
            <MetricCard
              label="Ingreso neto"
              value={ARS(s.netRevenue)}
              sub="bruto − gasto ads"
              highlight={s.netRevenue > 0}
              sparkData={tl.map(d => d.net)}
            />
            <MetricCard label="ROAS"               value={`${s.roas.toFixed(1)}x`}  sub="revenue / spend" highlight={s.roas >= 3} />
            <MetricCard label="CAC"                value={ARS(s.cac)}          sub="spend / nuevos clientes" />
            <MetricCard label="LTV promedio"       value={ARS(s.ltv)}          sub="lifetime value" highlight={s.ltv > s.cac} sparkData={sparkRevenue} />
            <MetricCard label="Clicks Meta"        value={NUM(s.clicks)}       sub={`${NUM(s.impressions)} impresiones`} sparkData={tl.map(d=>d.clicks)} />
            <MetricCard label="Alcance Meta"       value={NUM(s.reach)}        sub="personas únicas" />
          </div>

          {/* ── Net revenue highlight ───────────────────────────────── */}
          <div className="rounded-2xl border border-orange-500/15 bg-gradient-to-r from-orange-950/30 to-transparent p-5 mb-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 mb-1">Resultado del período</p>
              <p className="text-3xl font-bold" style={{ color: s.netRevenue >= 0 ? '#fb923c' : '#f87171' }}>
                {ARS(s.netRevenue)}
              </p>
              <p className="text-xs text-white/30 mt-1">
                {ARS(s.totalRevenue)} ingresos − {ARS(s.metaSpend)} ads
              </p>
            </div>
            <div className="flex gap-6 text-center">
              <div>
                <p className="text-lg font-bold text-white">{s.roas.toFixed(2)}x</p>
                <p className="text-[10px] text-white/30">ROAS</p>
              </div>
              <div>
                <p className="text-lg font-bold text-white">{ARS(s.cac)}</p>
                <p className="text-[10px] text-white/30">CAC</p>
              </div>
              <div>
                <p className={`text-lg font-bold ${(s.ltv/s.cac)>=3?'text-emerald-400':'text-orange-400'}`}>
                  {s.cac>0?(s.ltv/s.cac).toFixed(1):'-'}x
                </p>
                <p className="text-[10px] text-white/30">LTV/CAC</p>
              </div>
            </div>
          </div>

          {/* ── Main chart ──────────────────────────────────────────── */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 mb-5">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <h3 className="text-[10px] uppercase tracking-[0.18em] text-white/30">
                Evolución del período
              </h3>
              <div className="flex gap-1">
                {(Object.keys(chartConfig) as (keyof typeof chartConfig)[]).map(k => (
                  <button key={k} onClick={() => setChartView(k)}
                    className={btnCls(chartView === k)}>
                    {chartConfig[k].label}
                  </button>
                ))}
              </div>
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={tl} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={cc.color} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={cc.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }}
                  tickFormatter={(v:string) => v.slice(5)} axisLine={false} tickLine={false}
                  interval={Math.max(0, Math.floor(tl.length / 12))} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }}
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

            {/* Combo chart Revenue vs Spend */}
            <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <h3 className="text-[10px] uppercase tracking-[0.18em] text-white/30 mb-5">Ingresos vs Gasto Meta</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={tl} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={2}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }}
                    tickFormatter={(v:string) => v.slice(5)} axisLine={false} tickLine={false}
                    interval={Math.max(0, Math.floor(tl.length / 10))} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }}
                    tickFormatter={(v:number) => `$${(v/1000).toFixed(0)}k`}
                    axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
                  <Bar dataKey="revenue" name="Ingresos"   fill="#f97316" opacity={0.8} radius={[2,2,0,0]} />
                  <Bar dataKey="spend"   name="Gasto Meta" fill="#818cf8" opacity={0.6} radius={[2,2,0,0]} />
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
                <h3 className="text-[10px] uppercase tracking-[0.18em] text-white/30">Tráfico Meta Ads / día</h3>
                <span className="text-xs font-bold text-emerald-400">{NUM(s.clicks)} clicks</span>
              </div>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={tl} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.03)" />
                  <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }}
                    tickFormatter={(v:string)=>v.slice(5)} axisLine={false} tickLine={false}
                    interval={Math.max(0, Math.floor(tl.length/8))} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10 }}
                    axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(52,211,153,0.3)', strokeWidth: 1 }} />
                  <Line type="monotone" dataKey="clicks" name="Clicks"
                    stroke="#34d399" strokeWidth={2} dot={false}
                    activeDot={{ r: 3, fill: '#34d399', strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-3 pt-3 border-t border-white/5 flex justify-between text-[10px] text-white/25">
                <span>Impresiones totales</span>
                <span className="text-white/50">{NUM(s.impressions)}</span>
              </div>
            </div>

            {/* Fuentes de tráfico */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <h3 className="text-[10px] uppercase tracking-[0.18em] text-white/30 mb-4">Fuentes de tráfico</h3>
              <div className="space-y-3">
                {/* Meta Ads */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-white/60 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />Meta Ads (pago)
                    </span>
                    <span className="text-white/80 font-semibold">{NUM(s.clicks)} clicks</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-orange-400/60" style={{ width: '100%' }} />
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
                <p className="text-[10px] text-white/30 leading-relaxed">
                  Para ver orgánico y directo conectá <span className="text-indigo-300">Google Analytics 4</span> con el store ID de GA4.
                </p>
              </div>
            </div>
          </div>

          {/* ── Bottom: Mensajes + LTV barra ────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/25 mb-3">Mensajes WhatsApp</p>
              <div className="flex gap-8">
                <div><p className="text-2xl font-bold text-emerald-400">0</p><p className="text-[10px] text-white/25 mt-1">Enviados</p></div>
                <div><p className="text-2xl font-bold text-red-400/70">0</p><p className="text-[10px] text-white/25 mt-1">Fallidos</p></div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/25 mb-3">LTV / CAC ratio</p>
              <div className="flex items-end gap-2 mb-3">
                <p className={`text-2xl font-bold ${(s.ltv/s.cac)>=3?'text-emerald-400':'text-orange-400'}`}>
                  {s.cac>0?(s.ltv/s.cac).toFixed(1):'-'}x
                </p>
                <p className="text-[10px] text-white/30 mb-0.5">objetivo: ≥3x</p>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, (s.ltv/s.cac/5)*100)}%`,
                    background: (s.ltv/s.cac)>=3 ? 'linear-gradient(90deg,#34d399,#10b981)' : 'linear-gradient(90deg,#f97316,#fb923c)'
                  }} />
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-white/25">
                <span>LTV {ARS(s.ltv)}</span><span>CAC {ARS(s.cac)}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
