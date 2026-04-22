'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { MetricCard } from '@/components/MetricCard'
import { EcommerceCalendar } from '@/components/EcommerceCalendar'

type Store = { id: string; nombre: string }
type Metrics = {
  cac: number; ltv: number; totalRevenue: number
  totalCustomers: number; newCustomers: number; whatsappRoi: number
}
type Messages = { sent: number; failed: number }
type SalesDay = { date: string; revenue: number }
type ApiResponse = { stores: Store[]; metrics: Metrics; messages: Messages; salesByDay: SalesDay[] }

const ARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

export default function DashboardPage() {
  const [stores, setStores] = useState<Store[]>([])
  const [storeId, setStoreId] = useState<string>('all')
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const url = storeId === 'all' ? '/api/metrics' : `/api/metrics?storeId=${storeId}`
    setLoading(true)
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${await r.text()}`)
        return r.json()
      })
      .then((d: ApiResponse) => {
        setData(d)
        if (d.stores.length) setStores(d.stores)
        setLoading(false)
      })
      .catch((e: Error) => {
        setError(e.message)
        setLoading(false)
      })
  }, [storeId])

  const m = data?.metrics
  const msgs = data?.messages

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white p-6 md:p-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Motor WhatsApp</h1>
          <p className="text-sm text-white/40 mt-1">Dashboard de métricas</p>
        </div>

        {/* Store selector */}
        <select
          value={storeId}
          onChange={(e) => setStoreId(e.target.value)}
          className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/20"
        >
          <option value="all">Todas las tiendas</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="text-white/30 text-center py-20">Cargando métricas...</div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-400 text-sm font-mono break-all">
          {error}
        </div>
      )}

      {!loading && m && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <MetricCard
              label="CAC"
              value={ARS(m.cac)}
              sub="por nuevo cliente"
            />
            <MetricCard
              label="LTV promedio"
              value={ARS(m.ltv)}
              sub="por cliente"
              highlight={m.ltv > m.cac}
            />
            <MetricCard
              label="LTV / CAC"
              value={m.cac > 0 ? `${(m.ltv / m.cac).toFixed(1)}x` : '—'}
              sub="ratio salud"
              highlight={(m.ltv / m.cac) >= 3}
            />
            <MetricCard
              label="Ingresos totales"
              value={ARS(m.totalRevenue)}
              sub={`${m.totalCustomers} clientes`}
            />
            <MetricCard
              label="Nuevos (30d)"
              value={String(m.newCustomers)}
              sub="clientes nuevos"
            />
            <MetricCard
              label="ROI WhatsApp"
              value={`${m.whatsappRoi.toFixed(0)}%`}
              sub={`${msgs?.sent ?? 0} enviados / ${msgs?.failed ?? 0} fallidos`}
              highlight={m.whatsappRoi > 0}
            />
          </div>

          {/* Gráfico ventas + Calendario */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Area chart ventas 30d */}
            <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6">
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-6">
                Ingresos últimos 30 días
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data?.salesByDay ?? []}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                    tickFormatter={(v: string) => v.slice(5)}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                    tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                    axisLine={false} tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                    labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
                    formatter={(v) => [ARS(Number(v)), 'Ingresos']}
                  />
                  <Area
                    type="monotone" dataKey="revenue"
                    stroke="#34d399" strokeWidth={2}
                    fill="url(#grad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Calendario */}
            <EcommerceCalendar />
          </div>

          {/* WhatsApp breakdown */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6">
              <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Mensajes enviados</p>
              <div className="flex gap-6">
                <div>
                  <p className="text-3xl font-bold text-emerald-400">{msgs?.sent ?? 0}</p>
                  <p className="text-xs text-white/30 mt-1">Exitosos</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-red-400">{msgs?.failed ?? 0}</p>
                  <p className="text-xs text-white/30 mt-1">Fallidos</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6">
              <p className="text-xs text-white/40 uppercase tracking-widest mb-3">Clientes totales</p>
              <p className="text-3xl font-bold text-white">{m.totalCustomers}</p>
              <p className="text-xs text-white/30 mt-1">
                LTV total: {ARS(m.totalRevenue)}
              </p>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
