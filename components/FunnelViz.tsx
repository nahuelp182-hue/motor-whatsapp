'use client'

const ARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
const NUM = (n: number) =>
  new Intl.NumberFormat('es-AR').format(n)

function pctDelta(cur: number, prev?: number) {
  if (!prev || prev === 0) return undefined
  return ((cur - prev) / prev) * 100
}

function DeltaBadge({ delta, invert = false }: { delta?: number; invert?: boolean }) {
  if (delta === undefined) return null
  const good = invert ? delta <= 0 : delta >= 0
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ml-1 ${
      good ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'
    }`}>
      {delta >= 0 ? '↑' : '↓'}{Math.abs(Math.round(delta))}%
    </span>
  )
}

type StageConfig = {
  label: string; sub: string; value: number; display: string
  color: string; topPct: number; botPct: number
}

export function FunnelViz({
  reach, clicks, orders, repeats,
  revenue, avgTicket,
  prevReach, prevClicks, prevOrders,
}: {
  reach: number; clicks: number; orders: number; repeats: number
  revenue: number; avgTicket: number
  prevReach?: number; prevClicks?: number; prevOrders?: number
}) {
  const ctr = reach  > 0 ? (clicks  / reach)  * 100 : 0
  const cvr = clicks > 0 ? (orders  / clicks)  * 100 : 0
  const rr  = orders > 0 ? (repeats / orders)  * 100 : 0

  // Porcentajes relativos para el ancho del embudo
  const max = Math.max(reach, 1)
  function pct(v: number) { return Math.max(8, Math.round((v / max) * 100)) }

  const stages: StageConfig[] = [
    {
      label: 'Alcance',          sub: 'personas que vieron el anuncio',
      value: reach,  display: NUM(reach),
      color: '#818cf8',
      topPct: 100,   botPct: pct(clicks),
    },
    {
      label: 'Clicks al sitio',  sub: 'visitas desde Meta Ads',
      value: clicks, display: NUM(clicks),
      color: '#f97316',
      topPct: pct(clicks), botPct: pct(orders),
    },
    {
      label: 'Compras',          sub: `ticket prom. ${ARS(avgTicket)}`,
      value: orders, display: `${NUM(orders)} órd.`,
      color: '#34d399',
      topPct: pct(orders), botPct: pct(repeats),
    },
    {
      label: 'Recompras',        sub: 'clientes que volvieron',
      value: repeats, display: NUM(repeats),
      color: '#facc15',
      topPct: pct(repeats), botPct: Math.max(4, pct(repeats) - 6),
    },
  ]

  const conversions = [
    { label: 'CTR',  rate: ctr,  bench: 1.0,  from: 'Alcance',   to: 'Clicks' },
    { label: 'Conv', rate: cvr,  bench: 0.5,  from: 'Clicks',    to: 'Compras' },
    { label: 'Rep.',  rate: rr,   bench: 15,   from: 'Compras',   to: 'Recompras' },
  ]

  const deltas = [
    pctDelta(reach,  prevReach),
    pctDelta(clicks, prevClicks),
    pctDelta(orders, prevOrders),
    undefined,
  ]

  return (
    <div className="flex flex-col lg:flex-row gap-8">

      {/* ── Embudo visual ────────────────────────────────────────── */}
      <div className="flex-1">
        <svg
          viewBox="0 0 400 340"
          className="w-full"
          style={{ maxHeight: 360 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {stages.map((s, i) => (
              <linearGradient key={i} id={`fg${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={s.color} stopOpacity="0.45" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.25" />
              </linearGradient>
            ))}
            {stages.map((s, i) => (
              <linearGradient key={`b${i}`} id={`bg${i}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor={s.color} stopOpacity="0.08" />
                <stop offset="50%"  stopColor={s.color} stopOpacity="0.18" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.08" />
              </linearGradient>
            ))}
          </defs>

          {stages.map((s, i) => {
            const segH   = 72
            const gap    = 8
            const y      = i * (segH + gap)
            const cx     = 200
            const topW   = (s.topPct / 100) * 380
            const botW   = (s.botPct / 100) * 380
            const x1     = cx - topW / 2
            const x2     = cx + topW / 2
            const x3     = cx + botW / 2
            const x4     = cx - botW / 2
            const points = `${x1},${y} ${x2},${y} ${x3},${y + segH} ${x4},${y + segH}`

            return (
              <g key={i}>
                {/* Sombra */}
                <polygon points={points}
                  fill="rgba(0,0,0,0.2)"
                  transform="translate(2,3)"
                />
                {/* Fondo con gradiente de color */}
                <polygon points={points} fill={`url(#bg${i})`} />
                {/* Borde superior */}
                <line x1={x1} y1={y} x2={x2} y2={y}
                  stroke={s.color} strokeWidth="2" strokeOpacity="0.7" />
                {/* Bordes laterales */}
                <line x1={x1} y1={y} x2={x4} y2={y + segH}
                  stroke={s.color} strokeWidth="1" strokeOpacity="0.3" />
                <line x1={x2} y1={y} x2={x3} y2={y + segH}
                  stroke={s.color} strokeWidth="1" strokeOpacity="0.3" />

                {/* Barra de progreso interna horizontal */}
                <rect x={x1 + 4} y={y + segH - 6} width={topW - 8} height={3}
                  rx="1.5" fill="rgba(255,255,255,0.06)" />
                <rect x={x1 + 4} y={y + segH - 6}
                  width={(topW - 8) * (s.topPct / 100)} height={3}
                  rx="1.5" fill={s.color} opacity="0.5" />

                {/* Label */}
                <text x={cx} y={y + 22}
                  textAnchor="middle" fontSize="13" fontWeight="700"
                  fill="white" opacity="0.9" fontFamily="Manrope, sans-serif">
                  {s.label}
                </text>

                {/* Valor principal */}
                <text x={cx} y={y + 42}
                  textAnchor="middle" fontSize="17" fontWeight="800"
                  fill={s.color} fontFamily="DM Mono, monospace">
                  {s.display}
                </text>

                {/* Sub */}
                <text x={cx} y={y + 58}
                  textAnchor="middle" fontSize="9" fill="white" opacity="0.4"
                  fontFamily="Manrope, sans-serif">
                  {s.sub}
                </text>

                {/* Badge MoM — lado derecho */}
                {deltas[i] !== undefined && (
                  <g>
                    <rect x={cx + topW / 2 + 4} y={y + 14}
                      width={48} height={18} rx="6"
                      fill={deltas[i]! >= 0 ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)'} />
                    <text x={cx + topW / 2 + 28} y={y + 27}
                      textAnchor="middle" fontSize="10" fontWeight="700"
                      fill={deltas[i]! >= 0 ? '#34d399' : '#f87171'}
                      fontFamily="DM Mono, monospace">
                      {deltas[i]! >= 0 ? '↑' : '↓'}{Math.abs(Math.round(deltas[i]!))}%
                    </text>
                  </g>
                )}

                {/* Tasa de conversión entre etapas */}
                {i < stages.length - 1 && (() => {
                  const conv = conversions[i]
                  const good = conv.rate >= conv.bench
                  const gy   = y + segH + gap / 2
                  return (
                    <g>
                      <line x1={cx - 28} y1={gy} x2={cx + 28} y2={gy}
                        stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                      <rect x={cx - 26} y={gy - 9} width={52} height={18} rx="6"
                        fill={good ? 'rgba(52,211,153,0.12)' : 'rgba(249,115,22,0.12)'}
                        stroke={good ? 'rgba(52,211,153,0.3)' : 'rgba(249,115,22,0.3)'}
                        strokeWidth="0.8" />
                      <text x={cx} y={gy + 5}
                        textAnchor="middle" fontSize="10" fontWeight="700"
                        fill={good ? '#34d399' : '#f97316'}
                        fontFamily="DM Mono, monospace">
                        {conv.label} {conv.rate.toFixed(1)}%
                      </text>
                    </g>
                  )
                })()}
              </g>
            )
          })}
        </svg>
      </div>

      {/* ── Panel métricas ───────────────────────────────────────── */}
      <div className="lg:w-60 flex flex-col gap-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/40 mb-1">Benchmarks</p>

        {[
          { label: 'CTR (Alcance → Click)', rate: ctr, bench: 1.0, unit: '%', barScale: 20, desc: '≥1.0% Meta promedio' },
          { label: 'CVR (Click → Compra)',  rate: cvr, bench: 0.5, unit: '%', barScale: 40, desc: '≥0.5% e-commerce AR' },
          { label: 'Recompra',              rate: rr,  bench: 15,  unit: '%', barScale: 3,  desc: '≥15% cliente fiel' },
        ].map(m => (
          <div key={m.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-white/50">{m.label}</span>
              <span className={`text-sm font-mono font-bold ${m.rate >= m.bench ? 'text-emerald-400' : 'text-orange-400'}`}>
                {m.rate.toFixed(2)}{m.unit}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-1.5">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, m.rate * m.barScale)}%`, background: m.rate >= m.bench ? '#34d399' : '#f97316' }} />
            </div>
            <p className="text-[9px] text-white/25">{m.desc}</p>
          </div>
        ))}

        <div className="rounded-xl border border-orange-500/10 bg-orange-500/5 p-3.5 mt-1">
          <p className="text-[10px] text-white/45 mb-1">Revenue por click</p>
          <p className="text-lg font-mono font-bold text-orange-400">
            {clicks > 0 ? ARS(revenue / clicks) : '—'}
          </p>
          <p className="text-[9px] text-white/30 mt-0.5">Cada click generó este valor en ventas</p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
          <p className="text-[10px] text-white/45 mb-1">Revenue por persona alcanzada</p>
          <p className="text-base font-mono font-bold text-white/70">
            {reach > 0 ? ARS(revenue / reach) : '—'}
          </p>
          <p className="text-[9px] text-white/30 mt-0.5">Eficiencia total del embudo</p>
        </div>
      </div>
    </div>
  )
}
