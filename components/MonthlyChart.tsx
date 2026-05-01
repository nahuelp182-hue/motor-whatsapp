'use client'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'

const ARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

type MonthStat = {
  key: string; label: string; revenue: number; spend: number
  net: number; orders: number; roas: number; cac: number; avgTicket: number
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: {name:string;value:number;color:string}[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/10 bg-[#0d0d18]/95 p-3 text-xs shadow-2xl backdrop-blur-md min-w-[160px]">
      <p className="text-white/50 mb-2 font-semibold">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-white/60">{p.name}</span>
          </div>
          <span className="text-white font-mono font-semibold">
            {typeof p.value === 'number' && Math.abs(p.value) > 100 ? ARS(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export function MonthlyRevenueChart({ data }: { data: MonthStat[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, left: -15, bottom: 0 }} barGap={2}>
        <defs>
          <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
          axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', paddingTop: 8 }}
          iconSize={8} iconType="circle"
        />
        <Bar dataKey="revenue" name="Ingresos"   fill="#f97316" opacity={0.75} radius={[2,2,0,0]} />
        <Bar dataKey="spend"   name="Gasto Meta" fill="#818cf8" opacity={0.6}  radius={[2,2,0,0]} />
        <Line type="monotone" dataKey="net" name="Neto"
          stroke="#34d399" strokeWidth={2} dot={{ r: 3, fill: '#34d399', strokeWidth: 0 }}
          activeDot={{ r: 4, fill: '#34d399', strokeWidth: 0 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function RoasCacChart({ data }: { data: MonthStat[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={data} margin={{ top: 4, right: 40, left: -15, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
          axisLine={false} tickLine={false} />
        <YAxis yAxisId="roas" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
          tickFormatter={(v: number) => `${v}x`}
          axisLine={false} tickLine={false} />
        <YAxis yAxisId="cac" orientation="right"
          tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.05)', strokeWidth: 1 }} />
        <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', paddingTop: 8 }}
          iconSize={8} iconType="circle" />
        <Line yAxisId="roas" type="monotone" dataKey="roas" name="ROAS"
          stroke="#f97316" strokeWidth={2} dot={{ r: 3, fill: '#f97316', strokeWidth: 0 }}
          activeDot={{ r: 4 }} />
        <Line yAxisId="cac" type="monotone" dataKey="cac" name="CAC"
          stroke="#f43f5e" strokeWidth={2} dot={{ r: 3, fill: '#f43f5e', strokeWidth: 0 }}
          activeDot={{ r: 4 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function AvgTicketChart({ data }: { data: MonthStat[] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, left: -15, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
          axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.05)' }} />
        <Bar dataKey="avgTicket" name="Ticket promedio" fill="#facc15" opacity={0.7} radius={[2,2,0,0]} />
        <Line type="monotone" dataKey="orders" name="Órdenes"
          stroke="#818cf8" strokeWidth={2} dot={{ r: 2, fill: '#818cf8', strokeWidth: 0 }}
          activeDot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
