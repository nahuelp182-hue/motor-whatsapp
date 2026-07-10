'use client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'
import { HelpTip } from '@/components/HelpTip'

const ARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
const NUM = (n: number) => new Intl.NumberFormat('es-AR').format(n)

type Channel = { key: string; label: string; color: string; orders: number; revenue: number }
type TimelineDay = {
  date: string
  meta_ads: number; sin_utm_con_landing: number; sin_dato_de_visita: number; otro: number
}
type Summary = { metaSpend: number; roasMetaReal: number; roasBlended: number; cacMetaReal: number }

export function AttributionSection({
  channels, timeline, summary, since, until, acHex,
}: {
  channels: Channel[]; timeline: TimelineDay[]; summary: Summary
  since: string; until: string; acHex: string
}) {
  const cardCls  = 'rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5'
  const titleCls = 'text-[10px] uppercase tracking-[0.18em] text-white/55 mb-4'

  const totalRevenue = channels.reduce((s, c) => s + c.revenue, 0)
  const totalOrders  = channels.reduce((s, c) => s + c.orders, 0)
  const donutData = channels
    .filter(c => c.revenue > 0)
    .map(c => ({
      label: c.label, count: c.orders, revenue: c.revenue, color: c.color,
      pct: totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 100) : 0,
    }))

  const metaCh   = channels.find(c => c.key === 'meta_ads')
  const orgCh    = channels.find(c => c.key === 'sin_utm_con_landing')
  const ciegoCh  = channels.find(c => c.key === 'sin_dato_de_visita')

  return (
    <div className="space-y-4">
      <div className={cardCls}>
        <div className="flex items-center justify-between mb-1">
          <h3 className={titleCls + ' mb-0 flex items-center gap-1.5'}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: acHex }} />
            De dónde viene la gente
            <HelpTip text="Clasificación real de cada orden de TN según el utm_source/fbclid capturado por Tiendanube en el momento del click (dato de primera parte, no depende de GA4 ni del Pixel de Meta). 'Orgánico/Directo' incluye blog, búsqueda de marca, recompras y WhatsApp. 'Sin dato' es un agujero de medición, no orgánico confirmado." />
          </h3>
          <span className="text-[10px] text-white/25 font-mono">{since} → {until}</span>
        </div>
        <p className="text-[10px] text-white/30 mb-4">
          El ROAS de abajo ya NO mezcla venta orgánica con gasto de Meta — antes ese cálculo (ingreso total TN / gasto Meta) daba un número siempre alto e irreal.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3 text-center">
            <p className="text-[9px] uppercase tracking-widest text-white/30 mb-1">ROAS Meta real</p>
            <p className={`text-lg font-bold font-mono ${summary.roasMetaReal >= 3 ? 'text-emerald-400' : 'text-orange-400'}`}>
              {summary.roasMetaReal > 0 ? `${summary.roasMetaReal.toFixed(2)}x` : '—'}
            </p>
            <p className="text-[9px] text-white/25 mt-0.5">solo revenue confirmado Meta</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3 text-center">
            <p className="text-[9px] uppercase tracking-widest text-white/30 mb-1">Revenue Meta</p>
            <p className="text-lg font-bold font-mono text-white/80">{metaCh ? ARS(metaCh.revenue) : '—'}</p>
            <p className="text-[9px] text-white/25 mt-0.5">{metaCh?.orders ?? 0} órdenes</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3 text-center">
            <p className="text-[9px] uppercase tracking-widest text-white/30 mb-1">Revenue Orgánico/Directo</p>
            <p className="text-lg font-bold font-mono text-white/80">{orgCh ? ARS(orgCh.revenue) : '—'}</p>
            <p className="text-[9px] text-white/25 mt-0.5">{orgCh?.orders ?? 0} órdenes · costo $0</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3 text-center">
            <p className="text-[9px] uppercase tracking-widest text-white/30 mb-1">Sin dato (ciego)</p>
            <p className="text-lg font-bold font-mono text-white/50">{ciegoCh ? ARS(ciegoCh.revenue) : '—'}</p>
            <p className="text-[9px] text-white/25 mt-0.5">{ciegoCh?.orders ?? 0} órdenes · no es orgánico confirmado</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Donut por canal */}
          <div>
            <p className="text-[9px] uppercase tracking-widest text-white/30 mb-3">Revenue por canal — {NUM(totalOrders)} órdenes</p>
            {donutData.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-white/30 text-xs">Sin órdenes en el período</div>
            ) : (
              <div className="flex flex-col gap-3">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={donutData} dataKey="revenue" nameKey="label" cx="50%" cy="50%"
                      innerRadius={45} outerRadius={72} paddingAngle={2} strokeWidth={0}>
                      {donutData.map((d, i) => <Cell key={i} fill={d.color} opacity={0.9} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'rgba(10,10,20,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 11 }}
                      formatter={(v: unknown) => [ARS(Number(v)), '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {donutData.map(d => (
                    <div key={d.label}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                          <span className="text-[11px] text-white/60 truncate max-w-[160px]">{d.label}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] text-white/55">{d.count} órd.</span>
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
            )}
          </div>

          {/* Timeline apilado */}
          <div>
            <p className="text-[9px] uppercase tracking-widest text-white/30 mb-3">Revenue diario por canal</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={timeline} margin={{ top: 4, right: 4, left: -15, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }}
                  tickFormatter={(d: string) => d.slice(5)} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'rgba(10,10,20,0.95)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 11 }}
                  formatter={(v: unknown) => ARS(Number(v))}
                />
                <Legend wrapperStyle={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', paddingTop: 4 }} iconSize={7} iconType="circle" />
                <Area type="monotone" dataKey="meta_ads" name="Meta Ads" stackId="1"
                  stroke="#f97316" fill="#f97316" fillOpacity={0.5} />
                <Area type="monotone" dataKey="sin_utm_con_landing" name="Orgánico/Directo" stackId="1"
                  stroke="#34d399" fill="#34d399" fillOpacity={0.5} />
                <Area type="monotone" dataKey="otro" name="Google/Otro" stackId="1"
                  stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.5} />
                <Area type="monotone" dataKey="sin_dato_de_visita" name="Sin dato" stackId="1"
                  stroke="#71717a" fill="#71717a" fillOpacity={0.4} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-white/30">
          <span>ROAS blended legado (ingreso total TN / gasto Meta, sin segmentar): {summary.roasBlended > 0 ? `${summary.roasBlended.toFixed(1)}x` : '—'}</span>
          <span>Gasto Meta del período: {ARS(summary.metaSpend)}</span>
        </div>
      </div>
    </div>
  )
}
