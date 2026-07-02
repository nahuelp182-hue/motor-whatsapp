'use client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'

const USD = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: n < 1 ? 3 : 2, maximumFractionDigits: n < 1 ? 4 : 2 })

export type UsageDay = { dia: string; label: string; instagram: number; whatsapp: number; otros: number; total: number }

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: {name:string;value:number;color:string}[]; label?: string }) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div className="rounded-xl border border-white/10 bg-[#0d0d18]/95 p-3 text-xs shadow-2xl backdrop-blur-md min-w-[150px]">
      <p className="text-white/50 mb-2 font-semibold">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-white/60">{p.name}</span>
          </div>
          <span className="text-white font-mono font-semibold">{USD(p.value)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-4 mt-2 pt-2 border-t border-white/10">
        <span className="text-white/60">Total</span>
        <span className="text-white font-mono font-semibold">{USD(total)}</span>
      </div>
    </div>
  )
}

export function ClaudeUsageChart({ data }: { data: UsageDay[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
          axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
          tickFormatter={(v: number) => `$${v < 1 ? v.toFixed(2) : v.toFixed(0)}`}
          axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
        <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', paddingTop: 8 }}
          iconSize={8} iconType="circle" />
        <Bar dataKey="instagram" name="Instagram" stackId="c" fill="#e1306c" opacity={0.8} radius={[0,0,0,0]} />
        <Bar dataKey="whatsapp"  name="WhatsApp"  stackId="c" fill="#25d366" opacity={0.8} radius={[0,0,0,0]} />
        <Bar dataKey="otros"     name="Otros"     stackId="c" fill="#818cf8" opacity={0.7} radius={[2,2,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
