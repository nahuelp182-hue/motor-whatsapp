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

  const max = Math.max(reach, 1)

  // Ancho como % del contenedor (0-100)
  function wpct(v: number, minPct = 6) {
    return Math.max(minPct, (v / max) * 100)
  }

  const STAGES = [
    {
      label: 'Alcance',        sub: 'personas que vieron el anuncio',
      value: reach,   display: NUM(reach),
      color: '#818cf8',
      colorBg: 'linear-gradient(180deg, rgba(129,140,248,0.65) 0%, rgba(129,140,248,0.30) 100%)',
      topPct: 100,            botPct: wpct(clicks, 8),
      delta: pctDelta(reach, prevReach),
    },
    {
      label: 'Clicks al sitio', sub: 'llegaron desde Meta Ads',
      value: clicks,  display: NUM(clicks),
      color: '#f97316',
      colorBg: 'linear-gradient(180deg, rgba(249,115,22,0.65) 0%, rgba(249,115,22,0.30) 100%)',
      topPct: wpct(clicks, 8), botPct: wpct(orders, 5),
      delta: pctDelta(clicks, prevClicks),
    },
    {
      label: 'Compras',         sub: `ticket prom. ${ARS(avgTicket)}`,
      value: orders,  display: `${NUM(orders)} órd.`,
      color: '#34d399',
      colorBg: 'linear-gradient(180deg, rgba(52,211,153,0.65) 0%, rgba(52,211,153,0.30) 100%)',
      topPct: wpct(orders, 5), botPct: wpct(repeats, 4),
      delta: pctDelta(orders, prevOrders),
    },
    {
      label: 'Recompras',       sub: 'compraron en 2+ meses',
      value: repeats, display: NUM(repeats),
      color: '#facc15',
      colorBg: 'linear-gradient(180deg, rgba(250,204,21,0.65) 0%, rgba(250,204,21,0.30) 100%)',
      topPct: wpct(repeats, 4), botPct: Math.max(3, wpct(repeats, 4) - 5),
      delta: undefined,
    },
  ]

  const CONV = [
    { label: 'CTR',  rate: ctr, bench: 1.0  },
    { label: 'Conv', rate: cvr, bench: 0.5  },
    { label: 'Rep.',  rate: rr,  bench: 15   },
  ]

  return (
    <div className="flex flex-col lg:flex-row gap-8">

      {/* ── Embudo CSS ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center gap-0">
        {STAGES.map((s, i) => {
          // clip-path trapecio: (topLeft, topRight, botRight, botLeft)
          const lTop = (100 - s.topPct) / 2
          const rTop = 100 - lTop
          const lBot = (100 - s.botPct) / 2
          const rBot = 100 - lBot
          const clipPath = `polygon(${lTop}% 0%, ${rTop}% 0%, ${rBot}% 100%, ${lBot}% 100%)`

          return (
            <div key={i} className="w-full flex flex-col items-center">

              {/* Trapecio */}
              <div className="relative w-full" style={{ height: 76 }}>

                {/* Fondo con clip-path */}
                <div style={{
                  position:   'absolute',
                  inset:      0,
                  clipPath,
                  background: s.colorBg,
                  filter:     `drop-shadow(0 0 6px ${s.color}55)`,
                }} />

                {/* Borde superior (línea de color) */}
                <div style={{
                  position:     'absolute',
                  top:           0,
                  left:         `${lTop}%`,
                  right:        `${100 - rTop}%`,
                  height:        3,
                  background:    s.color,
                  borderRadius: '2px 2px 0 0',
                  boxShadow:    `0 0 12px ${s.color}88`,
                }} />

                {/* Contenido centrado */}
                <div style={{
                  position:       'absolute',
                  inset:          0,
                  display:        'flex',
                  flexDirection:  'column',
                  alignItems:     'center',
                  justifyContent: 'center',
                  gap:             2,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.04em' }}>
                    {s.label}
                  </span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: "'DM Mono',monospace", lineHeight: 1 }}>
                    {s.display}
                  </span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
                    {s.sub}
                  </span>
                </div>

                {/* Badge delta MoM */}
                {s.delta !== undefined && (
                  <div style={{
                    position:     'absolute',
                    right:         8,
                    top:           '50%',
                    transform:     'translateY(-50%)',
                    padding:       '3px 8px',
                    borderRadius:   8,
                    fontSize:       10,
                    fontWeight:     700,
                    fontFamily:    "'DM Mono',monospace",
                    background:    s.delta >= 0 ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.18)',
                    color:         s.delta >= 0 ? '#34d399' : '#f87171',
                    border:        s.delta >= 0 ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(248,113,113,0.3)',
                  }}>
                    {s.delta >= 0 ? '↑' : '↓'}{Math.abs(Math.round(s.delta))}%
                  </div>
                )}
              </div>

              {/* Tasa de conversión entre etapas */}
              {i < STAGES.length - 1 && (() => {
                const c    = CONV[i]
                const good = c.rate >= c.bench
                return (
                  <div style={{
                    display:        'flex',
                    flexDirection:  'column',
                    alignItems:     'center',
                    gap:             0,
                    margin:         '2px 0',
                  }}>
                    <div style={{ width: 1, height: 8, background: 'rgba(255,255,255,0.12)' }} />
                    <div style={{
                      padding:      '3px 12px',
                      borderRadius:  20,
                      fontSize:      10,
                      fontWeight:    700,
                      fontFamily:   "'DM Mono',monospace",
                      background:   good ? 'rgba(52,211,153,0.12)' : 'rgba(249,115,22,0.12)',
                      color:        good ? '#34d399' : '#f97316',
                      border:       good ? '1px solid rgba(52,211,153,0.35)' : '1px solid rgba(249,115,22,0.35)',
                    }}>
                      {c.label} {c.rate.toFixed(1)}%
                    </div>
                    <div style={{ width: 1, height: 8, background: 'rgba(255,255,255,0.12)' }} />
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>

      {/* ── Panel derecho ────────────────────────────────────────── */}
      <div className="lg:w-56 flex flex-col gap-3 flex-shrink-0">
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/40 mb-1">Benchmarks</p>

        {[
          { label: 'CTR (Alcance → Click)', rate: ctr, bench: 1.0,  scale: 20, hint: '≥1.0% Meta promedio' },
          { label: 'CVR (Click → Compra)',  rate: cvr, bench: 0.5,  scale: 40, hint: '≥0.5% e-commerce AR' },
          { label: 'Recompra',              rate: rr,  bench: 15,   scale: 3,  hint: '≥15% cliente fidelizado' },
        ].map(m => (
          <div key={m.label} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5">
            <div className="flex justify-between mb-1.5">
              <span className="text-[10px] text-white/55">{m.label}</span>
              <span className={`text-sm font-mono font-bold ${m.rate >= m.bench ? 'text-emerald-400' : 'text-orange-400'}`}>
                {m.rate.toFixed(2)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-1.5">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${Math.min(100, m.rate * m.scale)}%`, background: m.rate >= m.bench ? '#34d399' : '#f97316' }} />
            </div>
            <p className="text-[9px] text-white/25">{m.hint}</p>
          </div>
        ))}

        <div className="rounded-xl border border-orange-500/15 bg-orange-500/5 p-3.5 mt-1">
          <p className="text-[10px] text-white/45 mb-1">Revenue / click</p>
          <p className="text-lg font-mono font-bold text-orange-400">
            {clicks > 0 ? ARS(revenue / clicks) : '—'}
          </p>
          <p className="text-[9px] text-white/30 mt-0.5">Cada click generó este valor en ventas</p>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5">
          <p className="text-[10px] text-white/45 mb-1">Revenue / persona alcanzada</p>
          <p className="text-base font-mono font-bold text-white/65">
            {reach > 0 ? ARS(revenue / reach) : '—'}
          </p>
          <p className="text-[9px] text-white/30 mt-0.5">Eficiencia total del embudo</p>
        </div>
      </div>
    </div>
  )
}
