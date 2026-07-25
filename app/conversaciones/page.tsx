'use client'

import { useCallback, useEffect, useState } from 'react'
import { SidebarNav } from '@/components/SidebarNav'
import { FondoHolografico } from '@/components/FondoHolografico'

type Mensaje = { ts: string; role: 'user' | 'bot'; text: string; derivar?: boolean; accion?: string }
type Conversacion = {
  sender: string
  nombre: string | null
  ultimoTs: string
  mensajes: Mensaje[]
  derivada: boolean
  manual: boolean
  seguimiento: boolean
  feedback: boolean
  error: boolean
}
type Totales = { conversaciones: number; mensajes: number; derivadas: number; manuales: number; seguimientos: number; feedbacks: number; errores: number }
type Data = { conversaciones: Conversacion[]; totales: Totales; days: number; error?: string }

const RANGOS = [
  { label: 'Hoy', days: 1 },
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
]

// Filtros por categoría. `test` decide si una conversación entra en el filtro.
type FiltroId = 'todos' | 'derivada' | 'seguimiento' | 'manual' | 'feedback' | 'error'
const FILTROS: Array<{ id: FiltroId; label: string; color?: string; test: (c: Conversacion) => boolean }> = [
  { id: 'todos',       label: 'Todos',       test: () => true },
  { id: 'derivada',    label: 'Derivados',   color: '#f59e0b', test: (c) => c.derivada },
  { id: 'seguimiento', label: 'Seguimiento', color: '#60a5fa', test: (c) => c.seguimiento },
  { id: 'manual',      label: 'Manuales',    color: '#34d399', test: (c) => c.manual },
  { id: 'feedback',    label: 'Feedback',    color: '#c084fc', test: (c) => c.feedback },
  { id: 'error',       label: 'Errores',     color: '#f87171', test: (c) => c.error },
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
  const [filtro, setFiltro] = useState<FiltroId>('todos')
  const [q, setQ] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/conversaciones?days=${days}`)
      const json = (await res.json()) as Data
      setData(json)
      // Selección por defecto: la primera (la más reciente)
      setSel((prev) => prev ?? json.conversaciones[0]?.sender ?? null)
    } catch {
      setData({ conversaciones: [], totales: { conversaciones: 0, mensajes: 0, derivadas: 0, manuales: 0, seguimientos: 0, feedbacks: 0, errores: 0 }, days, error: 'No se pudo cargar' })
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { cargar() }, [cargar])

  const todas = data?.conversaciones ?? []
  const t = data?.totales
  const testFiltro = FILTROS.find((f) => f.id === filtro)?.test ?? (() => true)
  const qn = q.trim().toLowerCase()
  const convs = todas.filter((c) => {
    if (!testFiltro(c)) return false
    if (!qn) return true
    if ((c.nombre ?? '').toLowerCase().includes(qn)) return true
    if (c.sender.includes(qn.replace(/\D/g, ''))) return true
    return c.mensajes.some((m) => m.text.toLowerCase().includes(qn))
  })
  const actual = convs.find((c) => c.sender === sel) ?? null
  const conteo = (f: (c: Conversacion) => boolean) => todas.filter(f).length

  return (
    <div className="fx-holo fx-charts relative isolate min-h-screen bg-[#0a0a12] text-white max-lg:pt-14 lg:pl-[256px]">
      <SidebarNav />
      <FondoHolografico />
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

        {/* Filtros por categoría (clickeables) + búsqueda */}
        {t && (
          <div className="mb-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {FILTROS.map((f) => {
                const n = conteo(f.test)
                const activo = filtro === f.id
                return (
                  <button
                    key={f.id}
                    onClick={() => { setFiltro(f.id); setSel(null) }}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition ${
                      activo ? 'border-white/[0.2] bg-white/[0.08] text-white' : 'border-white/[0.06] bg-white/[0.02] text-white/55 hover:text-white/90'
                    }`}
                  >
                    {f.color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: f.color }} />}
                    <span>{f.label}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activo ? 'bg-white/[0.15]' : 'bg-white/[0.06] text-white/50'}`}>{n}</span>
                  </button>
                )
              })}
            </div>
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setSel(null) }}
              placeholder="Buscar por nombre, número o texto del mensaje…"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/[0.2] focus:outline-none sm:max-w-md"
            />
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
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {c.derivada && <Badge color="#f59e0b">derivado</Badge>}
                    {c.seguimiento && <Badge color="#60a5fa">seguimiento</Badge>}
                    {c.manual && <Badge color="#34d399">manual</Badge>}
                    {c.feedback && <Badge color="#c084fc">feedback</Badge>}
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
                  <Responder sender={actual.sender} onEnviado={cargar} />
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

/**
 * Responder al cliente con el número oficial de la marca, sin salir del panel.
 *
 * Antes la única forma de contestar era el link "abrir en WhatsApp", que abre el chat
 * desde el celular de quien atiende: el cliente terminaba hablando con dos números
 * distintos de Micelium en la misma conversación. Acá la respuesta sale del mismo número
 * con el que el bot ya venía hablando.
 *
 * El backend rechaza el envío pasadas 24 h del último mensaje del cliente (límite de
 * WhatsApp, no nuestro) y devuelve el motivo en texto claro, que es lo que se muestra.
 */
function Responder({ sender, onEnviado }: { sender: string; onEnviado: () => void }) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enviar = async () => {
    const cuerpo = texto.trim()
    if (!cuerpo || enviando) return
    setEnviando(true)
    setError(null)
    try {
      const res = await fetch('/api/conversaciones/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender, texto: cuerpo }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string }
      if (json.ok) {
        setTexto('')
        onEnviado()
      } else {
        setError(json.error ?? 'No se pudo enviar')
      }
    } catch {
      setError('No se pudo enviar')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="border-t border-white/[0.06] p-4">
      <div className="flex items-end gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            // Enter manda, Shift+Enter hace salto de línea: como cualquier chat.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void enviar()
            }
          }}
          rows={2}
          placeholder="Responder como Micelium…"
          className="flex-1 resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white/90 placeholder:text-white/25 focus:border-white/20 focus:outline-none"
        />
        <button
          onClick={() => void enviar()}
          disabled={enviando || !texto.trim()}
          className="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-40"
        >
          {enviando ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-amber-300/90">{error}</p>}
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
