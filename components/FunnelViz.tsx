'use client'

const ARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
const NUM = (n: number) => new Intl.NumberFormat('es-AR').format(n)

function pctDelta(cur: number, prev?: number) {
  if (!prev || prev === 0) return undefined
  return ((cur - prev) / prev) * 100
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

  const uid = 'fv' // prefix único para gradientes

  // Ancho relativo de cada etapa (top y bottom del trapecio)
  const max = Math.max(reach, 1)
  const W   = 360  // ancho total del SVG
  const cx  = 200  // centro

  function w(v: number, minPct = 6) {
    return Math.max((minPct / 100) * W, (v / max) * W)
  }

  const segH = 68   // altura de cada segmento
  const gap  = 12   // espacio entre segmentos

  const STAGES = [
    { label: 'Alcance',       sub: 'vieron el anuncio',    value: reach,   display: NUM(reach),         color: '#818cf8', topW: w(reach),   botW: w(clicks, 8)  },
    { label: 'Clicks',        sub: 'llegaron al sitio',    value: clicks,  display: NUM(clicks),         color: '#f97316', topW: w(clicks,8), botW: w(orders, 5)  },
    { label: 'Compras',       sub: `ticket: ${ARS(avgTicket)}`, value: orders, display: `${NUM(orders)} órd.`, color: '#34d399', topW: w(orders,5),  botW: w(repeats, 4) },
    { label: 'Recompras',     sub: 'compraron 2+ veces',   value: repeats, display: NUM(repeats),        color: '#facc15', topW: w(repeats,4), botW: Math.max(20, w(repeats,4) - 20) },
  ]

  const CONV = [
    { label: 'CTR',   rate: ctr, bench: 1.0  },
    { label: 'Conv',  rate: cvr, bench: 0.5  },
    { label: 'Rep.',   rate: rr,  bench: 15   },
  ]

  const deltas = [
    pctDelta(reach, prevReach),
    pctDelta(clicks, prevClicks),
    pctDelta(orders, prevOrders),
    undefined,
  ]

  const totalH = STAGES.length * segH + (STAGES.length - 1) * gap

  return (
    <div className="flex flex-col lg:flex-row gap-6">

      {/* ── SVG Embudo ──────────────────────────────────────────── */}
      <div className="flex-1 min-h-[280px]">
        <svg
          viewBox={`0 0 400 ${totalH + 10}`}
          width="100%"
          height={totalH + 10}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {STAGES.map((s, i) => (
              <linearGradient key={i} id={`${uid}g${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={s.color} stopOpacity="0.55" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0.30" />
              </linearGradient>
            ))}
          </defs>

          {STAGES.map((s, i) => {
            const y   = i * (segH + gap)
            const x1  = cx - s.topW / 2,  x2 = cx + s.topW / 2
            const x3  = cx + s.botW / 2,  x4 = cx - s.botW / 2
            const pts = `${x1},${y} ${x2},${y} ${x3},${y+segH} ${x4},${y+segH}`

            const conv = i < CONV.length ? CONV[i] : null
            const delta = deltas[i]
            const good  = conv ? conv.rate >= conv.bench : true

            return (
              <g key={i}>
                {/* Sombra suave */}
                <polygon
                  points={`${x1+2},${y+3} ${x2+2},${y+3} ${x3+2},${y+segH+3} ${x4+2},${y+segH+3}`}
                  fill="rgba(0,0,0,0.35)"
                />

                {/* Trapecio relleno */}
                <polygon points={pts} fill={`url(#${uid}g${i})`} />

                {/* Borde superior destacado */}
                <line x1={x1} y1={y} x2={x2} y2={y}
                  stroke={s.color} strokeWidth="2.5" strokeOpacity="0.9" />

                {/* Bordes laterales */}
                <line x1={x1} y1={y} x2={x4} y2={y+segH}
                  stroke={s.color} strokeWidth="1" strokeOpacity="0.4" />
                <line x1={x2} y1={y} x2={x3} y2={y+segH}
                  stroke={s.color} strokeWidth="1" strokeOpacity="0.4" />

                {/* Barra de relleno interna */}
                <rect x={x1+4} y={y+segH-8} width={s.topW-8} height={4}
                  rx="2" fill="rgba(0,0,0,0.2)" />
                <rect x={x1+4} y={y+segH-8}
                  width={Math.max(0, (s.topW-8) * (s.value/max))} height={4}
                  rx="2" fill={s.color} opacity="0.7" />

                {/* Texto: label */}
                <text x={cx} y={y+20} textAnchor="middle"
                  fontSize="12" fontWeight="700" fill="white" opacity="0.85"
                  fontFamily="Manrope,system-ui,sans-serif">
                  {s.label}
                </text>

                {/* Texto: valor */}
                <text x={cx} y={y+40} textAnchor="middle"
                  fontSize="18" fontWeight="800" fill={s.color}
                  fontFamily="'DM Mono',monospace">
                  {s.display}
                </text>

                {/* Texto: sub */}
                <text x={cx} y={y+56} textAnchor="middle"
                  fontSize="9" fill="rgba(255,255,255,0.4)"
                  fontFamily="Manrope,system-ui,sans-serif">
                  {s.sub}
                </text>

                {/* Delta MoM — derecha */}
                {delta !== undefined && (
                  <>
                    <rect x={x2+6} y={y+14} width={46} height={18} rx="5"
                      fill={delta >= 0 ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.18)'} />
                    <text x={x2+29} y={y+27} textAnchor="middle"
                      fontSize="10" fontWeight="700"
                      fill={delta >= 0 ? '#34d399' : '#f87171'}
                      fontFamily="'DM Mono',monospace">
                      {delta >= 0 ? '↑' : '↓'}{Math.abs(Math.round(delta))}%
                    </text>
                  </>
                )}

                {/* Tasa de conversión entre etapas */}
                {conv && (() => {
                  const gy = y + segH + gap / 2
                  return (
                    <>
                      <rect x={cx-30} y={gy-10} width={60} height={20} rx="6"
                        fill={good ? 'rgba(52,211,153,0.14)' : 'rgba(249,115,22,0.14)'}
                        stroke={good ? 'rgba(52,211,153,0.4)' : 'rgba(249,115,22,0.4)'}
                        strokeWidth="1" />
                      <text x={cx} y={gy+5} textAnchor="middle"
                        fontSize="10" fontWeight="700"
                        fill={good ? '#34d399' : '#f97316'}
                        fontFamily="'DM Mono',monospace">
                        {conv.label} {conv.rate.toFixed(1)}%
                      </text>
                    </>
                  )
                })()}
              </g>
            )
          })}
        </svg>
      </div>

      {/* ── Panel derecho ────────────────────────────────────────── */}
      <div className="lg:w-56 flex flex-col gap-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/40 mb-1">Tasas de conversión</p>

        {[
          { label: 'CTR', rate: ctr, bench: 1.0,  scale: 20, hint: '≥1.0% Meta promedio' },
          { label: 'CVR', rate: cvr, bench: 0.5,  scale: 40, hint: '≥0.5% e-commerce AR' },
          { label: 'Recompra', rate: rr,  bench: 15, scale: 3,  hint: '≥15% cliente fidelizado' },
        ].map(m => (
          <div key={m.label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5">
            <div className="flex justify-between mb-1.5">
              <span className="text-[10px] text-white/55">{m.label}</span>
              <span className={`text-sm font-mono font-bold ${m.rate >= m.bench ? 'text-emerald-400' : 'text-orange-400'}`}>
                {m.rate.toFixed(2)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-1.5">
              <div className="h-full rounded-full"
                style={{ width:`${Math.min(100, m.rate*m.scale)}%`, background: m.rate>=m.bench?'#34d399':'#f97316' }} />
            </div>
            <p className="text-[9px] text-white/25">{m.hint}</p>
          </div>
        ))}

        <div className="rounded-xl border border-orange-500/15 bg-orange-500/5 p-3.5 mt-1">
          <p className="text-[10px] text-white/45 mb-1">Revenue / click</p>
          <p className="text-lg font-mono font-bold text-orange-400">
            {clicks > 0 ? ARS(revenue / clicks) : '—'}
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5">
          <p className="text-[10px] text-white/45 mb-1">Revenue / persona alcanzada</p>
          <p className="text-base font-mono font-bold text-white/65">
            {reach > 0 ? ARS(revenue / reach) : '—'}
          </p>
        </div>
      </div>
    </div>
  )
}
