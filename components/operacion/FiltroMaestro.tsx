'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarRange } from 'lucide-react'
import {
  PRESETS, PRESET_DEFAULT, RANGO_MAX_DIAS,
  parseRango, rangoDePreset, etiquetaRango, iso,
  type Preset, type Rango,
} from '@/lib/operacion/rango'

// Filtro maestro de fechas. Uno solo para todo Operación.
//
// El rango vive en la URL (?desde=&hasta=) y no en memoria: así el link es compartible, el
// botón atrás del navegador vuelve al rango anterior, y recargar no lo pierde. Y como todas
// las secciones son rutas de verdad (ver Rail), moverse entre pantallas conserva el rango
// sin necesidad de un contexto que las envuelva.
//
// NO usa `useSearchParams` a propósito: en el App Router ese hook obliga a envolver la
// página en <Suspense> o el build de una ruta prerenderizada falla. Son cinco pantallas y
// el requisito se olvida en la sexta. Leer `location.search` y escuchar `popstate` hace lo
// mismo sin ese contrato implícito.

/**
 * El rango vigente. Devuelve `null` en el primer render.
 *
 * Ese null no es pereza: en el servidor no existe `location`, así que si el hook arrancara
 * con el default, cada pantalla haría un fetch de 30 días y otro del rango real apenas
 * hidrata. Devolver null deja que las pantallas esperen y pidan una sola vez.
 */
export function useRangoMaestro() {
  const [rango, setRango] = useState<Rango | null>(null)

  const leer = useCallback(() => {
    const p = new URLSearchParams(window.location.search)
    setRango(parseRango(p.get('desde'), p.get('hasta')))
  }, [])

  useEffect(() => {
    leer()
    // popstate cubre el botón atrás. Sin esto, volver atrás cambia la URL y la pantalla
    // sigue mostrando el rango viejo, que es la peor combinación: la barra dice una cosa y
    // los números dicen otra.
    window.addEventListener('popstate', leer)
    return () => window.removeEventListener('popstate', leer)
  }, [leer])

  const aplicar = useCallback((r: Rango) => {
    const p = new URLSearchParams(window.location.search)
    p.set('desde', r.desde)
    p.set('hasta', r.hasta)
    // pushState y no replaceState: cambiar el rango es una decisión del usuario y merece
    // entrada en el historial, para poder deshacerla con el botón atrás.
    window.history.pushState(null, '', `${window.location.pathname}?${p}`)
    // pushState NO dispara popstate (solo lo hace la navegación del usuario), así que hay
    // que avisar a mano: el Rail arma sus links con el rango vigente y, sin esta señal, se
    // quedaría con el anterior. El síntoma sería silencioso y molesto — cambiás a 14 días,
    // hacés clic en otra sección y volvés a 30 sin que nada lo explique.
    window.dispatchEvent(new PopStateEvent('popstate'))
    setRango(r)
  }, [])

  return { rango, aplicar }
}

export function FiltroMaestro({
  rango, onCambio, nota,
}: {
  rango: Rango | null
  onCambio: (r: Rango) => void
  /** Aclaración de esta pantalla, cuando el rango la afecta de un modo particular. */
  nota?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Al abrir el manual se precargan las fechas vigentes: el punto de partida más útil es lo
  // que ya estás mirando, no dos campos vacíos.
  useEffect(() => {
    if (abierto && rango) { setDesde(rango.desde); setHasta(rango.hasta); setError(null) }
  }, [abierto, rango])

  const hoy = iso(new Date())

  const aplicarManual = useCallback(() => {
    if (!desde || !hasta) { setError('Faltan las dos fechas.'); return }
    if (desde > hasta) { setError('La fecha de inicio es posterior a la de fin.'); return }
    const r = parseRango(desde, hasta)
    // parseRango cae al default ante algo inválido en vez de tirar, así que acá se compara
    // el resultado con lo pedido: si no coincide, el rango se rechazó y hay que decir por
    // qué. Aplicarlo en silencio mostraría 30 días mientras los campos dicen otra cosa.
    if (r.desde !== desde) {
      setError(`Rango no válido. El máximo son ${RANGO_MAX_DIAS} días y no puede empezar en el futuro.`)
      return
    }
    onCambio(r)
    setAbierto(false)
  }, [desde, hasta, onCambio])

  const btn = 'h-10 rounded-full border px-4 text-[13px] font-medium transition-colors'
  const activo = 'border-[var(--pnl-track)] bg-[var(--pnl-panel-2)] text-[var(--pnl-text)]'
  const inactivo = 'border-[var(--pnl-hair)] text-[var(--pnl-text-3)] hover:text-[var(--pnl-text-2)]'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Rango de fechas">
        {PRESETS.map((p: Preset) => (
          <button
            key={p}
            type="button"
            onClick={() => onCambio(rangoDePreset(p))}
            aria-pressed={rango?.preset === p}
            className={`${btn} ${rango?.preset === p ? activo : inactivo}`}
          >
            {p} días
          </button>
        ))}

        <button
          type="button"
          onClick={() => setAbierto(a => !a)}
          aria-expanded={abierto}
          className={`${btn} flex items-center gap-2 ${rango && !rango.preset ? activo : inactivo}`}
        >
          <CalendarRange className="size-4" />
          {rango && !rango.preset ? etiquetaRango(rango) : 'Elegir fechas'}
        </button>

        {rango && (
          <span className="text-[12px] text-[var(--pnl-text-3)]">
            {rango.desde} al {rango.hasta}
          </span>
        )}
      </div>

      {abierto && (
        <div className="flex flex-col gap-3 rounded-md border border-[var(--pnl-hair)] bg-[var(--pnl-panel-2)] p-3 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[var(--pnl-text-3)]">
            Desde
            <input
              type="date" value={desde} max={hasta || hoy}
              onChange={e => { setDesde(e.target.value); setError(null) }}
              className="h-10 rounded-md border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] px-3 text-[13px] normal-case tracking-normal text-[var(--pnl-text)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[var(--pnl-text-3)]">
            Hasta
            <input
              type="date" value={hasta} min={desde} max={hoy}
              onChange={e => { setHasta(e.target.value); setError(null) }}
              className="h-10 rounded-md border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] px-3 text-[13px] normal-case tracking-normal text-[var(--pnl-text)]"
            />
          </label>
          <button
            type="button" onClick={aplicarManual}
            className="h-10 rounded-md border border-[var(--pnl-track)] bg-[var(--pnl-panel)] px-4 text-[13px] font-semibold text-[var(--pnl-text)]"
          >
            Aplicar
          </button>
          <button
            type="button"
            onClick={() => { onCambio(rangoDePreset(PRESET_DEFAULT)); setAbierto(false) }}
            className="h-10 px-2 text-[13px] text-[var(--pnl-text-3)] underline underline-offset-4 hover:text-[var(--pnl-text-2)]"
          >
            Volver a {PRESET_DEFAULT} días
          </button>
          {error && <span className="text-[12px] text-[var(--pnl-red)]">{error}</span>}
        </div>
      )}

      {nota && <p className="text-[12px] leading-relaxed text-[var(--pnl-text-3)]">{nota}</p>}
    </div>
  )
}
