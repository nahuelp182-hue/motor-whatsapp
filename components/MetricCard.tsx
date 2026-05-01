'use client'
import { SparklineChart } from './SparklineChart'

interface MetricCardProps {
  label: string
  value: string
  sub?: string
  highlight?: boolean
  trend?: number        // % change vs prev period
  sparkData?: number[]  // mini chart data
  accentColor?: string  // e.g. '#f97316'
}

export function MetricCard({
  label, value, sub, highlight, trend, sparkData, accentColor = '#f97316'
}: MetricCardProps) {
  const trendUp = trend !== undefined && trend >= 0

  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 flex flex-col justify-between min-h-[130px] transition-all duration-300 group
      ${highlight
        ? 'bg-gradient-to-br from-orange-950/60 to-orange-900/20 border border-orange-500/20'
        : 'bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.07]'
      }`}
    >
      {/* Glow spot */}
      {highlight && (
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-orange-500/10 blur-2xl pointer-events-none" />
      )}

      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35 leading-none">
          {label}
        </p>
        {trend !== undefined && (
          <span className={`text-[10px] font-bold flex items-center gap-0.5 ${trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
            {trendUp ? '↑' : '↓'} {Math.abs(trend).toFixed(0)}%
          </span>
        )}
      </div>

      <div>
        <p className={`text-2xl font-bold tracking-tight leading-none font-mono ${highlight ? 'text-orange-300' : 'text-white'}`}>
          {value}
        </p>
        {sub && (
          <p className="mt-1.5 text-[10px] text-white/55 leading-snug">{sub}</p>
        )}
      </div>

      {sparkData && sparkData.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-10 opacity-50 group-hover:opacity-80 transition-opacity">
          <SparklineChart data={sparkData} color={highlight ? '#f97316' : '#ffffff'} />
        </div>
      )}
    </div>
  )
}
