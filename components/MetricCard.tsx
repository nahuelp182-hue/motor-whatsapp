interface MetricCardProps {
  label: string
  value: string
  sub?: string
  highlight?: boolean
}

export function MetricCard({ label, value, sub, highlight }: MetricCardProps) {
  return (
    <div
      className={`rounded-2xl border p-6 backdrop-blur-md transition-all ${
        highlight
          ? 'border-emerald-400/30 bg-emerald-400/10'
          : 'border-white/10 bg-white/5'
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-white/50">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-white/40">{sub}</p>}
    </div>
  )
}
