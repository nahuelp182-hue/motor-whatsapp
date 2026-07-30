'use client'

// Panel de despachos apícolas: qué se le mandó al tío, si le llegó y si ya despachó.
//
// La pregunta que contesta de un vistazo NO es "¿mandamos el aviso?" sino "¿llegó y
// salió el paquete?". Por eso la columna que manda es la entrega confirmada (acuse de
// WhatsApp) y no el hecho de haber llamado a la API, que puede aceptar un mensaje que
// después nunca se entrega.

import { useCallback, useEffect, useState } from 'react'

type Envio = {
  interno: number
  mlOrderId: string
  fechaCompra: string
  cliente: string
  items: string
  unidades: number
  estado: string
  entregado: boolean
  intentos: number
  detalle: string | null
  enviadoAt: string | null
  despachado: boolean
  avisosTio: number
  escalados: number
  salud: 'ok' | 'atencion' | 'problema'
  motivo: string
}
type MensajeTio = { ts: string; texto: string }
type Resumen = {
  total: number; entregados: number; despachados: number
  problemas: number; atencion: number; unidades: number
}
type Data = { resumen: Resumen; envios: Envio[]; mensajes: MensajeTio[] }

const RANGOS = [
  { label: '24 h', days: 1 },
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
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
  const [days, setDays] = useState(1)
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/apicultura?days=${days}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData((await res.json()) as Data)
    } catch {
      setError('No se pudo cargar')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { cargar() }, [cargar])

  const r = data?.resumen

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-white/[0.08] bg-[#0e0e16] p-1">
          {RANGOS.map((x) => (
            <button
              key={x.days}
              onClick={() => setDays(x.days)}
              className={`rounded-lg px-3 py-1 text-xs transition ${
                days === x.days ? 'bg-white/[0.1] text-white' : 'text-white/50 hover:text-white/80'
              }`}
            >
              {x.label}
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

      {r && (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Tarjeta label="Ventas" valor={r.total} />
          <Tarjeta label="Unidades" valor={r.unidades} />
          <Tarjeta label="Le llegaron al tío" valor={`${r.entregados}/${r.total}`} color={r.entregados === r.total ? '#34d399' : '#f59e0b'} />
          <Tarjeta label="Despachados" valor={`${r.despachados}/${r.total}`} color={r.despachados === r.total ? '#34d399' : undefined} />
          <Tarjeta label="Requieren atención" valor={r.atencion} color={r.atencion ? '#f59e0b' : undefined} />
          <Tarjeta label="Problemas" valor={r.problemas} color={r.problemas ? '#f87171' : undefined} />
        </div>
      )}

      {loading && <p className="text-sm text-white/40">Cargando…</p>}
      {error && <p className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">{error}</p>}

      {!loading && !error && data && data.envios.length === 0 && (
        <p className="rounded-2xl border border-white/[0.06] bg-[#0e0e16] p-6 text-sm text-white/40">
          No hubo ventas apícolas en este período.
        </p>
      )}

      {!loading && data && data.envios.length > 0 && (
        <div className="space-y-2">
          {data.envios.map((e) => (
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
                <Chip ok={e.despachado} texto={e.despachado ? 'Despachado en ML' : 'Sin despachar'} />
                {e.avisosTio > 0 && <Chip neutro texto={`${e.avisosTio} recordatorio${e.avisosTio > 1 ? 's' : ''}`} />}
                {e.escalados > 0 && <Chip alerta texto={`${e.escalados} escalado${e.escalados > 1 ? 's' : ''} a vos`} />}
                {e.intentos > 1 && <Chip neutro texto={`${e.intentos} intentos de envío`} />}
              </div>

              {e.detalle && (
                <div className="mt-2 rounded-lg border border-red-500/20 bg-red-500/5 px-2.5 py-1.5 text-[11px] text-red-300">
                  {e.detalle}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && data && data.mensajes.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-white/80">Lo que contestó el tío</h2>
          <div className="space-y-1.5">
            {data.mensajes.map((m, i) => (
              <div key={`${m.ts}-${i}`} className="rounded-xl border border-white/[0.06] bg-[#0e0e16] p-3">
                <div className="text-[10px] text-white/35">{cuando(m.ts)}</div>
                <div className="mt-0.5 text-sm text-white/75">{m.texto}</div>
              </div>
            ))}
          </div>
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
