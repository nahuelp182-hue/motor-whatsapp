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
    up:      { arrow: '↑', clr: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'from-emerald-950/40 to-transparent', bar: '#34d399' },
    down:    { arrow: '↓', clr: 'text-red-400',     border: 'border-red-500/20',     bg: 'from-red-950/40 to-transparent',     bar: '#f87171' },
    neutral: { arrow: '→', clr: 'text-amber-400',   border: 'border-amber-500/15',   bg: 'from-amber-950/30 to-transparent',   bar: '#fbbf24' },
  }[direction]

  const maxRev = Math.max(last7Rev, prev7Rev) || 1

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${cfg.border} bg-gradient-to-br ${cfg.bg} p-4`}>
      <div className="flex items-center gap-4 flex-wrap md:flex-nowrap">

        {/* Flecha + delta */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-2xl font-bold leading-none ${cfg.clr}`}>{cfg.arrow}</span>
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-white/50 leading-none mb-0.5">7 días</p>
            <p className={`text-lg font-bold font-mono leading-none ${cfg.clr}`}>
              {delta > 0 ? '+' : ''}{delta}%
            </p>
          </div>
        </div>

        <div className="w-px h-8 bg-white/[0.06] flex-shrink-0 hidden md:block" />

        {/* Barras comparativas */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-white/50 w-14 flex-shrink-0">Últ. 7d</span>
            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(last7Rev / maxRev) * 100}%`, background: cfg.bar }} />
            </div>
            <span className="text-[10px] font-mono text-white/60 w-24 text-right flex-shrink-0">{ARS(last7Rev)}</span>
            <span className="text-[9px] text-white/50 w-10 text-right flex-shrink-0">{last7Orders} v.</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-white/50 w-14 flex-shrink-0">Prev 7d</span>
            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full bg-white/15 transition-all duration-500"
                style={{ width: `${(prev7Rev / maxRev) * 100}%` }} />
            </div>
            <span className="text-[10px] font-mono text-white/55 w-24 text-right flex-shrink-0">{ARS(prev7Rev)}</span>
            <span className="text-[9px] text-white/50 w-10 text-right flex-shrink-0">{prev7Orders} v.</span>
          </div>
        </div>

        <div className="w-px h-8 bg-white/[0.06] flex-shrink-0 hidden md:block" />

        {/* Diferencia */}
        <div className="flex-shrink-0 text-right">
          <p className="text-[10px] text-white/50 mb-0.5">Diferencia</p>
          <p className={`text-sm font-mono font-bold ${cfg.clr}`}>
            {last7Rev - prev7Rev >= 0 ? '+' : ''}{ARS(last7Rev - prev7Rev)}
          </p>
        </div>

      </div>
    </div>
  )
}
