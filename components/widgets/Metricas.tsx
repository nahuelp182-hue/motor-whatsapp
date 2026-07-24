'use client'

import { useCallback, useEffect, useState } from 'react'
import { PANEL_OSCURO, iconoDe } from './ui'

// Paleta para fondo oscuro (el resto del panel es claro; acá invertimos como el "Sell Order"
// de la referencia). Sage aclarado para que contraste sobre el ink.
const D = {
  card: '#232220',   // tarjetas internas sobre el panel
  linea: '#34332d',  // hairline
  blanco: '#f4f4f1', // texto principal
  muted: '#a3a39c',  // texto secundario
  faint: '#6f6f68',  // texto terciario
  sage: '#93ab82',   // acento sobre oscuro
}

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
    <div
      className="mb-5 rounded-2xl p-5"
      style={{ background: PANEL_OSCURO, boxShadow: '0 8px 24px rgba(23,23,20,0.18)' }}
    >
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-semibold tracking-tight" style={{ color: D.blanco }}>Rendimiento</h2>
        <div className="ml-auto flex gap-1 rounded-lg p-0.5" style={{ background: '#2c2b26' }}>
          {PERIODOS.map(p => (
            <button
              key={p.dias}
              onClick={() => setDias(p.dias)}
              className="rounded-md px-3 py-1.5 text-[12px] font-medium transition-all"
              style={
                dias === p.dias
                  ? { background: D.sage, color: '#1a1a17' }
                  : { color: D.muted }
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {cargando || !t ? (
        <p className="py-6 text-center text-sm" style={{ color: D.faint }}>Cargando…</p>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: 'Vistas', v: num(t.impresion), s: 'veces que se mostró' },
              { k: 'Interacciones', v: num(t.interaccion), s: `${tasa} de las vistas` },
              { k: 'Al carrito', v: num(t.conversion), s: 'sumados desde un widget' },
              { k: 'Movido', v: t.monto > 0 ? pesos(t.monto) : '—', s: 'valor de lo agregado' },
            ].map(m => (
              <div key={m.k} className="rounded-xl p-3.5" style={{ background: D.card }}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: D.faint }}>{m.k}</div>
                <div className="mt-1.5 font-mono text-[26px] font-semibold leading-none" style={{ color: D.blanco }}>{m.v}</div>
                <div className="mt-1.5 text-[12px]" style={{ color: D.muted }}>{m.s}</div>
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
                      background: x.interaccion > 0 ? D.sage : '#3a3933',
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px]" style={{ color: D.faint }}>
              <span>{d.serie[0]?.fecha.slice(5)}</span>
              <span>{d.serie[d.serie.length - 1]?.fecha.slice(5)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            {d.porWidget.filter(w => w.impresion > 0 || w.activo).map(w => (
              <div key={w.id} className="rounded-lg px-3 py-2" style={{ background: D.card }}>
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{iconoDe(w.tipo)}</span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium" style={{ color: D.blanco }}>{w.nombre}</span>
                  {!w.activo && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: D.faint }}>apagado</span>
                  )}
                  <span className="font-mono text-[13px]" style={{ color: D.muted }}>{num(w.impresion)} vistas</span>
                  <span className="w-20 text-right font-mono text-[13px] font-medium" style={{ color: D.blanco }}>
                    {w.interaccion > 0 ? `${num(w.interaccion)} clics` : '—'}
                  </span>
                </div>
                <div className="mt-1.5 h-1 rounded-full" style={{ background: '#3a3933' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(w.impresion / topeW) * 100}%`,
                      background: D.sage,
                    }}
                  />
                </div>
              </div>
            ))}
            {d.porWidget.every(w => w.impresion === 0) && (
              <p className="py-4 text-center text-xs" style={{ color: D.faint }}>
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
