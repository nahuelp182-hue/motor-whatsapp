'use client'

// Panel de preguntas de MercadoLibre (MICELIUMSTORE): qué preguntó cada comprador y qué
// le contestó el autoresponder del VPS.
//
// Cada pregunta es una unidad autocontenida de pregunta+respuesta, no una conversación de
// varios turnos como WhatsApp — por eso el layout es una columna de tarjetas expandidas
// (mismo patrón que el panel de apicultura) en vez de lista+hilo.

import { useCallback, useEffect, useMemo, useState } from 'react'

type Pregunta = {
  questionId: string
  itemId: string | null
  itemTitulo: string | null
  compradorNick: string | null
  texto: string
  respuesta: string | null
  estado: string
  motivoBloqueo: string | null
  intent: string | null
  fechaPregunta: string
  fechaRespuesta: string | null
}
type Resumen = {
  total: number
  auto_respondida: number
  pendiente_aprobacion: number
  bloqueada: number
  pendiente: number
  respondida_manual: number
}
type Data = { resumen: Resumen; preguntas: Pregunta[] }

const RANGOS = [
  { label: 'Hoy', days: 1 },
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
]

type FiltroId = 'todas' | 'auto_respondida' | 'pendiente_aprobacion' | 'bloqueada' | 'pendiente'
const FILTROS: Array<{ id: FiltroId; label: string; color?: string; test: (p: Pregunta) => boolean }> = [
  { id: 'todas',                label: 'Todas',                    test: () => true },
  { id: 'auto_respondida',      label: 'Respondidas automáticamente', color: '#34d399', test: (p) => p.estado === 'auto_respondida' || p.estado === 'respondida_manual' },
  { id: 'pendiente_aprobacion', label: 'Pendientes de aprobación', color: '#f59e0b', test: (p) => p.estado === 'pendiente_aprobacion' },
  { id: 'bloqueada',            label: 'Bloqueadas',               color: '#f87171', test: (p) => p.estado === 'bloqueada' },
  { id: 'pendiente',            label: 'Sin responder',            color: '#60a5fa', test: (p) => p.estado === 'pendiente' },
]

const ESTADO_LABEL: Record<string, string> = {
  auto_respondida: 'Auto-respondida',
  pendiente_aprobacion: 'Pendiente de aprobación',
  bloqueada: 'Bloqueada',
  pendiente: 'Sin responder',
  respondida_manual: 'Respondida (aprobada)',
}
const ESTADO_COLOR: Record<string, string> = {
  auto_respondida: '#34d399',
  pendiente_aprobacion: '#f59e0b',
  bloqueada: '#f87171',
  pendiente: '#60a5fa',
  respondida_manual: '#34d399',
}

function cuando(ts: string): string {
  return new Date(ts).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export function PanelPreguntasML() {
  const [days, setDays] = useState(7)
  const [filtro, setFiltro] = useState<FiltroId>('todas')
  const [q, setQ] = useState('')
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [recarga, setRecarga] = useState(0)
  const cargar = useCallback(() => { setLoading(true); setRecarga((n) => n + 1) }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    let vivo = true
    void (async () => {
      try {
        const res = await fetch(`/api/ml-preguntas?days=${days}`, { signal: ctrl.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as Data
        if (!vivo) return
        setData(json)
        setError(null)
      } catch (e) {
        if (!vivo || (e as Error).name === 'AbortError') return
        setError('No se pudo cargar')
        setData(null)
      } finally {
        if (vivo) setLoading(false)
      }
    })()
    return () => { vivo = false; ctrl.abort() }
  }, [days, recarga])

  const todas = data?.preguntas ?? []
  const testFiltro = FILTROS.find((f) => f.id === filtro)?.test ?? (() => true)
  const qn = q.trim().toLowerCase()
  const preguntas = useMemo(() => todas.filter((p) => {
    if (!testFiltro(p)) return false
    if (!qn) return true
    return (
      p.texto.toLowerCase().includes(qn) ||
      (p.respuesta ?? '').toLowerCase().includes(qn) ||
      (p.itemTitulo ?? '').toLowerCase().includes(qn) ||
      (p.compradorNick ?? '').toLowerCase().includes(qn)
    )
  }), [todas, testFiltro, qn])

  const conteo = (f: (p: Pregunta) => boolean) => todas.filter(f).length

  return (
    <div>
      {/* Rango + actualizar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-white/[0.08] bg-[#0e0e16] p-1">
          {RANGOS.map((r) => (
            <button
              key={r.days}
              onClick={() => { setLoading(true); setDays(r.days) }}
              className={`rounded-lg px-3 py-1 text-xs transition ${days === r.days ? 'bg-white/[0.1] text-white' : 'text-white/50 hover:text-white/80'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          onClick={cargar}
          className="rounded-xl border border-white/[0.08] bg-[#0e0e16] px-3 py-1.5 text-xs text-white/60 hover:text-white"
        >
          ↻ Actualizar
        </button>
      </div>

      {/* Filtros por estado + búsqueda */}
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => {
            const n = conteo(f.test)
            const activo = filtro === f.id
            return (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition ${
                  activo ? 'border-white/[0.2] bg-[#1e1e28] text-white' : 'border-white/[0.06] bg-[#0e0e16] text-white/55 hover:text-white/90'
                }`}
              >
                {f.color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: f.color }} />}
                <span>{f.label}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activo ? 'bg-white/[0.15]' : 'bg-[#191922] text-white/50'}`}>{n}</span>
              </button>
            )
          })}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por pregunta, respuesta, publicación o comprador…"
          className="w-full rounded-xl border border-white/[0.08] bg-[#0e0e16] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/[0.2] focus:outline-none sm:max-w-md"
        />
      </div>

      {loading && <p className="text-sm text-white/40">Cargando…</p>}
      {error && <p className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">{error}</p>}

      {!loading && !error && preguntas.length === 0 && (
        <p className="rounded-2xl border border-white/[0.06] bg-[#0e0e16] p-6 text-sm text-white/40">
          {qn ? 'Ninguna pregunta coincide con la búsqueda.' : 'No hubo preguntas en este período.'}
        </p>
      )}

      {!loading && preguntas.length > 0 && (
        <div className="space-y-2">
          {preguntas.map((p) => (
            <div key={p.questionId} className="rounded-2xl border border-white/[0.06] bg-[#0e0e16] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: ESTADO_COLOR[p.estado] ?? '#888' }} />
                    <span className="truncate text-sm font-medium">{p.compradorNick || 'Comprador ML'}</span>
                    <span className="shrink-0 text-[10px] text-white/35">{cuando(p.fechaPregunta)}</span>
                  </div>
                  {p.itemTitulo && <div className="mt-0.5 text-[11px] text-white/35">{p.itemTitulo}</div>}
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
                  style={{ background: `${ESTADO_COLOR[p.estado] ?? '#888'}22`, color: ESTADO_COLOR[p.estado] ?? '#aaa' }}
                >
                  {ESTADO_LABEL[p.estado] ?? p.estado}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                <div className="max-w-[85%] rounded-2xl bg-[#191922] px-3.5 py-2 text-sm text-white/90">
                  <p className="whitespace-pre-wrap break-words">{p.texto}</p>
                </div>
                {p.respuesta && (
                  <div
                    className={`ml-auto max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                      p.estado === 'auto_respondida'
                        ? 'bg-emerald-500/15 text-emerald-50'
                        : 'bg-amber-500/15 text-amber-100'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{p.respuesta}</p>
                    {p.fechaRespuesta && (
                      <div className="mt-1 text-right text-[10px] text-white/35">{cuando(p.fechaRespuesta)}</div>
                    )}
                  </div>
                )}
              </div>

              {p.motivoBloqueo && (
                <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 px-2.5 py-1.5 text-[11px] text-red-300">
                  {p.motivoBloqueo}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
