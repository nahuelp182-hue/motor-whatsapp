'use client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const ARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

type PaymentItem = { label: string; count: number; revenue: number; pct: number; color: string }

export function PaymentDonut({ data }: { data: PaymentItem[] }) {
  if (!data.length) return (
    <div className="flex items-center justify-center h-full text-white/20 text-xs">Sin datos</div>
  )

  return (
    <div className="flex flex-col gap-4 h-full">
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={data} dataKey="revenue" nameKey="label"
            cx="50%" cy="50%"
            innerRadius={45} outerRadius={72}
            paddingAngle={2} strokeWidth={0}
          >
            {data.map((d, i) => <Cell key={i} fill={d.color} opacity={0.9} />)}
          </Pie>
          <Tooltip
            contentStyle={{ background: 'rgba(10,10,20,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 11 }}
            formatter={(v: unknown) => [ARS(Number(v)), '']}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="space-y-2">
        {data.map((d) => (
          <div key={d.label}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                <span className="text-[11px] text-white/60 truncate max-w-[140px]">{d.label}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] text-white/30">{d.count} órd.</span>
                <span className="text-[11px] font-mono font-semibold text-white/80">{d.pct}%</span>
              </div>
            </div>
            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${d.pct}%`, background: d.color, opacity: 0.7 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
