'use client'
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import { Ayuda } from '@/components/panel/Primitivos'

const ARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const GAUGE_MAX = 8 // tope visual del arco; ROAS por encima de esto satura el gauge

export function GlobalRoasGauge({
  roasGlobal, totalRevenue, metaSpend, googleSpend,
}: {
  roasGlobal: number; totalRevenue: number; metaSpend: number; googleSpend: number
}) {
  const totalSpend = metaSpend + googleSpend
  const clamped = Math.max(0, Math.min(roasGlobal, GAUGE_MAX))
  const color = roasGlobal >= 3 ? 'var(--pnl-green)' : roasGlobal >= 1 ? 'var(--pnl-amber)' : 'var(--pnl-red)'
  const data = [{ name: 'roas', value: clamped, fill: color }]

  return (
    <div className="rounded-2xl border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] p-5 flex flex-col sm:flex-row items-center gap-4">
      <div className="relative w-[180px] h-[110px] flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%" cy="100%" innerRadius="130%" outerRadius="180%"
            startAngle={180} endAngle={0}
            data={data}
          >
            <PolarAngleAxis type="number" domain={[0, GAUGE_MAX]} tick={false} />
            <RadialBar dataKey="value" background={{ fill: 'var(--pnl-track)' }}
              cornerRadius={8} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 pointer-events-none">
          <p className="text-3xl font-bold font-mono" style={{ color }}>
            {roasGlobal > 0 ? `${roasGlobal.toFixed(1)}x` : '—'}
          </p>
        </div>
      </div>

      <div className="flex-1 w-full">
        <div className="flex items-center gap-1.5 mb-2">
          <h3 className="text-[10px] uppercase tracking-[0.18em] text-[var(--pnl-text-2)]">ROAS Global del negocio</h3>
          <Ayuda>{"Pulso rápido del período: TODO lo que ingresó en Tiendanube (incluida venta orgánica) / TODO lo gastado en ads (Meta + Google). A propósito incluye lo orgánico arriba -- captura también el halo (gente que ve un ad de Meta y compra después sin click). Para decidir presupuesto por canal usá el ROAS Meta real y el desglose de 'De dónde viene la gente' más abajo, no este número."}</Ayuda>
        </div>
        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div>
            <p className="text-[var(--pnl-text-3)]">Ingresos totales TN</p>
            <p className="font-mono text-[var(--pnl-text)] font-semibold">{ARS(totalRevenue)}</p>
          </div>
          <div>
            <p className="text-[var(--pnl-text-3)]">Gastado (Meta + Google)</p>
            <p className="font-mono text-[var(--pnl-text)] font-semibold">{ARS(totalSpend)}</p>
          </div>
          <div>
            <p className="text-[var(--pnl-text-3)] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full inline-block bg-orange-400" /> Gasto Meta
            </p>
            <p className="font-mono text-[var(--pnl-text-2)]">{ARS(metaSpend)}</p>
          </div>
          <div>
            <p className="text-[var(--pnl-text-3)] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#4285F4' }} /> Gasto Google
            </p>
            <p className="font-mono text-[var(--pnl-text-2)]">{ARS(googleSpend)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
