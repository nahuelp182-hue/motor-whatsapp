'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const ARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

type Product = { name: string; units: number; revenue: number; orders: number; pct: number }

function shortName(name: string): string {
  if (name.length <= 22) return name
  return name.slice(0, 20) + '…'
}

export function ProductsChart({
  data, selected, onSelect,
}: {
  data: Product[]
  selected: string | null
  onSelect: (name: string | null) => void
}) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-32 text-white/50 text-xs">Sin datos</div>
  )

  return (
    <div className="space-y-2">
      {data.map((p, i) => {
        const isSelected = selected === p.name
        const isOther    = selected !== null && !isSelected
        return (
          <button
            key={p.name}
            onClick={() => onSelect(isSelected ? null : p.name)}
            className={`w-full text-left rounded-xl p-3 transition-all border ${
              isSelected
                ? 'border-orange-500/40 bg-orange-500/10'
                : isOther
                ? 'border-white/[0.04] bg-white/[0.01] opacity-40'
                : 'border-white/[0.06] bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-white/70 font-medium truncate max-w-[55%]">
                {shortName(p.name)}
              </span>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-[10px] text-white/55">{p.units} uds · {p.orders} órd.</span>
                <span className="text-[11px] font-mono font-semibold text-white">{p.pct}%</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${p.pct}%`,
                    background: i === 0 ? '#f97316' : i === 1 ? '#34d399' : i === 2 ? '#818cf8' : '#facc15',
                    opacity: isOther ? 0.3 : 0.8,
                  }}
                />
              </div>
              <span className="text-[11px] font-mono text-white/60 flex-shrink-0">{ARS(p.revenue)}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
