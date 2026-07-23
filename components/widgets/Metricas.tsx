'use client'

import { useCallback, useEffect, useState } from 'react'
import { CARD, iconoDe } from './ui'

// Tablero del motor de widgets: qué se vio, qué se tocó y cuánta plata movió cada uno.
//
// Es la razón principal para tener motor propio y no una app de terceros: sin esto los
// widgets se acumulan "por las dudas" y nadie sabe cuál sirve. Con esto se puede apagar.

type Tot = { impresion: number; interaccion: number; conversion: number; monto: number }
type Dia = Tot & { fecha: string }
type Fila = Tot & { id: string; nombre: string; tipo: string; activo: boolean; contexto: string }
type Datos = { dias: number; total: Tot; activos: number; serie: Dia[]; porWidget: Fila[] }

const PERIODOS = [
  { dias: 1, label: 'Hoy' },
  { dias: 7, label: '7 días' },
  { dias: 30, label: '30 días' },
  { dias: 90, label: '90 días' },
]

const num = (n: number) => n.toLocaleString('es-AR')
const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-AR')

export function Metricas() {
  const [dias, setDias] = useState(7)
  const [d, setD] = useState<Datos | null>(null)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    const r = await fetch(`/api/widgets/metricas?dias=${dias}`)
    setD(await r.json())
    setCargando(false)
  }, [dias])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const t = d?.total
  // La tasa de interacción es lo único comparable entre widgets: las impresiones dependen
  // de en cuántas páginas esté puesto, no de si funciona.
  const tasa = t && t.impresion > 0 ? ((t.interaccion / t.impresion) * 100).toFixed(1) + '%' : '—'
  const tope = Math.max(1, ...(d?.serie ?? []).map(x => x.impresion))
  const topeW = Math.max(1, ...(d?.porWidget ?? []).map(x => x.impresion))

  return (
    <div className={`${CARD} mb-5 p-4`}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/55">
          Rendimiento
        </span>
        <div className="ml-auto flex gap-1 rounded-lg bg-white/[0.04] p-0.5">
          {PERIODOS.map(p => (
            <button
              key={p.dias}
              onClick={() => setDias(p.dias)}
              className="rounded-md px-2.5 py-1 text-[11px] font-medium transition-all"
              style={
                dias === p.dias
                  ? { background: 'rgb(var(--ac) / 0.18)', color: 'rgb(var(--ac))' }
                  : { color: 'rgba(255,255,255,0.45)' }
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {cargando || !t ? (
        <p className="py-6 text-center text-sm text-white/35">Cargando…</p>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: 'Vistas', v: num(t.impresion), s: 'veces que se mostró' },
              { k: 'Interacciones', v: num(t.interaccion), s: `${tasa} de las vistas` },
              { k: 'Al carrito', v: num(t.conversion), s: 'sumados desde un widget' },
              { k: 'Movido', v: t.monto > 0 ? pesos(t.monto) : '—', s: 'valor de lo agregado' },
            ].map(m => (
              <div key={m.k} className="rounded-xl bg-white/[0.03] p-3">
                <div className="text-[10px] uppercase tracking-[0.12em] text-white/45">{m.k}</div>
                <div className="mt-1 text-xl font-semibold text-white">{m.v}</div>
                <div className="mt-0.5 text-[11px] text-white/35">{m.s}</div>
              </div>
            ))}
          </div>

          {/* Barras y no una curva: con pocos días una línea insinúa una tendencia que los
              datos no sostienen. */}
          <div className="mb-5">
            <div className="flex h-24 items-end gap-1">
              {d.serie.map(x => (
                <div key={x.fecha} className="group relative flex-1" title={`${x.fecha}: ${num(x.impresion)} vistas`}>
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${Math.max(2, (x.impresion / tope) * 96)}px`,
                      background: x.interaccion > 0 ? 'rgb(var(--ac) / 0.75)' : 'rgba(255,255,255,0.12)',
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-white/30">
              <span>{d.serie[0]?.fecha.slice(5)}</span>
              <span>{d.serie[d.serie.length - 1]?.fecha.slice(5)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            {d.porWidget.filter(w => w.impresion > 0 || w.activo).map(w => (
              <div key={w.id} className="rounded-lg bg-white/[0.03] px-3 py-2">
                <div className="flex items-center gap-2">
                  <span>{iconoDe(w.tipo)}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-white/85">{w.nombre}</span>
                  {!w.activo && (
                    <span className="text-[10px] uppercase tracking-wider text-white/30">apagado</span>
                  )}
                  <span className="text-[12px] text-white/55">{num(w.impresion)} vistas</span>
                  <span className="w-20 text-right text-[12px] text-white/75">
                    {w.interaccion > 0 ? `${num(w.interaccion)} clics` : '—'}
                  </span>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(w.impresion / topeW) * 100}%`,
                      background: 'rgb(var(--ac) / 0.6)',
                    }}
                  />
                </div>
              </div>
            ))}
            {d.porWidget.every(w => w.impresion === 0) && (
              <p className="py-4 text-center text-xs text-white/35">
                Todavía no hay datos en este período. Se registran solos cuando un visitante ve
                un widget prendido.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
