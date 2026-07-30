'use client'

// Panel de despachos apícolas: qué se le mandó al tío, si le llegó, si lo abrió y si
// ya despachó.
//
// La pregunta que contesta de un vistazo NO es "¿mandamos el aviso?" sino "¿llegó y
// salió el paquete?". Por eso la señal que manda es la entrega confirmada (acuse de
// WhatsApp) y no el hecho de haber llamado a la API, que puede aceptar un mensaje que
// después nunca se entrega.

import { useCallback, useEffect, useMemo, useState } from 'react'

type Envio = {
  interno: number
  mlOrderId: string
  fechaCompra: string
  cliente: string
  items: string
  unidades: number
  estado: string
  entregado: boolean
  leido: boolean
  mensaje: string | null
  intentos: number
  detalle: string | null
  enviadoAt: string | null
  despachado: boolean
  avisosTio: number
  escalados: number
  salud: 'ok' | 'atencion' | 'problema'
  motivo: string
}
type MensajeHilo = { ts: string; texto: string; propio: boolean }
type Resumen = {
  total: number; entregados: number; leidos: number; despachados: number
  problemas: number; atencion: number; unidades: number
}
type Data = { resumen: Resumen; envios: Envio[]; mensajes: MensajeHilo[] }

const ATAJOS = [
  { label: '24 h', days: 1 },
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
  { label: '1 año', days: 365 },
]

const COLOR: Record<Envio['salud'], string> = {
  ok: '#34d399',
  atencion: '#f59e0b',
  problema: '#f87171',
}

function cuando(ts: string): string {
  return new Date(ts).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

export function PanelApicultura() {
  const [days, setDays] = useState<number | null>(1)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [q, setQ] = useState('')
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // El rango explícito gana sobre el atajo; si no hay ninguno, últimas 24 h.
  const consulta = useMemo(() => (
    desde || hasta
      ? new URLSearchParams({ ...(desde ? { desde } : {}), ...(hasta ? { hasta } : {}) }).toString()
      : new URLSearchParams({ days: String(days ?? 1) }).toString()
  ), [days, desde, hasta])

  // `recarga` fuerza el efecto cuando se toca "Actualizar" sin cambiar el rango.
  const [recarga, setRecarga] = useState(0)
  const cargar = useCallback(() => { setLoading(true); setRecarga((n) => n + 1) }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    let vivo = true
    void (async () => {
      try {
        const res = await fetch(`/api/apicultura?${consulta}`, { signal: ctrl.signal })
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
  }, [consulta, recarga])

  const qn = q.trim().toLowerCase()
  const envios = useMemo(() => {
    const todos = data?.envios ?? []
    if (!qn) return todos
    return todos.filter((e) =>
      e.cliente.toLowerCase().includes(qn) ||
      e.items.toLowerCase().includes(qn) ||
      String(e.interno).includes(qn) ||
      e.mlOrderId.includes(qn) ||
      (e.mensaje ?? '').toLowerCase().includes(qn))
  }, [data, qn])

  const mensajes = useMemo(() => {
    const todos = data?.mensajes ?? []
    if (!qn) return todos
    return todos.filter((m) => m.texto.toLowerCase().includes(qn))
  }, [data, qn])

  const r = data?.resumen
  const usandoRango = Boolean(desde || hasta)

  return (
    <div>
      {/* Rango: atajos + calendario */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-white/[0.08] bg-[#0e0e16] p-1">
          {ATAJOS.map((x) => (
            <button
              key={x.days}
              onClick={() => { setLoading(true); setDesde(''); setHasta(''); setDays(x.days) }}
              className={`rounded-lg px-3 py-1 text-xs transition ${
                !usandoRango && days === x.days ? 'bg-white/[0.1] text-white' : 'text-white/50 hover:text-white/80'
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-[#0e0e16] px-2 py-1">
          <input
            type="date" value={desde} onChange={(e) => { setLoading(true); setDesde(e.target.value) }}
            className="bg-transparent text-xs text-white/70 outline-none [color-scheme:dark]"
            aria-label="Desde"
          />
          <span className="text-xs text-white/30">→</span>
          <input
            type="date" value={hasta} onChange={(e) => { setLoading(true); setHasta(e.target.value) }}
            className="bg-transparent text-xs text-white/70 outline-none [color-scheme:dark]"
            aria-label="Hasta"
          />
          {usandoRango && (
            <button
              onClick={() => { setLoading(true); setDesde(''); setHasta('') }}
              className="ml-1 rounded px-1.5 text-xs text-white/40 hover:text-white/80"
              title="Volver a los atajos"
            >
              ✕
            </button>
          )}
        </div>

        <button
          onClick={cargar}
          className="rounded-xl border border-white/[0.08] bg-[#0e0e16] px-3 py-1.5 text-xs text-white/60 hover:text-white"
        >
          ↻ Actualizar
        </button>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por cliente, artículo, N° de venta, N° de ML o texto del mensaje…"
        className="mb-4 w-full rounded-xl border border-white/[0.08] bg-[#0e0e16] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/[0.2] focus:outline-none sm:max-w-xl"
      />

      {r && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <Tarjeta label="Ventas" valor={r.total} />
          <Tarjeta label="Unidades" valor={r.unidades} />
          <Tarjeta label="Le llegaron al tío" valor={`${r.entregados}/${r.total}`} color={r.entregados === r.total ? '#34d399' : '#f59e0b'} />
          <Tarjeta label="Los abrió" valor={`${r.leidos}/${r.total}`} color={r.leidos === r.total && r.total > 0 ? '#34d399' : undefined} />
          <Tarjeta label="Despachados" valor={`${r.despachados}/${r.total}`} color={r.despachados === r.total ? '#34d399' : undefined} />
          <Tarjeta label="Requieren atención" valor={r.atencion} color={r.atencion ? '#f59e0b' : undefined} />
          <Tarjeta label="Problemas" valor={r.problemas} color={r.problemas ? '#f87171' : undefined} />
        </div>
      )}

      {loading && <p className="text-sm text-white/40">Cargando…</p>}
      {error && <p className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">{error}</p>}

      {!loading && !error && envios.length === 0 && (
        <p className="rounded-2xl border border-white/[0.06] bg-[#0e0e16] p-6 text-sm text-white/40">
          {qn ? 'Ningún envío coincide con la búsqueda.' : 'No hubo ventas apícolas en este período.'}
        </p>
      )}

      {!loading && envios.length > 0 && (
        <div className="space-y-2">
          {envios.map((e) => (
            <div key={e.interno} className="rounded-2xl border border-white/[0.06] bg-[#0e0e16] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: COLOR[e.salud] }} />
                    <span className="text-sm font-semibold">Venta #{e.interno}</span>
                    <span className="truncate text-sm text-white/60">· {e.cliente}</span>
                  </div>
                  <div className="mt-1 text-xs text-white/45">{e.items}</div>
                  <div className="mt-1 text-[11px] text-white/30">
                    Comprado {cuando(e.fechaCompra)} · ML {e.mlOrderId}
                  </div>
                </div>
                <div className="text-right text-[11px]">
                  <div style={{ color: COLOR[e.salud] }}>{e.motivo}</div>
                  {e.enviadoAt && <div className="mt-0.5 text-white/30">Aviso enviado {cuando(e.enviadoAt)}</div>}
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <Chip ok={Boolean(e.enviadoAt)} texto={e.enviadoAt ? 'Aviso enviado' : 'Sin enviar'} />
                <Chip ok={e.entregado} texto={e.entregado ? 'Le llegó al tío' : 'Sin confirmar entrega'} />
                {e.entregado && <Chip ok={e.leido} neutro={!e.leido} texto={e.leido ? 'Lo abrió' : 'Sin abrir'} />}
                <Chip ok={e.despachado} texto={e.despachado ? 'Despachado en ML' : 'Sin despachar'} />
                {e.avisosTio > 0 && <Chip neutro texto={`${e.avisosTio} recordatorio${e.avisosTio > 1 ? 's' : ''}`} />}
                {e.escalados > 0 && <Chip alerta texto={`${e.escalados} escalado${e.escalados > 1 ? 's' : ''} a vos`} />}
                {e.intentos > 1 && <Chip neutro texto={`${e.intentos} intentos de envío`} />}
              </div>

              {/* Lo que el tío ve en su WhatsApp, tal cual (el PDF va aparte). */}
              {e.mensaje && (
                <div className="mt-3">
                  <div className="mb-1 text-[10px] uppercase tracking-wide text-white/30">Lo que recibió el tío</div>
                  <div className="whitespace-pre-wrap rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-3 text-[13px] leading-relaxed text-white/75">
                    {e.mensaje}
                  </div>
                  <div className="mt-1 text-[10px] text-white/25">+ la etiqueta en PDF adjunta</div>
                </div>
              )}

              {e.detalle && (
                <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 px-2.5 py-1.5 text-[11px] text-red-300">
                  {e.detalle}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Hilo mensajes={mensajes} onEnviado={cargar} />
    </div>
  )
}

// Conversación con el tío: lo que contestó y lo que le escribimos desde acá.
function Hilo({ mensajes, onEnviado }: { mensajes: MensajeHilo[]; onEnviado: () => void }) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function enviar() {
    const t = texto.trim()
    if (!t || enviando) return
    setEnviando(true); setErr(null); setAviso(null)
    try {
      const res = await fetch('/api/apicultura/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: t }),
      })
      const j = (await res.json()) as { ok?: boolean; via?: string; error?: string; ayuda?: string }
      if (!res.ok || !j.ok) {
        setErr([j.error ?? 'No se pudo enviar', j.ayuda].filter(Boolean).join(' · '))
      } else {
        setTexto('')
        // Vale decirlo: por plantilla el mensaje le llega con un encabezado fijo.
        setAviso(j.via === 'plantilla'
          ? 'Enviado como plantilla (no tenía conversación abierta): le llega con el encabezado de Micelium.'
          : 'Enviado.')
        onEnviado()
      }
    } catch {
      setErr('No se pudo enviar')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mt-6">
      <h2 className="mb-2 text-sm font-semibold text-white/80">Conversación con el tío</h2>

      <div className="rounded-2xl border border-white/[0.06] bg-[#0e0e16] p-3">
        <div className="flex gap-2">
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') enviar() }}
            placeholder="Escribirle al tío…"
            className="flex-1 rounded-xl border border-white/[0.08] bg-[#14141c] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/[0.2] focus:outline-none"
          />
          <button
            onClick={enviar}
            disabled={enviando || !texto.trim()}
            className="rounded-xl border border-white/[0.1] bg-white/[0.06] px-4 text-sm text-white/80 transition hover:bg-white/[0.12] disabled:opacity-40"
          >
            {enviando ? '…' : 'Enviar'}
          </button>
        </div>
        {aviso && <p className="mt-2 text-[11px] text-emerald-300/80">{aviso}</p>}
        {err && <p className="mt-2 text-[11px] text-red-300">{err}</p>}
      </div>

      {mensajes.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {mensajes.map((m, i) => (
            <div
              key={`${m.ts}-${i}`}
              className={`rounded-xl border p-3 ${
                m.propio
                  ? 'ml-8 border-white/[0.08] bg-[#14141c]'
                  : 'mr-8 border-white/[0.06] bg-[#0e0e16]'
              }`}
            >
              <div className="text-[10px] text-white/35">
                {m.propio ? 'Vos' : 'El tío'} · {cuando(m.ts)}
              </div>
              <div className="mt-0.5 whitespace-pre-wrap text-sm text-white/75">{m.texto}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Tarjeta({ label, valor, color }: { label: string; valor: number | string; color?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0e0e16] px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wide text-white/35">{label}</div>
      <div className="mt-0.5 text-lg font-semibold" style={color ? { color } : undefined}>{valor}</div>
    </div>
  )
}

function Chip({ texto, ok, neutro, alerta }: { texto: string; ok?: boolean; neutro?: boolean; alerta?: boolean }) {
  const estilo = alerta
    ? 'border-red-500/25 bg-red-500/10 text-red-300'
    : neutro
      ? 'border-white/[0.08] bg-white/[0.03] text-white/50'
      : ok
        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
        : 'border-amber-500/25 bg-amber-500/10 text-amber-300'
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] ${estilo}`}>{texto}</span>
}
