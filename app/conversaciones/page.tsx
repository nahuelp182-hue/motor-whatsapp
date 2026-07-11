'use client'

import { useCallback, useEffect, useState } from 'react'

type Mensaje = { ts: string; role: 'user' | 'bot'; text: string; derivar?: boolean; accion?: string }
type Conversacion = {
  sender: string
  nombre: string | null
  ultimoTs: string
  mensajes: Mensaje[]
  derivada: boolean
  manual: boolean
  error: boolean
}
type Totales = { conversaciones: number; mensajes: number; derivadas: number; manuales: number; errores: number }
type Data = { conversaciones: Conversacion[]; totales: Totales; days: number; error?: string }

const RANGOS = [
  { label: 'Hoy', days: 1 },
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
]

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

export default function ConversacionesPage() {
  const [days, setDays] = useState(1)
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/conversaciones?days=${days}`)
      const json = (await res.json()) as Data
      setData(json)
      // Selección por defecto: la primera (la más reciente)
      setSel((prev) => prev ?? json.conversaciones[0]?.sender ?? null)
    } catch {
      setData({ conversaciones: [], totales: { conversaciones: 0, mensajes: 0, derivadas: 0, manuales: 0, errores: 0 }, days, error: 'No se pudo cargar' })
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { cargar() }, [cargar])

  const convs = data?.conversaciones ?? []
  const actual = convs.find((c) => c.sender === sel) ?? null
  const t = data?.totales

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Conversaciones del bot · WhatsApp</h1>
            <a href="/dashboard" className="text-xs text-white/40 hover:text-white/70">← Volver al dashboard</a>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.02] p-1">
              {RANGOS.map((r) => (
                <button
                  key={r.days}
                  onClick={() => { setDays(r.days); setSel(null) }}
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

        {/* KPIs */}
        {t && (
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Kpi label="Chats" value={t.conversaciones} />
            <Kpi label="Mensajes" value={t.mensajes} />
            <Kpi label="Derivados a Mateo" value={t.derivadas} accent="#f59e0b" />
            <Kpi label="Manuales enviados" value={t.manuales} accent="#34d399" />
            <Kpi label="Errores de envío" value={t.errores} accent={t.errores ? '#f87171' : undefined} />
          </div>
        )}

        {loading && <p className="text-sm text-white/40">Cargando…</p>}
        {!loading && convs.length === 0 && (
          <p className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 text-sm text-white/40">
            No hay conversaciones en este período.
          </p>
        )}

        {!loading && convs.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            {/* Lista */}
            <div className={`space-y-1.5 ${actual ? 'hidden lg:block' : ''}`}>
              {convs.map((c) => (
                <button
                  key={c.sender}
                  onClick={() => setSel(c.sender)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    sel === c.sender
                      ? 'border-white/[0.15] bg-white/[0.06]'
                      : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{c.nombre || telLindo(c.sender)}</span>
                    <span className="shrink-0 text-[10px] text-white/35">{hora(c.ultimoTs)}</span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-white/45">
                    {c.mensajes[c.mensajes.length - 1]?.text || ''}
                  </div>
                  <div className="mt-1.5 flex gap-1">
                    {c.derivada && <Badge color="#f59e0b">derivado</Badge>}
                    {c.manual && <Badge color="#34d399">manual</Badge>}
                    {c.error && <Badge color="#f87171">error</Badge>}
                  </div>
                </button>
              ))}
            </div>

            {/* Hilo */}
            <div className={`rounded-2xl border border-white/[0.06] bg-white/[0.02] ${actual ? '' : 'hidden lg:block'}`}>
              {actual ? (
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] p-4">
                    <div>
                      <div className="text-sm font-semibold">{actual.nombre || telLindo(actual.sender)}</div>
                      <a
                        href={`https://wa.me/${actual.sender.replace(/\D/g, '')}`}
                        target="_blank"
                        className="text-[11px] text-white/40 hover:text-white/70"
                      >
                        {telLindo(actual.sender)} · abrir en WhatsApp ↗
                      </a>
                    </div>
                    <button onClick={() => setSel(null)} className="text-xs text-white/40 hover:text-white/70 lg:hidden">
                      ← Lista
                    </button>
                  </div>
                  <div className="space-y-3 p-4">
                    {actual.mensajes.map((m, i) => (
                      <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                            m.role === 'user'
                              ? 'bg-white/[0.06] text-white/90'
                              : m.derivar
                                ? 'bg-amber-500/15 text-amber-100'
                                : 'bg-emerald-500/15 text-emerald-50'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.text}</p>
                          <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-white/35">
                            {m.accion && <span className="rounded bg-white/10 px-1">{m.accion}</span>}
                            <span>{hora(m.ts)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-white/30">
                  Elegí una conversación
                </div>
              )}
            </div>
          </div>
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

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: `${color}22`, color }}>
      {children}
    </span>
  )
}
