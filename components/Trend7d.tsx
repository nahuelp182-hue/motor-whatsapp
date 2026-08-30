'use client'

const ARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

type Trend = {
  last7Rev: number; prev7Rev: number
  last7Orders: number; prev7Orders: number
  delta: number; direction: 'up' | 'down' | 'neutral'
}

export function Trend7d({ trend }: { trend: Trend }) {
  const { last7Rev, prev7Rev, last7Orders, prev7Orders, delta, direction } = trend

  const cfg = {
    up:      { arrow: '↑', clr: 'text-[var(--pnl-green-text)]', border: 'border-[color-mix(in_srgb,var(--pnl-green)_25%,transparent)]', bg: 'from-[color-mix(in_srgb,var(--pnl-green)_10%,transparent)] to-transparent', bar: 'var(--pnl-green)' },
    down:    { arrow: '↓', clr: 'text-[var(--pnl-red-text)]',     border: 'border-[color-mix(in_srgb,var(--pnl-red)_25%,transparent)]',     bg: 'from-[color-mix(in_srgb,var(--pnl-red)_10%,transparent)] to-transparent',     bar: 'var(--pnl-red)' },
    neutral: { arrow: '→', clr: 'text-[var(--pnl-amber)]',   border: 'border-[color-mix(in_srgb,var(--pnl-amber)_20%,transparent)]',   bg: 'from-[color-mix(in_srgb,var(--pnl-amber)_8%,transparent)] to-transparent',   bar: 'var(--pnl-amber)' },
  }[direction]

  const maxRev = Math.max(last7Rev, prev7Rev) || 1

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${cfg.border} bg-gradient-to-br ${cfg.bg} p-4`}>
      <div className="flex items-center gap-4 flex-wrap md:flex-nowrap">

        {/* Flecha + delta */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-2xl font-bold leading-none ${cfg.clr}`}>{cfg.arrow}</span>
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-[var(--pnl-text-3)] leading-none mb-0.5">7 días</p>
            <p className={`text-lg font-bold font-mono leading-none ${cfg.clr}`}>
              {delta > 0 ? '+' : ''}{delta}%
            </p>
          </div>
        </div>

        <div className="w-px h-8 bg-[var(--pnl-panel-2)] flex-shrink-0 hidden md:block" />

        {/* Barras comparativas */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[var(--pnl-text-3)] w-14 flex-shrink-0">Últ. 7d</span>
            <div className="flex-1 h-1.5 rounded-full bg-[var(--pnl-track)] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(last7Rev / maxRev) * 100}%`, background: cfg.bar }} />
            </div>
            <span className="text-[10px] font-mono text-[var(--pnl-text-2)] w-24 text-right flex-shrink-0">{ARS(last7Rev)}</span>
            <span className="text-[9px] text-[var(--pnl-text-3)] w-10 text-right flex-shrink-0">{last7Orders} v.</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-[var(--pnl-text-3)] w-14 flex-shrink-0">Prev 7d</span>
            <div className="flex-1 h-1.5 rounded-full bg-[var(--pnl-track)] overflow-hidden">
              <div className="h-full rounded-full bg-[var(--pnl-text-3)]/25 transition-all duration-500"
                style={{ width: `${(prev7Rev / maxRev) * 100}%` }} />
            </div>
            <span className="text-[10px] font-mono text-[var(--pnl-text-2)] w-24 text-right flex-shrink-0">{ARS(prev7Rev)}</span>
            <span className="text-[9px] text-[var(--pnl-text-3)] w-10 text-right flex-shrink-0">{prev7Orders} v.</span>
          </div>
        </div>

        <div className="w-px h-8 bg-[var(--pnl-panel-2)] flex-shrink-0 hidden md:block" />

        {/* Diferencia */}
        <div className="flex-shrink-0 text-right">
          <p className="text-[10px] text-[var(--pnl-text-3)] mb-0.5">Diferencia</p>
          <p className={`text-sm font-mono font-bold ${cfg.clr}`}>
            {last7Rev - prev7Rev >= 0 ? '+' : ''}{ARS(last7Rev - prev7Rev)}
          </p>
        </div>

      </div>
    </div>
  )
}
