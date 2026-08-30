'use client'
import { SparklineChart } from './SparklineChart'
import { Ayuda } from '@/components/panel/Primitivos'
import { NumeroRodante } from '@/components/widgets/NumeroRodante'

interface MetricCardProps {
  label: string
  value: string
  sub?: string
  highlight?: boolean
  mom?: number
  momInvert?: boolean
  sparkData?: number[]
  tip?: string
}

export function MetricCard({
  label, value, sub, highlight, mom, momInvert = false, sparkData, tip,
}: MetricCardProps) {
  const isGood = mom !== undefined
    ? (momInvert ? mom <= 0 : mom >= 0)
    : null

  return (
    <div
      data-highlight={highlight ? 'true' : undefined}
      className={`relative rounded-md p-5 flex flex-col justify-between min-h-[130px] transition-all duration-300 border ${
        highlight
          ? 'border-[color-mix(in_srgb,var(--pnl-amber)_35%,transparent)]'
          : 'bg-[var(--pnl-panel)] border-[var(--pnl-hair)]'
      }`}
      style={highlight ? {
        background: 'linear-gradient(to bottom right, color-mix(in srgb, var(--pnl-amber) 14%, var(--pnl-panel)) 0%, var(--pnl-panel) 100%)',
      } : undefined}
    >
      {/* Label + MoM badge */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--pnl-text-3)] leading-none flex items-center">
          {label}
          {tip && <Ayuda>{tip}</Ayuda>}
        </p>
        {mom !== undefined && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 flex-shrink-0 ${
            isGood
              ? 'text-[var(--pnl-green-text)] bg-[color-mix(in_srgb,var(--pnl-green)_14%,transparent)]'
              : 'text-[var(--pnl-red-text)] bg-[color-mix(in_srgb,var(--pnl-red)_14%,transparent)]'
          }`}>
            {mom >= 0 ? '↑' : '↓'} {Math.abs(mom).toFixed(0)}%
          </span>
        )}
      </div>

      {/* Value */}
      <div>
        <p
          className="text-2xl font-bold tracking-tight leading-none font-mono"
          style={{ color: highlight ? 'var(--pnl-amber)' : 'var(--pnl-text)' }}
        >
          <NumeroRodante value={value} />
        </p>
        {sub && (
          <p className="mt-1.5 text-[10px] text-[var(--pnl-text-2)] leading-snug">{sub}</p>
        )}
      </div>

      {/* MoM label */}
      {mom !== undefined && (
        <p className="text-[9px] text-[var(--pnl-text-3)] mt-1">vs mes anterior</p>
      )}

      {/* Sparkline */}
      {sparkData && sparkData.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-10 overflow-hidden rounded-b-md opacity-50 pointer-events-none">
          <SparklineChart
            data={sparkData}
            color={highlight ? 'var(--pnl-amber)' : 'var(--pnl-text-3)'}
          />
        </div>
      )}
    </div>
  )
}
