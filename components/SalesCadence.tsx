'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import { Ayuda } from '@/components/panel/Primitivos'
import { ChartErrorBoundary } from '@/components/ChartErrorBoundary'

type DayBin    = { date: string; orders: number }
type CadenceData = {
  avg:         { hours: number; label: string } | null
  best:        { hours: number; label: string; date: string } | null
  worst:       { hours: number; label: string; date: string } | null
  lastOrderAt: string | null
  totalOrders: number
  daily:       DayBin[]
  binDays:     number
  error?:      string
}

type Props = {
  since:  string
  until:  string
  acHex?: string
}

function timeSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const h  = Math.floor(ms / 3600000)
  const m  = Math.floor((ms % 3600000) / 60000)
  if (h === 0 && m < 1) return 'hace un momento'
  if (h === 0)          return `${m}min`
  if (m === 0)          return `${h}h`
  return `${h}h ${m}min`
}

function cadenceColor(hours: number): string {
  if (hours <= 6)  return 'var(--pnl-green)'
  if (hours <= 24) return 'var(--pnl-amber)'
  return 'var(--pnl-red)'
}

function tickLabel(date: string, binDays: number): string {
  if (binDays >= 7) return date.slice(5)   // MM-DD
  return date.slice(5)                      // MM-DD
}

export function SalesCadence({ since, until, acHex = 'var(--pnl-amber)' }: Props) {
  const [data,    setData]    = useState<CadenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [, rerender]          = useState(0)

  useEffect(() => {
    setLoading(true)
    setData(null)
    fetch(`/api/sales-cadence?since=${since}&until=${until}`)
      .then(r => r.json() as Promise<CadenceData>)
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [since, until])

  // Actualizar "hace X" cada minuto
  useEffect(() => {
    const t = setInterval(() => rerender(n => n + 1), 60000)
    return () => clearInterval(t)
  }, [])

  const avgColor = data?.avg ? cadenceColor(data.avg.hours) : 'var(--pnl-text-3)'
  // El endpoint devuelve solo { error } cuando falta configuración (ej. TN_ACCESS_TOKEN en
  // una instancia nueva): sin `daily`, un .map directo revienta el componente entero antes
  // de llegar al chequeo de `data.error` de más abajo.
  const maxOrders = data?.daily ? Math.max(...data.daily.map(d => d.orders), 1) : 1

  return (
    <div className="rounded-2xl border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] p-5">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--pnl-text-2)] flex items-center gap-1">
          Cadencia de ventas
          <Ayuda>{'Tiempo promedio entre órdenes en el período seleccionado. Verde ≤6h, naranja ≤24h, rojo >24h. El récord y peor son ventanas de 3 días dentro del período. El gráfico muestra órdenes por día (o semana si el período es largo).'}</Ayuda>
        </p>
        <span className="text-[10px] text-[var(--pnl-text-3)]">{since} → {until}</span>
      </div>

      {loading && (
        <div className="h-24 flex items-center justify-center">
          <span className="text-[11px] text-[var(--pnl-text-3)] animate-pulse">calculando cadencia…</span>
        </div>
      )}

      {!loading && data && !data.error && (
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5">

          {/* ── Stats (izquierda) ───────────────────────────────── */}
          <div className="flex flex-col justify-between gap-4">

            {/* Métrica principal */}
            <div>
              {data.avg ? (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[10px] text-[var(--pnl-text-3)]">cada</span>
                    <span className="text-3xl font-bold font-mono" style={{ color: avgColor }}>
                      {data.avg.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--pnl-text-3)] mt-0.5">
                    promedio del período &middot; {data.totalOrders} órdenes
                  </p>
                </>
              ) : (
                <p className="text-sm text-[var(--pnl-text-3)]">Sin ventas en el período</p>
              )}
            </div>

            {/* Récord / Peor */}
            <div className="space-y-2">
              {data.best && (
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-[var(--pnl-text-3)]">⚡ Récord (3d)</span>
                  <span className="text-[11px] font-mono text-[var(--pnl-green-text)]">{data.best.label}</span>
                </div>
              )}
              {data.worst && (
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-[var(--pnl-text-3)]">↓ Peor (3d)</span>
                  <span className="text-[11px] font-mono text-[var(--pnl-red-text)]/80">{data.worst.label}</span>
                </div>
              )}
              {data.lastOrderAt && (
                <div className="flex justify-between items-center pt-2 border-t border-[var(--pnl-hair)]">
                  <span className="text-[10px] text-[var(--pnl-text-3)]">Última venta</span>
                  <span className="text-[10px] font-mono text-[var(--pnl-text-2)]">
                    hace {timeSince(data.lastOrderAt)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Gráfico de barras (derecha) ─────────────────────── */}
          <div>
            <p className="text-[9px] uppercase tracking-widest text-[var(--pnl-text-3)] mb-2">
              Órdenes por {data.binDays >= 7 ? 'semana' : 'día'}
            </p>
            {data.daily.length > 0 ? (
              <ChartErrorBoundary height={90}>
                <ResponsiveContainer width="100%" height={90}>
                  <BarChart data={data.daily} margin={{ top: 2, right: 2, left: -32, bottom: 0 }} barCategoryGap="15%">
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'var(--pnl-text-3)', fontSize: 9 }}
                      tickFormatter={d => tickLabel(d, data.binDays ?? 1)}
                      axisLine={false} tickLine={false}
                      interval={Math.max(0, Math.floor(data.daily.length / 8))}
                    />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ background: 'var(--pnl-panel)', border: '1px solid var(--pnl-hair)', borderRadius: 8, fontSize: 11 }}
                      formatter={(v: unknown) => [String(v), 'órdenes']}
                      labelFormatter={l => String(l)}
                      cursor={{ fill: 'var(--pnl-panel-2)' }}
                    />
                    <Bar dataKey="orders" radius={[2, 2, 0, 0]} maxBarSize={24}>
                      {data.daily.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.orders >= maxOrders * 0.7 ? acHex : `${acHex}55`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartErrorBoundary>
            ) : (
              <div className="h-[90px] flex items-center justify-center text-[11px] text-[var(--pnl-text-3)]">
                Sin datos para el gráfico
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && (!data || data.error) && (
        <p className="text-[11px] text-[var(--pnl-text-3)] py-4">Sin datos disponibles</p>
      )}
    </div>
  )
}
