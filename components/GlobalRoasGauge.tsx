'use client'
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import { HelpTip } from '@/components/HelpTip'

const ARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

const GAUGE_MAX = 8 // tope visual del arco; ROAS por encima de esto satura el gauge

export function GlobalRoasGauge({
  roasGlobal, metaSpend, googleSpend, metaRevenue, googleRevenue,
}: {
  roasGlobal: number; metaSpend: number; googleSpend: number
  metaRevenue: number; googleRevenue: number
}) {
  const totalSpend   = metaSpend + googleSpend
  const totalRevenue = metaRevenue + googleRevenue
  const clamped = Math.max(0, Math.min(roasGlobal, GAUGE_MAX))
  const color = roasGlobal >= 3 ? '#34d399' : roasGlobal >= 1 ? '#facc15' : '#f87171'
  const data = [{ name: 'roas', value: clamped, fill: color }]

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 flex flex-col sm:flex-row items-center gap-4">
      <div className="relative w-[180px] h-[110px] flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%" cy="100%" innerRadius="130%" outerRadius="180%"
            startAngle={180} endAngle={0}
            data={data}
          >
            <PolarAngleAxis type="number" domain={[0, GAUGE_MAX]} tick={false} />
            <RadialBar dataKey="value" background={{ fill: 'rgba(255,255,255,0.06)' }}
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
          <h3 className="text-[10px] uppercase tracking-[0.18em] text-white/55">ROAS Global — Meta + Google</h3>
          <HelpTip text="Todo lo gastado en pauta paga (Meta Ads + Google Ads) contra el revenue confirmado como originado en esos dos canales. No incluye venta orgánica en ningún lado -- es el número de un vistazo para saber si la pauta en conjunto está siendo rentable." />
        </div>
        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <div>
            <p className="text-white/40">Gastado (Meta + Google)</p>
            <p className="font-mono text-white/80 font-semibold">{ARS(totalSpend)}</p>
          </div>
          <div>
            <p className="text-white/40">Revenue confirmado ads</p>
            <p className="font-mono text-white/80 font-semibold">{ARS(totalRevenue)}</p>
          </div>
          <div>
            <p className="text-white/40 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full inline-block bg-orange-400" /> Meta
            </p>
            <p className="font-mono text-white/60">{ARS(metaSpend)} → {ARS(metaRevenue)}</p>
          </div>
          <div>
            <p className="text-white/40 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#4285F4' }} /> Google
            </p>
            <p className="font-mono text-white/60">{ARS(googleSpend)} → {ARS(googleRevenue)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
