'use client'
import { SparklineChart } from './SparklineChart'
import { HelpTip } from './HelpTip'

interface MetricCardProps {
  label: string
  value: string
  sub?: string
  highlight?: boolean
  mom?: number
  momInvert?: boolean
  sparkData?: number[]
  tip?: string           // texto del tooltip de ayuda
}

export function MetricCard({
  label, value, sub, highlight, mom, momInvert = false, sparkData, tip,
}: MetricCardProps) {
  const isGood = mom !== undefined
    ? (momInvert ? mom <= 0 : mom >= 0)
    : null

  return (
    <div className={`relative rounded-2xl p-5 flex flex-col justify-between min-h-[130px] transition-all duration-300 group hover:z-[100]
      ${highlight
        ? 'bg-gradient-to-br from-orange-950/60 to-orange-900/20 border border-orange-500/20'
        : 'bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.07]'
      }`}
    >
      {highlight && (
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-orange-500/10 blur-2xl pointer-events-none" />
      )}

      {/* Label + MoM badge */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/50 leading-none flex items-center">
          {label}
          {tip && <HelpTip text={tip} />}
        </p>
        {mom !== undefined && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 flex-shrink-0 ${
            isGood
              ? 'text-emerald-400 bg-emerald-500/10'
              : 'text-red-400 bg-red-500/10'
          }`}>
            {mom >= 0 ? '↑' : '↓'} {Math.abs(mom).toFixed(0)}%
          </span>
        )}
      </div>

      {/* Value */}
      <div>
        <p className={`text-2xl font-bold tracking-tight leading-none font-mono ${highlight ? 'text-orange-300' : 'text-white'}`}>
          {value}
        </p>
        {sub && (
          <p className="mt-1.5 text-[10px] text-white/55 leading-snug">{sub}</p>
        )}
      </div>

      {/* MoM label */}
      {mom !== undefined && (
        <p className="text-[9px] text-white/25 mt-1">vs mes anterior</p>
      )}

      {/* Sparkline — overflow-hidden solo en este wrapper para no bloquear tooltips */}
      {sparkData && sparkData.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-10 overflow-hidden rounded-b-2xl opacity-40 group-hover:opacity-70 transition-opacity pointer-events-none">
          <SparklineChart data={sparkData} color={highlight ? '#f97316' : '#ffffff'} />
        </div>
      )}
    </div>
  )
}
