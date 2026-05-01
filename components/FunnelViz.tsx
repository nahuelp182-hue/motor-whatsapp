'use client'

const ARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
const NUM = (n: number) =>
  new Intl.NumberFormat('es-AR').format(n)

type FunnelStage = {
  id:       string
  label:    string
  sublabel: string
  value:    number
  display:  string
  color:    string
  icon:     string
  tip:      string
  momDelta?: number   // % vs mes anterior (positivo = mejoró)
}

type ConversionRate = {
  label: string
  rate: number
  benchmark: number   // tasa saludable de referencia
}

function DeltaBadge({ delta }: { delta?: number }) {
  if (delta === undefined || delta === null) return null
  const up = delta >= 0
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
      up ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
    }`}>
      {up ? '↑' : '↓'} {Math.abs(Math.round(delta))}%
    </span>
  )
}

function ConvArrow({ rate, benchmark }: { rate: number; benchmark: number }) {
  const good = rate >= benchmark
  return (
    <div className="flex flex-col items-center gap-0.5 py-1">
      <div className="w-px h-3 bg-white/10" />
      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
        good
          ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
          : 'text-orange-400 border-orange-500/20 bg-orange-500/5'
      }`}>
        {rate.toFixed(1)}%
      </span>
      <div className="w-px h-3 bg-white/10" />
      <div className={`w-2 h-2 border-r-2 border-b-2 rotate-45 -mt-1.5 ${
        good ? 'border-emerald-500/30' : 'border-orange-500/30'
      }`} />
    </div>
  )
}

export function FunnelViz({
  reach, clicks, orders, repeats,
  revenue, avgTicket,
  prevReach, prevClicks, prevOrders, prevRepeats,
}: {
  reach: number; clicks: number; orders: number; repeats: number
  revenue: number; avgTicket: number
  prevReach?: number; prevClicks?: number; prevOrders?: number; prevRepeats?: number
}) {
  // Tasas de conversión
  const ctr  = reach  > 0 ? (clicks  / reach)  * 100 : 0   // Click-through rate
  const cvr  = clicks > 0 ? (orders  / clicks)  * 100 : 0   // Conversion rate
  const rr   = orders > 0 ? (repeats / orders)  * 100 : 0   // Repeat rate

  // Deltas vs período anterior
  function pctDelta(cur: number, prev?: number) {
    if (!prev || prev === 0) return undefined
    return ((cur - prev) / prev) * 100
  }
  const deltaReach   = pctDelta(reach,   prevReach)
  const deltaClicks  = pctDelta(clicks,  prevClicks)
  const deltaOrders  = pctDelta(orders,  prevOrders)
  const deltaRepeats = pctDelta(repeats, prevRepeats)

  // Ancho relativo de cada etapa (el mayor = 100%)
  const maxVal = Math.max(reach, 1)
  function barWidth(v: number, min = 18) {
    return Math.max(min, Math.round((v / maxVal) * 100))
  }

  const stages: (FunnelStage & { width: number })[] = [
    {
      id: 'reach', label: 'Alcance', sublabel: 'personas que vieron tus anuncios',
      value: reach, display: NUM(reach), color: '#818cf8',
      icon: '👁', tip: 'Personas únicas expuestas a tus anuncios en Meta. Primer punto de contacto.',
      momDelta: deltaReach, width: barWidth(reach),
    },
    {
      id: 'clicks', label: 'Visitas a la tienda', sublabel: 'clicks desde Meta Ads',
      value: clicks, display: NUM(clicks), color: '#f97316',
      icon: '🖱', tip: 'Personas que hicieron click en el anuncio y llegaron al sitio.',
      momDelta: deltaClicks, width: barWidth(clicks, 14),
    },
    {
      id: 'orders', label: 'Compras', sublabel: `${ARS(avgTicket)} ticket promedio`,
      value: orders, display: `${NUM(orders)} órd.`, color: '#34d399',
      icon: '🛒', tip: 'Órdenes pagas en Tiendanube en el período.',
      momDelta: deltaOrders, width: barWidth(orders, 10),
    },
    {
      id: 'repeats', label: 'Recompras', sublabel: 'clientes que volvieron',
      value: repeats, display: NUM(repeats), color: '#facc15',
      icon: '🔄', tip: 'Clientes que compraron en más de un mes distinto.',
      momDelta: deltaRepeats, width: barWidth(repeats, 7),
    },
  ]

  const conversions: ConversionRate[] = [
    { label: 'CTR',  rate: ctr,  benchmark: 1.0 },
    { label: 'Conv', rate: cvr,  benchmark: 0.5 },
    { label: 'Rep.',  rate: rr,   benchmark: 15  },
  ]

  return (
    <div className="flex flex-col lg:flex-row gap-6">

      {/* ── Embudo visual ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center gap-0">
        {stages.map((stage, i) => (
          <div key={stage.id} className="w-full flex flex-col items-center">
            {/* Barra trapezoidal */}
            <div
              className="relative flex items-center justify-between px-4 py-3 rounded-xl transition-all"
              style={{
                width: `${stage.width}%`,
                background: `${stage.color}18`,
                border:     `1px solid ${stage.color}30`,
              }}
            >
              {/* Ícono + label */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base leading-none flex-shrink-0">{stage.icon}</span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-white/80 truncate">{stage.label}</p>
                  <p className="text-[9px] text-white/35 truncate hidden sm:block">{stage.sublabel}</p>
                </div>
              </div>

              {/* Valor + delta */}
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <DeltaBadge delta={stage.momDelta} />
                <span className="text-sm font-bold font-mono"
                  style={{ color: stage.color }}>
                  {stage.display}
                </span>
              </div>
            </div>

            {/* Flecha de conversión entre etapas */}
            {i < stages.length - 1 && (
              <ConvArrow
                rate={conversions[i].rate}
                benchmark={conversions[i].benchmark}
              />
            )}
          </div>
        ))}
      </div>

      {/* ── Panel de métricas de conversión ─────────────────────── */}
      <div className="lg:w-64 flex flex-col gap-3">

        {/* Header */}
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/40 mb-1">Tasas de conversión</p>

        {/* CTR */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-white/50">Alcance → Visitas (CTR)</span>
            <span className={`text-sm font-mono font-bold ${ctr >= 1 ? 'text-emerald-400' : 'text-orange-400'}`}>
              {ctr.toFixed(2)}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, ctr * 20)}%`, background: ctr >= 1 ? '#34d399' : '#f97316' }} />
          </div>
          <p className="text-[9px] text-white/25 mt-1.5">Referencia: ≥1.0% — Meta promedio industria</p>
        </div>

        {/* CVR */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-white/50">Visitas → Compras (CVR)</span>
            <span className={`text-sm font-mono font-bold ${cvr >= 0.5 ? 'text-emerald-400' : 'text-orange-400'}`}>
              {cvr.toFixed(2)}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, cvr * 40)}%`, background: cvr >= 0.5 ? '#34d399' : '#f97316' }} />
          </div>
          <p className="text-[9px] text-white/25 mt-1.5">Referencia: ≥0.5% — e-commerce AR promedio</p>
        </div>

        {/* Repeat rate */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-white/50">Compras → Recompras</span>
            <span className={`text-sm font-mono font-bold ${rr >= 15 ? 'text-emerald-400' : 'text-orange-400'}`}>
              {rr.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, rr * 3)}%`, background: rr >= 15 ? '#34d399' : '#f97316' }} />
          </div>
          <p className="text-[9px] text-white/25 mt-1.5">Referencia: ≥15% — cliente fidelizado</p>
        </div>

        {/* Revenue por click */}
        <div className="rounded-xl border border-orange-500/10 bg-orange-500/5 p-4">
          <p className="text-[10px] text-white/45 mb-1">Revenue por click</p>
          <p className="text-lg font-mono font-bold text-orange-400">
            {clicks > 0 ? ARS(revenue / clicks) : '—'}
          </p>
          <p className="text-[9px] text-white/30 mt-0.5">Cada click generó este valor promedio en ventas</p>
        </div>

        {/* Revenue por persona alcanzada */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-[10px] text-white/45 mb-1">Revenue por persona alcanzada</p>
          <p className="text-lg font-mono font-bold text-white/70">
            {reach > 0 ? ARS(revenue / reach) : '—'}
          </p>
          <p className="text-[9px] text-white/30 mt-0.5">Eficiencia total del embudo de ventas</p>
        </div>
      </div>
    </div>
  )
}
