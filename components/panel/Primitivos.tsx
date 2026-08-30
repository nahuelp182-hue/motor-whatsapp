'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

// Piezas compartidas del panel. Cada una resuelve algo concreto que el panel
// viejo no tenía; el porqué está en cada componente.

/* ── Banda ────────────────────────────────────────────────────────────────
   Agrupador con línea. Reemplaza el apilado de tarjetas sueltas: sin un
   separador, 25 tarjetas seguidas se leen como una lista sin jerarquía. */
export function Banda({
  n,
  children,
  accion,
}: {
  n: string
  children: ReactNode
  accion?: ReactNode
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="whitespace-nowrap text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--pnl-text-3)]">
        <span className="mr-2 text-[var(--pnl-amber)]">{n}</span>
        {children}
      </span>
      <span className="h-px flex-1 bg-[var(--pnl-hair)]" />
      {accion}
    </div>
  )
}

export function Seccion({ children }: { children: ReactNode }) {
  return <section className="flex flex-col gap-4">{children}</section>
}

/* ── Ayuda ────────────────────────────────────────────────────────────────
   El HelpTip anterior era un <span> con :hover. En el panel había 33 y
   ninguno era alcanzable: sin hover no existen, así que en celular —el 70%
   del uso— las 33 explicaciones eran invisibles. Este es un <button> real:
   funciona con dedo y con teclado. */
export function Ayuda({ children }: { children: string }) {
  const [abierto, setAbierto] = useState(false)
  const id = useId()
  const caja = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!abierto) return
    function fuera(e: MouseEvent) {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false)
    }
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('click', fuera)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('click', fuera)
      document.removeEventListener('keydown', esc)
    }
  }, [abierto])

  return (
    <span ref={caja} className="relative inline-flex shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setAbierto((v) => !v)
        }}
        aria-expanded={abierto}
        aria-describedby={abierto ? id : undefined}
        aria-label="Qué mide esta métrica"
        // El ::after invisible lleva el blanco de toque a 44px sin agrandar
        // el círculo: a 15px es imposible acertarle con el pulgar.
        className="relative grid size-[15px] place-items-center rounded-full bg-[var(--pnl-track)] text-[10px] font-semibold leading-none text-[var(--pnl-text-2)] after:absolute after:left-1/2 after:top-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 hover:bg-[var(--pnl-lilac)] hover:text-white aria-expanded:bg-[var(--pnl-amber)] aria-expanded:text-[#23262F]"
      >
        ?
      </button>
      {abierto && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-[-8px] top-[calc(100%+8px)] z-30 w-[246px] rounded-md border border-[var(--pnl-track)] bg-[#1B1E26] px-4 py-3 text-left text-[12.5px] leading-[1.55] text-[var(--pnl-text-2)] shadow-[0_16px_40px_rgba(0,0,0,.55)]"
        >
          {children}
        </span>
      )}
    </span>
  )
}

/* ── Delta ────────────────────────────────────────────────────────────────
   El triángulo no es decoración: sin él, un +12% y un −11% que ambos son
   buenos (bajar el CAC lo es) se ven idénticos para quien no distingue
   verde de rojo. `invertido` es para métricas donde bajar es mejor. */
export function Delta({ pct, invertido }: { pct: number | null | undefined; invertido?: boolean }) {
  if (pct == null || !Number.isFinite(pct)) return null
  const bueno = invertido ? pct <= 0 : pct >= 0
  const signo = pct >= 0 ? '▲' : '▼'
  return (
    <span
      className={[
        'text-[12px] font-semibold',
        bueno ? 'text-[var(--pnl-green-text)]' : 'text-[var(--pnl-red-text)]',
      ].join(' ')}
    >
      <span className="mr-[3px] text-[9px]" aria-hidden>
        {signo}
      </span>
      {pct > 0 ? '+' : ''}
      {pct.toFixed(0)}%
    </span>
  )
}

/* ── Kpi ──────────────────────────────────────────────────────────────────
   `objetivo` dibuja la barra de meta. Un ROAS de 2,4x solo no dice nada;
   contra un objetivo de 3,0x dice que falta. */
export function Kpi({
  label,
  valor,
  sub,
  delta,
  deltaInvertido,
  ayuda,
  tono,
  objetivo,
  spark,
}: {
  label: string
  valor: string
  sub?: string
  delta?: number | null
  deltaInvertido?: boolean
  ayuda?: string
  tono?: 'bueno' | 'alerta' | 'malo'
  objetivo?: { pct: number; bueno?: boolean }
  spark?: ReactNode
}) {
  const color =
    tono === 'bueno'
      ? 'text-[var(--pnl-green-text)]'
      : tono === 'alerta'
        ? 'text-[var(--pnl-amber)]'
        : tono === 'malo'
          ? 'text-[var(--pnl-red-text)]'
          : ''

  return (
    <div className="flex min-h-[132px] min-w-0 flex-col gap-2 rounded-md border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] p-4">
      <div className="flex items-center gap-2">
        <span className="truncate text-[12px] tracking-[0.04em] text-[var(--pnl-text-3)]">
          {label}
        </span>
        {ayuda && <Ayuda>{ayuda}</Ayuda>}
      </div>

      <div
        className={`num whitespace-nowrap text-[clamp(20px,2.4vw,27px)] font-normal leading-tight ${color}`}
      >
        {valor}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Delta pct={delta} invertido={deltaInvertido} />
        {sub && <span className="text-[12px] text-[var(--pnl-text-3)]">{sub}</span>}
      </div>

      {objetivo && (
        <div className="relative mt-1 h-[3px] rounded-sm bg-[var(--pnl-track)]">
          <div
            className="h-full rounded-sm"
            style={{
              width: `${Math.min(100, Math.max(0, objetivo.pct))}%`,
              background: objetivo.bueno ? 'var(--pnl-green)' : 'var(--pnl-amber)',
            }}
          />
          <div className="absolute -top-0.5 bottom-[-2px] left-full w-[1.5px] rounded-sm bg-[var(--pnl-text-2)]" />
        </div>
      )}

      {spark && <div className="mt-auto">{spark}</div>}
    </div>
  )
}

/* ── Aviso ────────────────────────────────────────────────────────────────
   La banda "Requiere atención". El panel viejo mostraba los datos pero no
   las conclusiones: había que mirar los gráficos para darse cuenta de que
   la frecuencia se fue a 4,2. */
export function Aviso({
  tono = 'neutro',
  children,
  accion,
}: {
  tono?: 'neutro' | 'ok' | 'alerta' | 'malo'
  children: ReactNode
  accion?: ReactNode
}) {
  const borde = {
    neutro: 'border-l-[var(--pnl-text-3)]',
    ok: 'border-l-[var(--pnl-green)]',
    alerta: 'border-l-[var(--pnl-amber)]',
    malo: 'border-l-[var(--pnl-red)]',
  }[tono]

  return (
    <div
      className={`flex items-start gap-3 rounded-md border border-l-2 border-[var(--pnl-hair)] bg-[var(--pnl-panel)] px-4 py-3 text-[13px] text-[var(--pnl-text-2)] ${borde}`}
    >
      <div className="flex-1">{children}</div>
      {accion && <div className="shrink-0">{accion}</div>}
    </div>
  )
}

/* ── Tarjeta ── */
export function Tarjeta({
  titulo,
  unidad,
  accion,
  children,
}: {
  titulo?: string
  unidad?: ReactNode
  accion?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="rounded-md border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] p-5">
      {(titulo || accion) && (
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-4">
          {titulo && <h2 className="text-[13.5px] font-semibold">{titulo}</h2>}
          {unidad && <span className="text-[12px] text-[var(--pnl-text-3)]">{unidad}</span>}
          {accion}
        </div>
      )}
      {children}
    </div>
  )
}

/* ── Estados de datos ─────────────────────────────────────────────────────
   Los tres que el panel no distinguía. El más importante es SinDato: hoy un
   0 se muestra igual cuando se midió cero que cuando no se pudo medir, y no
   son lo mismo. */

export function Cargando({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block animate-pulse rounded bg-[var(--pnl-panel-2)] motion-reduce:animate-none ${className}`}
    />
  )
}

export function Vacio({ titulo, detalle }: { titulo: string; detalle?: string }) {
  return (
    <div className="flex min-h-[148px] flex-col items-center justify-center gap-3 px-5 py-8 text-center">
      <div className="text-[14px] font-medium text-[var(--pnl-text-2)]">{titulo}</div>
      {detalle && (
        <p className="max-w-[34ch] text-[12.5px] leading-[1.55] text-[var(--pnl-text-3)]">
          {detalle}
        </p>
      )}
    </div>
  )
}

/** Un guion, no un cero: el dato no existe o no se puede calcular. */
export function SinDato() {
  return (
    <span className="font-light text-[var(--pnl-text-3)]" title="Sin dato">
      —
    </span>
  )
}

export function ErrorFuente({ que, detalle, onReintentar }: { que: string; detalle?: string; onReintentar?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-l-2 border-[rgba(232,80,58,.28)] border-l-[var(--pnl-red)] bg-[rgba(232,80,58,.07)] p-4">
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-[var(--pnl-text)]">{que}</div>
        {detalle && (
          <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--pnl-text-2)]">{detalle}</p>
        )}
      </div>
      {onReintentar && (
        <button
          onClick={onReintentar}
          className="min-h-9 shrink-0 rounded-full border border-[rgba(232,80,58,.45)] px-3.5 text-[12.5px] font-semibold text-[var(--pnl-red-text)] hover:bg-[rgba(232,80,58,.14)]"
        >
          Reintentar
        </button>
      )}
    </div>
  )
}

/* ── Rubro ────────────────────────────────────────────────────────────────
   Sección colapsable con un resumen de una línea visible siempre, aunque esté
   cerrada. El dashboard antes cargaba las 17 secciones abiertas de una: había
   que scrollear diez pantallas para llegar a "métodos de pago". Colapsado por
   default salvo `abiertoPorDefecto` — el primer rubro (resultado del negocio)
   se pasa siempre abierto porque es lo que se mira todos los días. */
export function Rubro({
  n,
  titulo,
  resumen,
  abiertoPorDefecto = false,
  children,
}: {
  n: string
  titulo: string
  resumen?: ReactNode
  abiertoPorDefecto?: boolean
  children: ReactNode
}) {
  const [abierto, setAbierto] = useState(abiertoPorDefecto)
  const id = useId()

  return (
    <div className="rounded-md border border-[var(--pnl-hair)] bg-[var(--pnl-panel)]">
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        aria-expanded={abierto}
        aria-controls={id}
        className="flex w-full min-h-14 items-center gap-4 px-4 py-3 text-left hover:bg-[var(--pnl-panel-2)] transition-colors"
      >
        <span className="whitespace-nowrap text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--pnl-text-3)]">
          <span className="mr-2 text-[var(--pnl-amber)]">{n}</span>
          {titulo}
        </span>
        {!abierto && resumen && (
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--pnl-text-2)]">{resumen}</span>
        )}
        <span
          aria-hidden
          className={`ml-auto shrink-0 text-[var(--pnl-text-3)] transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`}
        >
          ▾
        </span>
      </button>
      {abierto && (
        <div id={id} className="flex flex-col gap-4 border-t border-[var(--pnl-hair)] p-4">
          {children}
        </div>
      )}
    </div>
  )
}

/* ── Pestañas ─────────────────────────────────────────────────────────────
   Tabs internas de un Rubro para cuando un mismo tema tiene varios
   sub-bloques (ej. "Publicidad y tráfico" = Meta / Atribución / Curiosos).
   Solo se monta el contenido de la pestaña activa: evita que Recharts
   dibuje 3 gráficos pesados cuando el usuario solo está mirando uno. */
export function Pestanas({
  tabs,
  activa,
  onCambiar,
}: {
  tabs: { id: string; label: string }[]
  activa: string
  onCambiar: (id: string) => void
}) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 border-b border-[var(--pnl-hair)] pb-2">
      {tabs.map(t => (
        <button
          key={t.id}
          role="tab"
          aria-selected={activa === t.id}
          onClick={() => onCambiar(t.id)}
          className={[
            'min-h-9 rounded-md px-3 text-[12px] font-medium transition-all border',
            activa === t.id
              ? 'border-[color-mix(in_srgb,var(--pnl-amber)_30%,transparent)] bg-[color-mix(in_srgb,var(--pnl-amber)_15%,transparent)] text-[var(--pnl-amber)]'
              : 'border-transparent text-[var(--pnl-text-3)] hover:text-[var(--pnl-text-2)]',
          ].join(' ')}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
