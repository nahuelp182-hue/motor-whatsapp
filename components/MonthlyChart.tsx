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
    <div className="rounded-xl border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] p-3 text-xs shadow-2xl backdrop-blur-md min-w-[160px]">
      <p className="text-[var(--pnl-text-3)] mb-2 font-semibold">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-[var(--pnl-text-2)]">{p.name}</span>
          </div>
          <span className="text-[var(--pnl-text)] font-mono font-semibold">
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
            <stop offset="0%" stopColor="var(--pnl-green)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--pnl-green)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--pnl-hair)" />
        <XAxis dataKey="label" tick={{ fill: 'var(--pnl-text-3)', fontSize: 10 }}
          axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'var(--pnl-text-3)', fontSize: 10 }}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--pnl-panel-2)' }} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: 'var(--pnl-text-3)', paddingTop: 8 }}
          iconSize={8} iconType="circle"
        />
        <Bar dataKey="revenue" name="Ingresos"   fill="var(--pnl-amber)" opacity={0.85} radius={[2,2,0,0]} />
        <Bar dataKey="spend"   name="Gasto Meta" fill="var(--pnl-lilac)" opacity={0.6}  radius={[2,2,0,0]} />
        <Line type="monotone" dataKey="net" name="Neto"
          stroke="var(--pnl-green)" strokeWidth={2} dot={{ r: 3, fill: 'var(--pnl-green)', strokeWidth: 0 }}
          activeDot={{ r: 4, fill: 'var(--pnl-green)', strokeWidth: 0 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function RoasCacChart({ data }: { data: MonthStat[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={data} margin={{ top: 4, right: 40, left: -15, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--pnl-hair)" />
        <XAxis dataKey="label" tick={{ fill: 'var(--pnl-text-3)', fontSize: 10 }}
          axisLine={false} tickLine={false} />
        <YAxis yAxisId="roas" tick={{ fill: 'var(--pnl-text-3)', fontSize: 10 }}
          tickFormatter={(v: number) => `${v}x`}
          axisLine={false} tickLine={false} />
        <YAxis yAxisId="cac" orientation="right"
          tick={{ fill: 'var(--pnl-text-3)', fontSize: 10 }}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--pnl-hair)', strokeWidth: 1 }} />
        <Legend wrapperStyle={{ fontSize: 11, color: 'var(--pnl-text-3)', paddingTop: 8 }}
          iconSize={8} iconType="circle" />
        <Line yAxisId="roas" type="monotone" dataKey="roas" name="ROAS"
          stroke="var(--pnl-amber)" strokeWidth={2} dot={{ r: 3, fill: 'var(--pnl-amber)', strokeWidth: 0 }}
          activeDot={{ r: 4 }} />
        <Line yAxisId="cac" type="monotone" dataKey="cac" name="CAC"
          stroke="var(--pnl-red)" strokeWidth={2} dot={{ r: 3, fill: 'var(--pnl-red)', strokeWidth: 0 }}
          activeDot={{ r: 4 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function AvgTicketChart({ data }: { data: MonthStat[] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, left: -15, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--pnl-hair)" />
        <XAxis dataKey="label" tick={{ fill: 'var(--pnl-text-3)', fontSize: 10 }}
          axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'var(--pnl-text-3)', fontSize: 10 }}
          tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--pnl-hair)' }} />
        <Bar dataKey="avgTicket" name="Ticket promedio" fill="var(--pnl-amber)" opacity={0.7} radius={[2,2,0,0]} />
        <Line type="monotone" dataKey="orders" name="Órdenes"
          stroke="var(--pnl-lilac)" strokeWidth={2} dot={{ r: 2, fill: 'var(--pnl-lilac)', strokeWidth: 0 }}
          activeDot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
