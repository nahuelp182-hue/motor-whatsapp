'use client'

import { useCallback, useEffect, useState } from 'react'

type Contador = { enviados: number; fallidos: number; pendientes: number }
type Template = { key: string; name: string; id: string; status: string; category?: string }
type Campana = { tipo: string; is_active: boolean }
type Reciente = { ts: string; tipo_evento: string; estado: string; cliente: string; telefono: string; error: string | null }
type Data = {
  days: number
  porEvento: Record<string, Contador>
  templates: Template[]
  campanas: Campana[]
  recientes: Reciente[]
  error?: string
}

const RANGOS = [
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
  { label: '90 días', days: 90 },
]

const NOMBRE_EVENTO: Record<string, string> = {
  cart_recovery_1: '🛒 Carrito · toque 1',
  cart_recovery_2: '🛒 Carrito · toque 2',
  review_request: '⭐ Reseña post-entrega',
}

const NOMBRE_ESTADO_TEMPLATE: Record<string, { label: string; color: string }> = {
  APPROVED: { label: 'Aprobada', color: '#34d399' },
  PENDING: { label: 'Pendiente de Meta', color: '#f59e0b' },
  REJECTED: { label: 'Rechazada', color: '#f87171' },
  DESCONOCIDO: { label: 'Sin datos', color: '#71717a' },
}

function hora(ts: string): string {
  return new Date(ts).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function telLindo(s: string): string {
  const d = s.replace(/\D/g, '')
  return d ? `+${d}` : s
}

export default function MarketingAutomaticoPage() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/marketing-automatico?days=${days}`)
      const json = (await res.json()) as Data
      setData(json)
    } catch {
      setData({ days, porEvento: {}, templates: [], campanas: [], recientes: [], error: 'No se pudo cargar' })
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { cargar() }, [cargar])

  const eventos = Object.entries(data?.porEvento ?? {})
  const totalEnviados = eventos.reduce((s, [, c]) => s + c.enviados, 0)
  const totalFallidos = eventos.reduce((s, [, c]) => s + c.fallidos, 0)

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Marketing automático · WhatsApp</h1>
            <a href="/dashboard" className="text-xs text-white/40 hover:text-white/70">← Volver al dashboard</a>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
              {RANGOS.map((r) => (
                <button
                  key={r.days}
                  onClick={() => setDays(r.days)}
                  className={`rounded-lg px-3 py-1 text-xs transition ${days === r.days ? 'bg-white/[0.1] text-white' : 'text-white/50 hover:text-white/80'}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button
              onClick={cargar}
              className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-xs text-white/60 hover:text-white"
            >
              ↻ Actualizar
            </button>
          </div>
        </div>

        {loading && <p className="text-sm text-white/40">Cargando…</p>}

        {!loading && data && (
          <>
            {/* KPIs generales */}
            <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Kpi label="Mensajes enviados" value={totalEnviados} accent="#34d399" />
              <Kpi label="Fallidos" value={totalFallidos} accent={totalFallidos ? '#f87171' : undefined} />
              <Kpi label="Campañas activas" value={data.campanas.filter((c) => c.is_active).length} />
              <Kpi
                label="Plantillas aprobadas"
                value={data.templates.filter((t) => t.status === 'APPROVED').length}
                accent="#34d399"
              />
            </div>

            {/* Estado de plantillas */}
            <div className="mb-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <h2 className="mb-3 text-sm font-semibold text-white/80">Estado de plantillas (Meta)</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.templates.map((t) => {
                  const info = NOMBRE_ESTADO_TEMPLATE[t.status] ?? NOMBRE_ESTADO_TEMPLATE.DESCONOCIDO
                  return (
                    <div key={t.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] px-3 py-2">
                      <span className="text-sm text-white/80">{t.name}</span>
                      <span className="rounded px-2 py-0.5 text-xs" style={{ background: `${info.color}22`, color: info.color }}>
                        {info.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Por flujo */}
            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              {Object.entries(NOMBRE_EVENTO).map(([key, label]) => {
                const c = data.porEvento[key] ?? { enviados: 0, fallidos: 0, pendientes: 0 }
                return (
                  <div key={key} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="mb-2 text-sm font-medium text-white/80">{label}</div>
                    <div className="flex gap-4 text-xs text-white/50">
                      <span><span className="text-base font-semibold text-emerald-400">{c.enviados}</span> enviados</span>
                      {c.fallidos > 0 && <span><span className="text-base font-semibold text-red-400">{c.fallidos}</span> fallidos</span>}
                      {c.pendientes > 0 && <span><span className="text-base font-semibold text-amber-400">{c.pendientes}</span> pendientes</span>}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Actividad reciente */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <h2 className="mb-3 text-sm font-semibold text-white/80">Actividad reciente</h2>
              {data.recientes.length === 0 && (
                <p className="text-sm text-white/40">Sin envíos en este período todavía.</p>
              )}
              <div className="space-y-1.5">
                {data.recientes.map((r, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.05] px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-white/70">{NOMBRE_EVENTO[r.tipo_evento] ?? r.tipo_evento}</span>
                      <span className="text-white/40">{r.cliente || telLindo(r.telefono)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.error && <span className="text-red-400" title={r.error}>error</span>}
                      <span
                        className="rounded px-1.5 py-0.5"
                        style={{
                          background: r.estado === 'SENT' ? '#34d39922' : r.estado === 'FAILED' ? '#f8717122' : '#f59e0b22',
                          color: r.estado === 'SENT' ? '#34d399' : r.estado === 'FAILED' ? '#f87171' : '#f59e0b',
                        }}
                      >
                        {r.estado}
                      </span>
                      <span className="text-white/35">{hora(r.ts)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="text-lg font-semibold" style={accent ? { color: accent } : undefined}>{value}</div>
      <div className="text-[11px] text-white/45">{label}</div>
    </div>
  )
}
