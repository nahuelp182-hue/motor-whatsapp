'use client'

import { useCallback, useEffect, useState } from 'react'
import { SidebarNav } from '@/components/SidebarNav'
import { FondoHolografico } from '@/components/FondoHolografico'
import { PanelApicultura } from '@/components/PanelApicultura'

type Mensaje = {
  ts: string; role: 'user' | 'bot'; text: string; derivar?: boolean; accion?: string
  archivo?: boolean   // imagen/documento que mandó el cliente
  auto?: boolean      // salió de una automatización, no del bot conversando
}
type Conversacion = {
  sender: string
  canal: string
  nombre: string | null
  usuario: string | null
  ultimoTs: string
  mensajes: Mensaje[]
  derivada: boolean
  manual: boolean
  seguimiento: boolean
  feedback: boolean
  error: boolean
}
type Totales = {
  conversaciones: number; mensajes: number; derivadas: number; manuales: number
  seguimientos: number; feedbacks: number; errores: number
  porCanal?: { wa: number; ig: number; messenger: number }
}
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

// Los tres canales por los que puede entrar una conversación. Están acá arriba y no
// escondidos en un condicional porque el panel mostraba SOLO WhatsApp, y por eso el webhook
// de Instagram pudo estar tres semanas mudo sin que nadie lo notara: no había pantalla donde
// se viera su ausencia.
type CanalId = 'todos' | 'wa' | 'ig' | 'messenger'
const CANALES: Array<{ id: CanalId; label: string; color: string }> = [
  { id: 'todos',     label: 'Todos',      color: '#a3a3a0' },
  { id: 'wa',        label: 'WhatsApp',   color: '#25d366' },
  { id: 'ig',        label: 'Instagram',  color: '#e1306c' },
  { id: 'messenger', label: 'Messenger',  color: '#0084ff' },
]
const COLOR_CANAL: Record<string, string> = { wa: '#25d366', ig: '#e1306c', messenger: '#0084ff' }
const NOMBRE_CANAL: Record<string, string> = { wa: 'WhatsApp', ig: 'Instagram', messenger: 'Messenger' }

function hora(ts: string): string {
  return new Date(ts).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

// Cómo se muestra el interlocutor. En WhatsApp es un teléfono; en Instagram y Messenger es
// un identificador interno de Meta que no dice nada, así que se acorta para que no ocupe la
// fila entera fingiendo ser información.
function telLindo(s: string, canal = 'wa'): string {
  if (canal !== 'wa') return `#${s.slice(-6)}`
  const d = s.replace(/\D/g, '')
  return d ? `+${d}` : s
}

export default function ConversacionesPage() {
  // Dos vistas distintas conviven acá: los clientes que atiende el bot y los despachos
  // apícolas al tío. No se mezclan en la misma lista porque no se miran por lo mismo:
  // en una interesa la charla, en la otra si el aviso llegó y si el paquete salió.
  const [vista, setVista] = useState<'bot' | 'apicultura'>('bot')
  const [days, setDays] = useState(1)
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<FiltroId>('todos')
  const [canal, setCanal] = useState<CanalId>('todos')
  const [q, setQ] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/conversaciones?days=${days}`)
      const json = (await res.json()) as Data
      setData(json)
      // Selección por defecto: la primera (la más reciente)
      const primera = json.conversaciones[0]
      setSel((prev) => prev ?? (primera ? `${primera.canal}:${primera.sender}` : null))
    } catch {
      setData({ conversaciones: [], totales: { conversaciones: 0, mensajes: 0, derivadas: 0, manuales: 0, seguimientos: 0, feedbacks: 0, errores: 0 }, days, error: 'No se pudo cargar' })
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { if (vista === 'bot') cargar() }, [cargar, vista])

  const todas = data?.conversaciones ?? []
  const t = data?.totales
  const testFiltro = FILTROS.find((f) => f.id === filtro)?.test ?? (() => true)
  const qn = q.trim().toLowerCase()
  const convs = todas.filter((c) => {
    if (canal !== 'todos' && c.canal !== canal) return false
    if (!testFiltro(c)) return false
    if (!qn) return true
    if ((c.nombre ?? '').toLowerCase().includes(qn)) return true
    if ((c.usuario ?? '').toLowerCase().includes(qn.replace(/^@/, ''))) return true
    if (c.sender.includes(qn.replace(/\D/g, ''))) return true
    return c.mensajes.some((m) => m.text.toLowerCase().includes(qn))
  })
  // La clave lleva el canal: dos plataformas podrían repetir un identificador, y
  // seleccionar el hilo equivocado sería peor que no mostrarlo.
  const claveDe = (c: Conversacion) => `${c.canal}:${c.sender}`
  const actual = convs.find((c) => claveDe(c) === sel) ?? null
  const conteo = (f: (c: Conversacion) => boolean) => todas.filter(f).length

  return (
    <div className="fx-holo fx-charts relative isolate min-h-screen bg-[#0a0a12] text-white max-lg:pt-14 lg:pl-[256px]">
      <SidebarNav />
      <FondoHolografico />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">
              {vista === 'bot'
                ? `Conversaciones del bot${canal === 'todos' ? '' : ` · ${NOMBRE_CANAL[canal]}`}`
                : 'Despachos apícolas · WhatsApp al tío'}
            </h1>
            <a href="/dashboard" className="text-xs text-white/40 hover:text-white/70">← Volver al dashboard</a>
          </div>
          <div className={`flex items-center gap-2 ${vista === 'bot' ? '' : 'hidden'}`}>
            <div className="flex rounded-xl border border-white/[0.08] bg-[#0e0e16] p-1">
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
              className="rounded-xl border border-white/[0.08] bg-[#0e0e16] px-3 py-1.5 text-xs text-white/60 hover:text-white"
            >
              ↻ Actualizar
            </button>
          </div>
        </div>

        {/* Pestañas */}
        <div className="mb-4 flex gap-1 border-b border-white/[0.06]">
          {([['bot', 'Clientes (bot)'], ['apicultura', 'Apicultura']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setVista(id)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
                vista === id
                  ? 'border-white/60 text-white'
                  : 'border-transparent text-white/45 hover:text-white/75'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {vista === 'apicultura' && <PanelApicultura />}

        {/* Filtros por categoría (clickeables) + búsqueda */}
        {vista === 'bot' && t && (
          <div className="mb-4 space-y-3">
            {/* Canal. Es la pregunta más gruesa —por dónde entró— así que pesa distinto que
                los filtros de categoría: tarjetas grandes, color de la plataforma y el número
                bien visible. La primera versión eran píldoras chicas y grises, indistinguibles
                de la fila de abajo; en una pantalla donde el canal es lo que hay que vigilar,
                eso lo volvía invisible. */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CANALES.map((ch) => {
                const activo = canal === ch.id
                const n = ch.id === 'todos'
                  ? (t.porCanal ? t.porCanal.wa + t.porCanal.ig + t.porCanal.messenger : t.conversaciones)
                  : (t.porCanal?.[ch.id] ?? 0)
                return (
                  <button
                    key={ch.id}
                    onClick={() => { setCanal(ch.id); setSel(null) }}
                    style={activo ? { borderColor: ch.color, background: `${ch.color}1a` } : undefined}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
                      activo
                        ? 'text-white shadow-[0_0_0_1px_rgba(255,255,255,0.04)]'
                        : 'border-white/[0.07] bg-[#0e0e16] text-white/55 hover:border-white/[0.16] hover:text-white/90'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: ch.color, boxShadow: activo ? `0 0 8px ${ch.color}` : undefined }}
                      />
                      <span className="truncate text-sm font-medium">{ch.label}</span>
                    </span>
                    <span
                      className="shrink-0 text-lg font-semibold tabular-nums"
                      style={{ color: activo ? ch.color : undefined }}
                    >
                      {n}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.05] pt-3">
              <span className="mr-1 text-[10px] uppercase tracking-widest text-white/25">Categoría</span>
              {FILTROS.map((f) => {
                const n = conteo(f.test)
                const activo = filtro === f.id
                return (
                  <button
                    key={f.id}
                    onClick={() => { setFiltro(f.id); setSel(null) }}
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
              onChange={(e) => { setQ(e.target.value); setSel(null) }}
              placeholder="Buscar por nombre, número o texto del mensaje…"
              className="w-full rounded-xl border border-white/[0.08] bg-[#0e0e16] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/[0.2] focus:outline-none sm:max-w-md"
            />
          </div>
        )}

        {vista === 'bot' && loading && <p className="text-sm text-white/40">Cargando…</p>}
        {vista === 'bot' && !loading && convs.length === 0 && (
          <p className="rounded-2xl border border-white/[0.06] bg-[#0e0e16] p-6 text-sm text-white/40">
            No hay conversaciones en este período.
          </p>
        )}

        {vista === 'bot' && !loading && convs.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
            {/* Lista */}
            <div className={`space-y-1.5 ${actual ? 'hidden lg:block' : ''}`}>
              {convs.map((c) => (
                <button
                  key={claveDe(c)}
                  onClick={() => setSel(claveDe(c))}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    sel === claveDe(c)
                      ? 'border-white/[0.15] bg-[#191922]'
                      : 'border-white/[0.06] bg-[#0e0e16] hover:bg-[#14141c]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ background: COLOR_CANAL[c.canal] ?? '#a3a3a0' }}
                        title={NOMBRE_CANAL[c.canal] ?? c.canal}
                      />
                      <span className="truncate text-sm font-medium">{c.nombre || telLindo(c.sender, c.canal)}</span>
                    </span>
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
            <div className={`rounded-2xl border border-white/[0.06] bg-[#0e0e16] ${actual ? '' : 'hidden lg:block'}`}>
              {actual ? (
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] p-4">
                    <div>
                      <div className="flex items-center gap-1.5 text-sm font-semibold">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ background: COLOR_CANAL[actual.canal] ?? '#a3a3a0' }}
                        />
                        {actual.nombre || telLindo(actual.sender, actual.canal)}
                      </div>
                      {actual.canal === 'wa' ? (
                        <a
                          href={`https://wa.me/${actual.sender.replace(/\D/g, '')}`}
                          target="_blank"
                          className="text-[11px] text-white/40 hover:text-white/70"
                        >
                          {telLindo(actual.sender)} · abrir en WhatsApp ↗
                        </a>
                      ) : (
                        <span className="text-[11px] text-white/40">
                          {actual.usuario ? `@${actual.usuario} · ` : ''}
                          {NOMBRE_CANAL[actual.canal] ?? actual.canal} · se responde desde la app de Meta
                        </span>
                      )}
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
                              ? m.archivo
                                ? 'border border-white/10 bg-[#191922] italic text-white/60'
                                : 'bg-[#191922] text-white/90'
                              : m.auto
                                // Automatización: no es el bot conversando, es un envío
                                // programado. Se distingue para no leerlo como respuesta.
                                ? 'border border-white/10 bg-white/[0.04] italic text-white/55'
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
                  {/* Responder desde el panel solo funciona en WhatsApp: la ruta usa la Cloud
                      API con el número de la marca. Instagram y Messenger se contestan desde
                      la app de Meta, y decirlo es mejor que ofrecer un campo que falla. */}
                  {actual.canal === 'wa' ? (
                    <Responder sender={actual.sender} onEnviado={cargar} />
                  ) : (
                    <div className="border-t border-white/[0.06] p-4 text-xs text-white/40">
                      Desde acá solo se responde por WhatsApp. Este hilo entró por{' '}
                      {NOMBRE_CANAL[actual.canal] ?? actual.canal}: contestalo desde la app de Meta.
                    </div>
                  )}
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
          className="flex-1 resize-none rounded-xl border border-white/[0.08] bg-[#111119] px-3 py-2 text-sm text-white/90 placeholder:text-white/25 focus:border-white/20 focus:outline-none"
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
