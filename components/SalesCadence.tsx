'use client'

import { useEffect, useRef, useState } from 'react'
import { HelpTip } from './HelpTip'

type CadenceEntry = { hours: number; label: string; date?: string }
type CadenceData = {
  current:     CadenceEntry | null
  best:        CadenceEntry | null
  worst:       CadenceEntry | null
  lastOrderAt: string | null
  ordersIn3d:  number
  error?:      string
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
  if (hours <= 6)  return '#34d399'
  if (hours <= 24) return '#f97316'
  return '#f87171'
}

export function SalesCadence() {
  const [data,    setData]    = useState<CadenceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [, forceUpdate]       = useState(0)
  const dataRef               = useRef<CadenceData | null>(null)

  function load() {
    fetch('/api/sales-cadence')
      .then(r => r.json() as Promise<CadenceData>)
      .then(d => { dataRef.current = d; setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    load()
    const refresh = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(refresh)
  }, [])

  // Redibujar "hace X" cada minuto para que el contador sea live
  useEffect(() => {
    const t = setInterval(() => forceUpdate(n => n + 1), 60000)
    return () => clearInterval(t)
  }, [])

  const color = (data?.current) ? cadenceColor(data.current.hours) : '#6b7280'

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/55 flex items-center gap-1">
          Cadencia de ventas
          <HelpTip text="Tiempo promedio entre órdenes en los últimos 3 días. Verde = muy activo (≤6h), naranja = normal (≤24h), rojo = lento (>24h). Récord y peor son las mejores y peores ventanas de 3 días en los últimos 90 días." />
        </p>
        {loading && <span className="text-[10px] text-white/30 animate-pulse">cargando…</span>}
      </div>

      {!loading && data && !data.error && (
        <div>
          {/* Métrica principal */}
          <div className="mb-4">
            {data.current ? (
              <>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] text-white/30">cada</span>
                  <span className="text-2xl font-bold font-mono" style={{ color }}>
                    {data.current.label}
                  </span>
                </div>
                <p className="text-[10px] text-white/30 mt-0.5">
                  promedio últimas 72h &middot; {data.ordersIn3d} órdenes
                </p>
              </>
            ) : (
              <p className="text-sm text-white/40">Sin ventas en las últimas 72h</p>
            )}
          </div>

          {/* Récord y peor */}
          <div className="space-y-1.5 mb-4">
            {data.best && (
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-white/40">⚡ Récord (3d)</span>
                <span className="font-mono text-emerald-400">{data.best.label}</span>
              </div>
            )}
            {data.worst && (
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-white/40">↓ Peor (3d)</span>
                <span className="font-mono text-red-400/70">{data.worst.label}</span>
              </div>
            )}
          </div>

          {/* Última venta */}
          {data.lastOrderAt && (
            <div className="pt-3 border-t border-white/[0.06] flex justify-between text-[10px]">
              <span className="text-white/30">Última venta</span>
              <span className="text-white/55 font-mono">hace {timeSince(data.lastOrderAt)}</span>
            </div>
          )}
        </div>
      )}

      {!loading && !data && (
        <p className="text-[11px] text-white/30">Sin datos disponibles</p>
      )}
    </div>
  )
}
