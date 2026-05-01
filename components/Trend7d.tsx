'use client'

const ARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

type Trend = {
  last7Rev: number
  prev7Rev: number
  last7Orders: number
  prev7Orders: number
  delta: number
  direction: 'up' | 'down' | 'neutral'
}

export function Trend7d({ trend }: { trend: Trend }) {
  const { last7Rev, prev7Rev, last7Orders, prev7Orders, delta, direction } = trend

  const cfg = {
    up: {
      bg:       'from-emerald-950/60 to-emerald-900/20',
      border:   'border-emerald-500/25',
      arrow:    '↑',
      arrowClr: 'text-emerald-400',
      glow:     'bg-emerald-500/10',
      label:    'Por encima',
      badge:    'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    },
    down: {
      bg:       'from-red-950/60 to-red-900/20',
      border:   'border-red-500/25',
      arrow:    '↓',
      arrowClr: 'text-red-400',
      glow:     'bg-red-500/10',
      label:    'Por debajo',
      badge:    'bg-red-500/15 text-red-400 border-red-500/25',
    },
    neutral: {
      bg:       'from-amber-950/40 to-amber-900/10',
      border:   'border-amber-500/20',
      arrow:    '→',
      arrowClr: 'text-amber-400',
      glow:     'bg-amber-500/8',
      label:    'Estable',
      badge:    'bg-amber-500/15 text-amber-400 border-amber-500/20',
    },
  }[direction]

  const diff = last7Rev - prev7Rev

  return (
    <div className={`relative overflow-hidden rounded-2xl border ${cfg.border} bg-gradient-to-br ${cfg.bg} p-5`}>
      {/* Glow */}
      <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full ${cfg.glow} blur-3xl pointer-events-none`} />

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/30 mb-1">Últimos 7 días vs anteriores</p>
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
            {cfg.label}
          </span>
        </div>
        {/* Big arrow */}
        <div className={`text-4xl font-bold leading-none ${cfg.arrowClr}`}>
          {cfg.arrow}
        </div>
      </div>

      {/* Delta */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className={`text-3xl font-bold font-mono leading-none ${cfg.arrowClr}`}>
          {delta > 0 ? '+' : ''}{delta}%
        </span>
        <span className="text-[11px] text-white/30">
          {diff >= 0 ? '+' : ''}{ARS(diff)} respecto al período anterior
        </span>
      </div>

      {/* Comparativa */}
      <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/[0.06]">
        <div>
          <p className="text-[10px] text-white/25 mb-1 uppercase tracking-wider">Últimos 7 días</p>
          <p className="text-[15px] font-mono font-bold text-white">{ARS(last7Rev)}</p>
          <p className="text-[10px] text-white/30 mt-0.5">{last7Orders} ventas</p>
        </div>
        <div>
          <p className="text-[10px] text-white/25 mb-1 uppercase tracking-wider">7 días anteriores</p>
          <p className="text-[15px] font-mono font-bold text-white/50">{ARS(prev7Rev)}</p>
          <p className="text-[10px] text-white/25 mt-0.5">{prev7Orders} ventas</p>
        </div>
      </div>

      {/* Barra comparativa */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-white/20 w-16 flex-shrink-0">Últimos 7d</span>
          <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, prev7Rev > 0 ? (last7Rev / Math.max(last7Rev, prev7Rev)) * 100 : 100)}%`,
                background: direction === 'up' ? '#34d399' : direction === 'down' ? '#f87171' : '#fbbf24',
              }} />
          </div>
          <span className="text-[9px] font-mono text-white/40 w-20 text-right flex-shrink-0">{ARS(last7Rev)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-white/20 w-16 flex-shrink-0">Prev 7d</span>
          <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full bg-white/20 transition-all duration-700"
              style={{ width: `${Math.min(100, last7Rev > 0 ? (prev7Rev / Math.max(last7Rev, prev7Rev)) * 100 : 100)}%` }} />
          </div>
          <span className="text-[9px] font-mono text-white/25 w-20 text-right flex-shrink-0">{ARS(prev7Rev)}</span>
        </div>
      </div>
    </div>
  )
}
