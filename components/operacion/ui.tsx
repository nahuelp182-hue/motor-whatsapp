'use client'

import type { ReactNode } from 'react'
import { TriangleAlert, PackageCheck, RotateCw } from 'lucide-react'
import { CARD, SECCION, SECCION_SUB, EYEBROW } from '@/components/widgets/ui'

// Piezas del panel de Operación.
//
// UN COLOR POR DOMINIO, sobre los tokens que el panel ya tiene. El diseño original traía
// cinco colores propios (cian, naranja, lima, azul, violeta); adoptarlos habría dejado el
// panel con dos paletas — ámbar en Métricas, cian en Operación — y dos paletas sin
// sincronizar es una clase de bug que en este repo ya volvió: el color se cambia en un
// lado y en el otro queda texto invisible, sin error de compilación que lo delate.
// Se conserva la IDEA (cada dominio siempre del mismo color) con los tokens de acá.
//
// EL ROJO NO ES COLOR DE DOMINIO. Se reserva para lo crítico: si Logística fuera roja, una
// alerta roja sobre fondo de Logística no se distinguiría de la decoración.
export const DOMINIO = {
  web: { color: 'var(--pnl-lilac-soft)', nombre: 'Tiendanube' },
  ml: { color: 'var(--pnl-amber)', nombre: 'MercadoLibre' },
  prod: { color: 'var(--pnl-green)', nombre: 'Producción' },
  log: { color: 'var(--pnl-teal)', nombre: 'Logística' },
  crm: { color: 'var(--pnl-lilac)', nombre: 'Adquisición' },
} as const
export type Dominio = keyof typeof DOMINIO

/** Semánticos. Separados del dominio a propósito: dicen gravedad, no de qué se habla. */
export const TONO = {
  ok: 'var(--pnl-green-text)',
  warn: 'var(--pnl-amber)',
  crit: 'var(--pnl-red-text)',
  neutro: 'var(--pnl-text-3)',
} as const
export type Tono = keyof typeof TONO

// ── Formato ─────────────────────────────────────────────────────────────────
// Todo el panel es en pesos argentinos y con coma decimal. Centralizado acá porque un
// `toFixed(1)` suelto en una pantalla y un `toLocaleString` en otra ya producen dos
// formatos distintos para el mismo número.

export const ars = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

export const dec = (n: number, d = 1) =>
  new Intl.NumberFormat('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n)

export const num = (n: number) => new Intl.NumberFormat('es-AR').format(n)

/* ── Estados de una tarjeta ───────────────────────────────────────────────────
   Los cinco se diseñan ahora y no después. La primera caída de Andreani no puede dejar la
   pantalla en blanco, y un cero real no se muestra igual que un dato que no llegó.

   - normal      el dato está
   - cargando    esqueleto que MANTIENE el alto: al llegar el dato nada se corre de lugar
   - vacio       afirma un hecho ("ningún envío demorado"), no una tarjeta en blanco
   - error       dice qué falló y cuál fue el último dato bueno, nunca un mensaje genérico
   - sin_fuente  el dato no existe todavía y se dice qué falta para tenerlo. Es el estado
                 honesto para las tarjetas que el diseño pide pero el sistema aún no puede
                 calcular; la alternativa —dejar el número de ejemplo con un sello— se
                 ignora después de la tercera visita y el número falso queda como verdad. */
export type EstadoTarjeta = 'normal' | 'cargando' | 'vacio' | 'error' | 'sin_fuente'

export function Tarjeta({
  dominio,
  titulo,
  sub,
  icono,
  estado = 'normal',
  vacio,
  error,
  ultimoDato,
  falta,
  onReintentar,
  critica,
  children,
}: {
  dominio: Dominio
  titulo: string
  sub?: string
  icono?: ReactNode
  estado?: EstadoTarjeta
  /** Qué decir cuando no hay nada que mostrar y eso es un hecho, no una falla. */
  vacio?: string
  /** Qué falló, en palabras del sistema. */
  error?: string | null
  /** Cuándo fue la última lectura buena: sin esto, un error no dice si el dato es de hace 5 minutos o de ayer. */
  ultimoDato?: string | null
  /** Qué hace falta para que esta tarjeta tenga datos. Obligatorio en estado `sin_fuente`. */
  falta?: string
  onReintentar?: () => void
  critica?: boolean
  children?: ReactNode
}) {
  const c = DOMINIO[dominio].color
  return (
    <article
      className={`${CARD} flex min-w-0 flex-col gap-3 p-4`}
      style={critica ? { borderColor: 'color-mix(in srgb, var(--pnl-red) 55%, transparent)' } : undefined}
    >
      <div className="flex items-center gap-2">
        {icono && (
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-[var(--pnl-panel-2)]" style={{ color: c }}>
            {icono}
          </span>
        )}
        <h3 className="text-[15px] font-semibold tracking-tight text-[var(--pnl-text)]">{titulo}</h3>
      </div>
      {sub && <p className="text-xs leading-relaxed text-[var(--pnl-text-3)]">{sub}</p>}

      {estado === 'cargando' && (
        <div className="flex flex-col gap-2" aria-live="polite" aria-busy="true">
          <span className="sr-only">Cargando</span>
          {[110, 86, 132].map((w, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="h-3 animate-pulse rounded bg-[var(--pnl-track)]" style={{ width: w }} />
              <span className="ml-auto h-3 w-11 animate-pulse rounded bg-[var(--pnl-track)]" />
            </div>
          ))}
        </div>
      )}

      {estado === 'vacio' && (
        <div className="flex flex-col items-center gap-2 py-3 text-center">
          <PackageCheck className="size-5 text-[var(--pnl-text-3)]" aria-hidden />
          <b className="text-[13px] text-[var(--pnl-text-2)]">{vacio ?? 'Nada que mostrar'}</b>
        </div>
      )}

      {estado === 'error' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2 rounded-md bg-[color-mix(in_srgb,var(--pnl-red)_12%,transparent)] p-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-[var(--pnl-red-text)]" aria-hidden />
            <p className="text-[13px] leading-relaxed text-[var(--pnl-text-2)]">
              {error ?? 'No se pudo leer el dato.'}
              {ultimoDato && <> Último dato bueno: {ultimoDato}.</>}
            </p>
          </div>
          {onReintentar && (
            <button
              type="button"
              onClick={onReintentar}
              className="flex h-11 items-center justify-center gap-2 rounded-md border border-[var(--pnl-hair)] bg-[var(--pnl-panel-2)] text-[13px] font-semibold text-[var(--pnl-text-2)] hover:text-[var(--pnl-text)]"
            >
              <RotateCw className="size-4" aria-hidden /> Reintentar
            </button>
          )}
        </div>
      )}

      {estado === 'sin_fuente' && (
        <div className="flex flex-col gap-2 rounded-md border border-dashed border-[var(--pnl-hair)] p-3">
          <span className={EYEBROW}>sin fuente todavía</span>
          <p className="text-[13px] leading-relaxed text-[var(--pnl-text-2)]">{falta}</p>
        </div>
      )}

      {estado === 'normal' && children}
    </article>
  )
}

/* ── Indicador ─────────────────────────────────────────────────────────────── */
export function Kpi({
  dominio,
  valor,
  unidad,
  etiqueta,
  pie,
  delta,
  deltaTono = 'neutro',
  icono,
}: {
  dominio: Dominio
  valor: string
  unidad?: string
  etiqueta: string
  pie?: string
  delta?: string
  deltaTono?: Tono
  icono?: ReactNode
}) {
  const c = DOMINIO[dominio].color
  return (
    <div className={`${CARD} flex min-h-[86px] flex-col justify-between gap-2 p-4`}>
      <div className="flex items-start gap-2">
        {icono && (
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-[var(--pnl-panel-2)]" style={{ color: c }}>
            {icono}
          </span>
        )}
        <p className="min-w-0 text-[11px] leading-snug text-[var(--pnl-text-3)]">{etiqueta}</p>
      </div>
      <div>
        <p className="num text-2xl font-bold leading-none text-[var(--pnl-text)]">
          {valor}
          {unidad && <span className="ml-1 align-super text-[10px] font-medium uppercase tracking-wider text-[var(--pnl-text-3)]">{unidad}</span>}
        </p>
        {pie && <p className="num mt-1.5 text-[10px] text-[var(--pnl-text-3)]">{pie}</p>}
        {delta && (
          <p className="num mt-1 text-[10px] font-semibold" style={{ color: TONO[deltaTono] }}>
            {delta}
          </p>
        )}
      </div>
    </div>
  )
}

/* ── Medidor ───────────────────────────────────────────────────────────────── */
export function Medidor({
  etiqueta,
  valor,
  pct,
  color,
  marca,
}: {
  etiqueta: string
  valor: string
  pct: number
  color: string
  /** Posición 0–100 de una referencia (el plazo prometido, el techo). */
  marca?: number
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline text-xs text-[var(--pnl-text-2)]">
        {etiqueta}
        <span className="num ml-auto font-semibold text-[var(--pnl-text)]">{valor}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-[var(--pnl-track)]">
        <span className="block h-full rounded-full" style={{ width: `${Math.min(Math.max(pct, 0), 100)}%`, background: color }} />
        {marca != null && (
          <i
            className="absolute -top-1 block h-3.5 w-0.5 bg-[var(--pnl-text-2)]"
            style={{ left: `${Math.min(Math.max(marca, 0), 100)}%` }}
            aria-hidden
          />
        )}
      </div>
    </div>
  )
}

/* ── Pastilla de estado ────────────────────────────────────────────────────── */
export function Pastilla({ tono, children }: { tono: Tono; children: ReactNode }) {
  return (
    <span
      className="num inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold"
      style={{ color: TONO[tono], borderColor: 'currentColor' }}
    >
      {children}
    </span>
  )
}

/* ── Encabezado de sección ─────────────────────────────────────────────────── */
export function Encabezado({ titulo, nota, bajada }: { titulo: string; nota?: string; bajada?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-end gap-3">
        <h2 className={SECCION}>{titulo}</h2>
        {nota && <span className="text-xs text-[var(--pnl-text-3)]">{nota}</span>}
      </div>
      {bajada && <p className={`${SECCION_SUB} max-w-[110ch]`}>{bajada}</p>}
    </div>
  )
}

/* ── Aviso de cabecera ─────────────────────────────────────────────────────── */
export function Aviso({ tono, mensaje, accion }: { tono: 'crit' | 'warn'; mensaje: string; accion?: ReactNode }) {
  const c = tono === 'crit' ? 'var(--pnl-red)' : 'var(--pnl-amber)'
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-md p-3 text-[13px] font-semibold text-[var(--pnl-text)]"
      style={{ background: `color-mix(in srgb, ${c} 12%, transparent)` }}
      role="status"
    >
      <TriangleAlert className="size-4 shrink-0" style={{ color: c }} aria-hidden />
      <span className="min-w-0">{mensaje}</span>
      {accion && <span className="ml-auto">{accion}</span>}
    </div>
  )
}
