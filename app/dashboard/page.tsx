'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { MetricCard } from '@/components/MetricCard'
import { EcommerceCalendar } from '@/components/EcommerceCalendar'

type Store    = { id: string; nombre: string }
type Metrics  = { cac: number; ltv: number; totalRevenue: number; totalCustomers: number; newCustomers: number; whatsappRoi: number }
type Messages = { sent: number; failed: number }
type SalesDay = { date: string; revenue: number }
type ApiResponse = { stores: Store[]; period: { year: number; month: number }; metaSpend: number; metrics: Metrics; messages: Messages; salesByDay: SalesDay[] }

const ARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const now = new Date()
const YEARS = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()]

export default function DashboardPage() {
  const [stores, setStores]   = useState<Store[]>([])
  const [storeId, setStoreId] = useState('all')
  const [year, setYear]       = useState(now.getFullYear())
  const [month, setMonth]     = useState(now.getMonth() + 1)
  const [data, setData]       = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    const p = new URLSearchParams({ year: String(year), month: String(month) })
    if (storeId !== 'all') p.set('storeId', storeId)
    setLoading(true); setError(null)
    fetch('/api/metrics?' + p)
      .then(async r => { if (!r.ok) throw new Error(await r.text()); return r.json() })
      .then((d: ApiResponse) => { setData(d); if (d.stores.length) setStores(d.stores); setLoading(false) })
      .catch((e: Error) => { setError(e.message); setLoading(false) })
  }, [storeId, year, month])

  const m    = data?.metrics
  const msgs = data?.messages
  const sparkRevenue = data?.salesByDay.map(d => d.revenue) ?? []

  const sel = `${MONTHS[(data?.period.month ?? month) - 1]} ${data?.period.year ?? year}`

  const selectCls = [
    'rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm',
    'px-3 py-1.5 text-xs text-white/70 focus:outline-none focus:border-orange-500/40',
    'transition-colors hover:border-white/20 cursor-pointer appearance-none pr-7',
  ].join(' ')

  return (
    <main
      className="min-h-screen text-white p-6 md:p-10 font-sans"
      style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(249,115,22,0.08) 0%, transparent 70%), #080810' }}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5 mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-orange-400/70 mb-1">Motor WhatsApp</p>
          <h1 className="text-xl font-bold tracking-tight text-white">Panel de métricas</h1>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {[
            { value: year, onChange: setYear, options: YEARS.map(y=>({v:y,l:String(y)})) },
            { value: month, onChange: setMonth, options: MONTHS.map((n,i)=>({v:i+1,l:n})) },
          ].map((sel, idx) => (
            <div key={idx} className="relative">
              <select
                value={sel.value}
                onChange={e => sel.onChange(Number(e.target.value))}
                className={selectCls}
              >
                {sel.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/30 text-[10px]">▾</span>
            </div>
          ))}
          <div className="relative">
            <select value={storeId} onChange={e => setStoreId(e.target.value)} className={selectCls}>
              <option value="all">Todas</option>
              {stores.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/30 text-[10px]">▾</span>
          </div>
        </div>
      </div>

      {/* ── Period label ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-[10px] uppercase tracking-[0.18em] text-white/20">{sel}</span>
        {data?.metaSpend ? (
          <>
            <span className="w-px h-3 bg-white/10" />
            <span className="text-[10px] text-orange-400/60">Meta Ads: {ARS(data.metaSpend)}</span>
          </>
        ) : null}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-32 gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-bounce [animation-delay:300ms]" />
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-red-400/80 text-xs font-mono">{error}</div>
      )}

      {!loading && m && (
        <>
          {/* ── KPI grid ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <MetricCard
              label="CAC"
              value={ARS(m.cac)}
              sub="gasto Meta / nuevos"
              sparkData={sparkRevenue}
            />
            <MetricCard
              label="LTV promedio"
              value={ARS(m.ltv)}
              sub="por cliente"
              highlight={m.ltv > m.cac}
              sparkData={sparkRevenue}
            />
            <MetricCard
              label="LTV / CAC"
              value={m.cac > 0 ? `${(m.ltv / m.cac).toFixed(1)}x` : '—'}
              sub="salud del negocio"
              highlight={(m.ltv / m.cac) >= 3}
            />
            <MetricCard
              label="Revenue"
              value={ARS(m.totalRevenue)}
              sub={`${m.newCustomers} clientes nuevos`}
              sparkData={sparkRevenue}
            />
            <MetricCard
              label="Clientes totales"
              value={String(m.totalCustomers)}
              sub="acumulado histórico"
            />
            <MetricCard
              label="ROI Meta"
              value={`${m.whatsappRoi > 0 ? '+' : ''}${m.whatsappRoi.toFixed(0)}%`}
              sub={`${msgs?.sent ?? 0} enviados`}
              highlight={m.whatsappRoi > 0}
            />
          </div>

          {/* ── Main chart + calendar ─────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

            {/* Area chart */}
            <div className="lg:col-span-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
              <div className="flex items-baseline justify-between mb-6">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
                  Ingresos por día — {sel}
                </h3>
                <span className="text-xs font-bold text-orange-400">
                  {ARS(m.totalRevenue)}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data?.salesByDay ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mainGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#f97316" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="0" stroke="rgba(255,255,255,0.03)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10, fontFamily: 'inherit' }}
                    tickFormatter={(v: string) => v.slice(8)}
                    axisLine={false} tickLine={false} interval={2}
                  />
                  <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.2)', fontSize: 10, fontFamily: 'inherit' }}
                    tickFormatter={(v: number) => `$${(v/1000).toFixed(0)}k`}
                    axisLine={false} tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(10,10,20,0.92)',
                      border: '1px solid rgba(249,115,22,0.2)',
                      borderRadius: 12,
                      fontSize: 12,
                      fontFamily: 'inherit',
                    }}
                    labelStyle={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                    formatter={(v: unknown) => [ARS(Number(v)), 'Ingresos']}
                    cursor={{ stroke: 'rgba(249,115,22,0.3)', strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone" dataKey="revenue"
                    stroke="#f97316" strokeWidth={2}
                    fill="url(#mainGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#f97316', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <EcommerceCalendar />
          </div>

          {/* ── Bottom row ───────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Gasto Meta */}
            <div className="rounded-2xl border border-orange-500/10 bg-gradient-to-br from-orange-950/40 to-transparent p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-orange-400/50 mb-3">Gasto Meta Ads</p>
              <p className="text-2xl font-bold text-orange-300">{ARS(data?.metaSpend ?? 0)}</p>
              <p className="text-[10px] text-white/25 mt-1.5">{sel} · CAC: {ARS(m.cac)}</p>
              <div className="mt-4 h-px bg-gradient-to-r from-orange-500/20 to-transparent" />
              <div className="mt-3 flex justify-between text-[10px] text-white/30">
                <span>Nuevos clientes</span>
                <span className="text-white/60 font-semibold">{m.newCustomers}</span>
              </div>
            </div>

            {/* Mensajes */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/25 mb-3">Mensajes WhatsApp</p>
              <div className="flex gap-6 items-end">
                <div>
                  <p className="text-2xl font-bold text-emerald-400">{msgs?.sent ?? 0}</p>
                  <p className="text-[10px] text-white/25 mt-1">Exitosos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-400/80">{msgs?.failed ?? 0}</p>
                  <p className="text-[10px] text-white/25 mt-1">Fallidos</p>
                </div>
              </div>
              <div className="mt-4 h-px bg-white/5" />
              <div className="mt-3 flex justify-between text-[10px] text-white/30">
                <span>Tasa de entrega</span>
                <span className="text-white/60 font-semibold">
                  {((msgs?.sent ?? 0) + (msgs?.failed ?? 0)) > 0
                    ? `${(((msgs?.sent ?? 0) / ((msgs?.sent ?? 0) + (msgs?.failed ?? 0))) * 100).toFixed(0)}%`
                    : '—'}
                </span>
              </div>
            </div>

            {/* LTV health */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/25 mb-3">Salud del negocio</p>
              <div className="flex items-end gap-2">
                <p className={`text-2xl font-bold ${(m.ltv / m.cac) >= 3 ? 'text-emerald-400' : 'text-orange-400'}`}>
                  {m.cac > 0 ? `${(m.ltv / m.cac).toFixed(1)}x` : '—'}
                </p>
                <p className="text-[10px] text-white/30 mb-0.5">LTV / CAC</p>
              </div>
              <div className="mt-3 w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, (m.ltv / m.cac / 5) * 100)}%`,
                    background: (m.ltv / m.cac) >= 3
                      ? 'linear-gradient(90deg, #34d399, #10b981)'
                      : 'linear-gradient(90deg, #f97316, #fb923c)',
                  }}
                />
              </div>
              <div className="mt-3 flex justify-between text-[10px] text-white/25">
                <span>LTV: {ARS(m.ltv)}</span>
                <span>CAC: {ARS(m.cac)}</span>
              </div>
            </div>

          </div>
        </>
      )}
    </main>
  )
}
