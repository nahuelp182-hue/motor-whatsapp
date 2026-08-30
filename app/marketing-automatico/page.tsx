'use client'

import { useCallback, useEffect, useState } from 'react'
import { PanelShell } from '@/components/PanelShell'
import { Banda, Seccion, Tarjeta, Kpi as KpiBase } from '@/components/panel/Primitivos'

type Contador = { enviados: number; fallidos: number; pendientes: number }
type Template = { key: string; name: string; id: string; status: string; category?: string }
type Campana = { tipo: string; is_active: boolean }
type Reciente = { ts: string; tipo_evento: string; estado: string; cliente: string; telefono: string; error: string | null }
type Resena = { ts: string; cliente: string; telefono: string; texto: string }
type Data = {
  days: number
  porEvento: Record<string, Contador>
  templates: Template[]
  campanas: Campana[]
  recientes: Reciente[]
  resenas: Resena[]
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
  APPROVED: { label: 'Aprobada', color: 'var(--pnl-green)' },
  PENDING: { label: 'Pendiente de Meta', color: 'var(--pnl-amber)' },
  REJECTED: { label: 'Rechazada', color: 'var(--pnl-red-text)' },
  DESCONOCIDO: { label: 'Sin datos', color: 'var(--pnl-text-3)' },
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
      setData({ days, porEvento: {}, templates: [], campanas: [], recientes: [], resenas: [], error: 'No se pudo cargar' })
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { cargar() }, [cargar])

  const eventos = Object.entries(data?.porEvento ?? {})
  const totalEnviados = eventos.reduce((s, [, c]) => s + c.enviados, 0)
  const totalFallidos = eventos.reduce((s, [, c]) => s + c.fallidos, 0)

  return (
    <PanelShell
      titulo="Marketing automático"
      sub="WhatsApp"
      accion={
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[var(--pnl-hair)] bg-[var(--pnl-panel-2)] p-1">
            {RANGOS.map((r) => (
              <button
                key={r.days}
                onClick={() => setDays(r.days)}
                aria-pressed={days === r.days}
                className={`min-h-9 rounded-md px-3 text-xs transition-colors ${days === r.days ? 'bg-[var(--pnl-track)] text-[var(--pnl-text)]' : 'text-[var(--pnl-text-3)] hover:text-[var(--pnl-text-2)]'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={cargar}
            className="min-h-9 rounded-lg border border-[var(--pnl-hair)] bg-[var(--pnl-panel-2)] px-3 text-xs text-[var(--pnl-text-2)] hover:text-[var(--pnl-text)]"
          >
            Actualizar
          </button>
        </div>
      }
    >
      {loading && <p className="text-sm text-[var(--pnl-text-3)]">Cargando…</p>}

      {!loading && data && (
        <>
          <Seccion>
            <Banda n="01">Resumen</Banda>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiBase label="Mensajes enviados" valor={String(totalEnviados)} tono="bueno" />
              <KpiBase label="Fallidos" valor={String(totalFallidos)} tono={totalFallidos ? 'malo' : undefined} />
              <KpiBase label="Campañas activas" valor={String(data.campanas.filter((c) => c.is_active).length)} />
              <KpiBase
                label="Plantillas aprobadas"
                valor={String(data.templates.filter((t) => t.status === 'APPROVED').length)}
                tono="bueno"
              />
            </div>
          </Seccion>

          <Seccion>
            <Banda n="02">Estado de plantillas (Meta)</Banda>
            <Tarjeta>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.templates.map((t) => {
                  const info = NOMBRE_ESTADO_TEMPLATE[t.status] ?? NOMBRE_ESTADO_TEMPLATE.DESCONOCIDO
                  return (
                    <div key={t.id} className="flex min-h-11 items-center justify-between rounded-md border border-[var(--pnl-hair)] px-3">
                      <span className="text-sm text-[var(--pnl-text-2)]">{t.name}</span>
                      <span
                        className="rounded px-2 py-0.5 text-xs"
                        style={{ background: `color-mix(in srgb, ${info.color} 15%, transparent)`, color: info.color }}
                      >
                        {info.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </Tarjeta>
          </Seccion>

          <Seccion>
            <Banda n="03">Por flujo</Banda>
            <div className="grid gap-3 sm:grid-cols-3">
              {Object.entries(NOMBRE_EVENTO).map(([key, label]) => {
                const c = data.porEvento[key] ?? { enviados: 0, fallidos: 0, pendientes: 0 }
                return (
                  <Tarjeta key={key}>
                    <div className="mb-2 text-sm font-medium text-[var(--pnl-text-2)]">{label}</div>
                    <div className="flex gap-4 text-xs text-[var(--pnl-text-3)]">
                      <span><span className="num text-base font-semibold text-[var(--pnl-green-text)]">{c.enviados}</span> enviados</span>
                      {c.fallidos > 0 && <span><span className="num text-base font-semibold text-[var(--pnl-red-text)]">{c.fallidos}</span> fallidos</span>}
                      {c.pendientes > 0 && <span><span className="num text-base font-semibold text-[var(--pnl-amber)]">{c.pendientes}</span> pendientes</span>}
                    </div>
                  </Tarjeta>
                )
              })}
            </div>
          </Seccion>

          <Seccion>
            <Banda n="04">Reseñas recibidas ({data.resenas.length})</Banda>
            <Tarjeta>
              {data.resenas.length === 0 && (
                <p className="text-sm text-[var(--pnl-text-3)]">Todavía no llegó ninguna respuesta al pedido de reseña.</p>
              )}
              <div className="flex flex-col gap-2">
                {data.resenas.map((r, i) => (
                  <div key={i} className="rounded-md border border-[var(--pnl-hair)] p-3">
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-[var(--pnl-text-3)]">
                      <span>{r.cliente || telLindo(r.telefono)}</span>
                      <span className="num">{hora(r.ts)}</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-sm text-[var(--pnl-text-2)]">{r.texto}</p>
                  </div>
                ))}
              </div>
            </Tarjeta>
          </Seccion>

          <Seccion>
            <Banda n="05">Actividad reciente</Banda>
            <Tarjeta>
              {data.recientes.length === 0 && (
                <p className="text-sm text-[var(--pnl-text-3)]">Sin envíos en este período todavía.</p>
              )}
              <div className="flex flex-col gap-1.5">
                {data.recientes.map((r, i) => {
                  const colorEstado =
                    r.estado === 'SENT' ? 'var(--pnl-green-text)' :
                    r.estado === 'FAILED' ? 'var(--pnl-red-text)' : 'var(--pnl-amber)'
                  return (
                    <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--pnl-hair)] px-3 py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--pnl-text-2)]">{NOMBRE_EVENTO[r.tipo_evento] ?? r.tipo_evento}</span>
                        <span className="text-[var(--pnl-text-3)]">{r.cliente || telLindo(r.telefono)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.error && <span className="text-[var(--pnl-red-text)]" title={r.error}>error</span>}
                        <span
                          className="rounded px-1.5 py-0.5"
                          style={{ background: `color-mix(in srgb, ${colorEstado} 15%, transparent)`, color: colorEstado }}
                        >
                          {r.estado}
                        </span>
                        <span className="num text-[var(--pnl-text-3)]">{hora(r.ts)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Tarjeta>
          </Seccion>
        </>
      )}
    </PanelShell>
  )
}
