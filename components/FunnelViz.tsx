'use client'

const ARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
const NUM = (n: number) => new Intl.NumberFormat('es-AR').format(n)

function pctDelta(cur: number, prev?: number) {
  if (!prev || prev === 0) return undefined
  return ((cur - prev) / prev) * 100
}

// Colores por modo
const COLOR_ACCENT = ['#818cf8', '#f97316', '#34d399', '#facc15']
const COLOR_GRAY   = ['#374151', '#4b5563', '#6b7280', '#9ca3af']

// Anchos VISUALES del embudo (0-100). Fijos y decrecientes suave: las magnitudes
// reales (131k reach vs 20 compras) son inservibles como ancho proporcional, así
// que el ancho da forma limpia y los números llevan la verdad. topW[i]==botW[i-1].
const TOP_W = [92, 68, 46, 28]
const BOT_W = [68, 46, 28, 18]

export function FunnelViz({
  reach, clicks, orders, repeats,
  revenue, avgTicket,
  metaOrders = 0, metaRevenue = 0,
  prevReach, prevClicks, prevOrders,
  grayscale = false,
}: {
  reach: number; clicks: number; orders: number; repeats: number
  revenue: number; avgTicket: number
  // Datos reales de Meta (canal meta_ads, atribuido por utm/fbclid). Se usan para
  // NO atribuir a Meta todas las ventas del negocio: reach/clicks son 100% Meta,
  // pero orders/repeats son de TODOS los canales. Ver lib/attribution.ts.
  metaOrders?: number; metaRevenue?: number
  prevReach?: number; prevClicks?: number; prevOrders?: number
  grayscale?: boolean
}) {
  const ctr = reach  > 0 ? (clicks  / reach)  * 100 : 0
  const rr  = orders > 0 ? (repeats / orders)  * 100 : 0
  // CVR REAL de Meta: compras atribuidas a Meta / clicks de Meta. NO usar total de
  // órdenes (mezcla orgánico -> infla la conversión de Meta).
  const cvrMeta   = clicks > 0 ? (metaOrders / clicks) * 100 : 0
  // Qué parte de TODAS las compras del período realmente vino de Meta.
  const metaShare = orders > 0 ? (metaOrders / orders) * 100 : 0

  const COLS = grayscale ? COLOR_GRAY : COLOR_ACCENT

  // Colores de texto según modo
  const txtLabel = grayscale ? 'var(--t-muted)' : 'rgba(255,255,255,0.9)'
  const txtSub   = grayscale ? 'var(--t-dim)'   : 'rgba(255,255,255,0.42)'

  // layer: 'meta'  = tráfico pago de Meta (reach/clicks)
  //        'total' = negocio completo, todos los canales (compras/recompras)
  const STAGES = [
    { label: 'Alcance',         sub: 'personas que vieron el anuncio',
      display: NUM(reach),           color: COLS[0], layer: 'meta',  delta: pctDelta(reach, prevReach) },
    { label: 'Clicks al sitio', sub: 'llegaron desde Meta Ads',
      display: NUM(clicks),          color: COLS[1], layer: 'meta',  delta: pctDelta(clicks, prevClicks) },
    { label: 'Compras',         sub: `ticket prom. ${ARS(avgTicket)}`,
      display: `${NUM(orders)} órd.`, color: COLS[2], layer: 'total', delta: pctDelta(orders, prevOrders) },
    { label: 'Recompras',       sub: 'clientes que compraron en 2+ meses',
      display: NUM(repeats),         color: COLS[3], layer: 'total', delta: undefined },
  ] as const

  // Transición DESPUÉS de cada etapa. 'rate' = tasa válida (misma población);
  // 'boundary' = cambio de población (tráfico Meta -> negocio total).
  const TRANS = [
    { kind: 'rate' as const,     label: 'CTR',  rate: ctr, bench: 1.0 },
    { kind: 'boundary' as const },
    { kind: 'rate' as const,     label: 'Rep.', rate: rr,  bench: 15  },
  ]

  const LAYER = {
    meta:  { text: 'Tráfico Meta Ads',   hint: 'lo que trajo la publicidad',        dot: COLS[1] },
    total: { text: 'Negocio total',      hint: 'todos los canales · Meta + orgánico + directo', dot: COLS[2] },
  } as const

  function LayerHeader({ k }: { k: keyof typeof LAYER }) {
    const L = LAYER[k]
    return (
      <div className="flex items-center gap-2.5 w-full mb-2.5">
        <span style={{ width: 6, height: 6, borderRadius: 99, background: grayscale ? 'var(--t-dim)' : L.dot, flexShrink: 0 }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--t-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
          {L.text}
        </span>
        <span style={{ fontSize: 9.5, color: 'var(--t-dim)', whiteSpace: 'nowrap' }}>· {L.hint}</span>
        <span style={{ flex: 1, height: 1, background: 'var(--t-border, rgba(128,128,128,0.14))' }} />
      </div>
    )
  }

  function RatePill({ label, rate, bench }: { label: string; rate: number; bench: number }) {
    const good = rate >= bench
    return (
      <div className="flex flex-col items-center" style={{ margin: '1px 0' }}>
        <div style={{ width: 1, height: 9, background: 'rgba(128,128,128,0.22)' }} />
        <div style={{
          padding: '2.5px 11px', borderRadius: 99, fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono',monospace",
          background: grayscale ? 'rgba(107,114,128,0.12)' : (good ? 'rgba(52,211,153,0.12)' : 'rgba(249,115,22,0.12)'),
          color:      grayscale ? 'var(--t-muted)'          : (good ? '#34d399' : '#f97316'),
          border:     grayscale ? '1px solid rgba(107,114,128,0.22)' : (good ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(249,115,22,0.3)'),
        }}>
          {label} {rate.toFixed(1)}%
        </div>
        <div style={{ width: 1, height: 9, background: 'rgba(128,128,128,0.22)' }} />
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">

      {/* ── Embudo ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center">
        <div className="w-full" style={{ maxWidth: 420 }}>
          {STAGES.map((s, i) => {
            const lTop = (100 - TOP_W[i]) / 2, rTop = 100 - lTop
            const lBot = (100 - BOT_W[i]) / 2, rBot = 100 - lBot
            const gradId = `fg-${i}-${grayscale ? 'g' : 'c'}`
            const showHeader = i === 0 || s.layer !== STAGES[i - 1].layer

            return (
              <div key={i} className="w-full flex flex-col items-center">

                {showHeader && (
                  <div style={{ marginTop: i === 0 ? 0 : 6, width: '100%' }}>
                    <LayerHeader k={s.layer} />
                  </div>
                )}

                {/* Trapecio */}
                <div className="relative w-full" style={{ height: 74 }}>
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none"
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                    <defs>
                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={s.color} stopOpacity={grayscale ? '0.5' : '0.68'} />
                        <stop offset="100%" stopColor={s.color} stopOpacity={grayscale ? '0.16' : '0.22'} />
                      </linearGradient>
                    </defs>
                    <polygon points={`${lTop},0 ${rTop},0 ${rBot},100 ${lBot},100`} fill={`url(#${gradId})`} />
                    <line x1={lTop} y1="1.5" x2={rTop} y2="1.5" stroke={s.color} strokeWidth="3" strokeLinecap="round" />
                  </svg>

                  {/* Contenido */}
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                    <div className="flex items-center gap-1.5">
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: txtLabel, letterSpacing: '0.03em' }}>{s.label}</span>
                      {s.delta !== undefined && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, fontFamily: "'DM Mono',monospace",
                          padding: '1px 5px', borderRadius: 6,
                          background: grayscale ? 'rgba(107,114,128,0.14)' : (s.delta >= 0 ? 'rgba(52,211,153,0.16)' : 'rgba(248,113,113,0.16)'),
                          color:      grayscale ? 'var(--t-muted)'          : (s.delta >= 0 ? '#34d399' : '#f87171'),
                        }} title="Variación vs el período anterior de igual cantidad de días (según el filtro de fechas)">
                          {s.delta >= 0 ? '↑' : '↓'}{Math.abs(Math.round(s.delta))}%
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 21, fontWeight: 800, color: s.color, fontFamily: "'DM Mono',monospace", lineHeight: 1 }}>{s.display}</span>
                    <span style={{ fontSize: 9, color: txtSub }}>{s.sub}</span>
                  </div>
                </div>

                {/* Transición */}
                {i < STAGES.length - 1 && (() => {
                  const t = TRANS[i]
                  if (t.kind === 'rate') return <RatePill label={t.label} rate={t.rate} bench={t.bench} />
                  // boundary: cambio de población
                  return (
                    <div className="flex flex-col items-center w-full" style={{ margin: '3px 0' }}>
                      <div style={{ width: 1, height: 9, background: 'rgba(128,128,128,0.22)' }} />
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 7, padding: '5px 13px', borderRadius: 10, textAlign: 'center',
                        background: 'rgba(128,128,128,0.05)', border: '1px dashed rgba(128,128,128,0.26)',
                      }}>
                        <span style={{ fontSize: 12, lineHeight: 1 }}>⚠</span>
                        <span style={{ fontSize: 9.5, color: 'var(--t-muted)', lineHeight: 1.35 }}>
                          cambia la población — <b style={{ color: 'var(--t-muted)' }}>no es la conversión de Meta</b>
                          {metaShare > 0 && (
                            <>
                              <br />
                              <span style={{ color: 'var(--t-dim)' }}>de {NUM(orders)} compras, </span>
                              <b style={{ color: COLS[1] }}>{NUM(metaOrders)} ({metaShare.toFixed(0)}%)</b>
                              <span style={{ color: 'var(--t-dim)' }}> vinieron de Meta</span>
                            </>
                          )}
                        </span>
                      </div>
                      <div style={{ width: 1, height: 9, background: 'rgba(128,128,128,0.22)' }} />
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Panel derecho ────────────────────────────────────────── */}
      <div className="lg:w-60 flex flex-col gap-2.5 flex-shrink-0">
        <p className="text-[10px] uppercase tracking-[0.18em] mb-0.5" style={{ color: 'var(--t-dim)' }}>Benchmarks</p>

        {[
          { label: 'CTR', full: 'Alcance → Click',        rate: ctr,     bench: 1.0,  scale: 20, hint: '≥1.0% promedio Meta' },
          { label: 'CVR Meta', full: 'Click → Compra Meta', rate: cvrMeta, bench: 0.5, scale: 40, hint: 'conversión REAL de Meta' },
          { label: 'Recompra', full: 'Compra → 2+ meses',   rate: rr,    bench: 15,   scale: 3,  hint: '≥15% cliente fidelizado' },
        ].map(m => {
          const pass = m.rate >= m.bench
          const barColor  = grayscale ? '#6b7280' : (pass ? '#34d399' : '#f97316')
          const textColor = grayscale ? 'var(--t-muted)' : (pass ? '#34d399' : '#f97316')
          const barW = m.rate > 0 ? Math.max(3, Math.min(100, m.rate * m.scale)) : 0
          return (
            <div key={m.label} className="rounded-xl border p-3"
              style={{ borderColor: 'var(--t-border, rgba(255,255,255,0.08))', background: 'var(--t-card-bg, rgba(255,255,255,0.03))' }}>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-[11px] font-semibold" style={{ color: 'var(--t-muted)' }}>{m.label}</span>
                <span className="text-sm font-mono font-bold" style={{ color: textColor }}>{m.rate.toFixed(2)}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(128,128,128,0.1)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${barW}%`, background: barColor }} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[9px]" style={{ color: 'var(--t-dim)' }}>{m.full}</span>
                <span className="text-[9px]" style={{ color: 'var(--t-dim)' }}>{m.hint}</span>
              </div>
            </div>
          )
        })}

        <div className="grid grid-cols-2 gap-2.5 mt-0.5">
          <div className="rounded-xl border p-3"
            style={{ borderColor: grayscale ? 'rgba(107,114,128,0.2)' : `${COLS[1]}26`, background: grayscale ? 'rgba(107,114,128,0.05)' : `${COLS[1]}0d` }}>
            <p className="text-[9.5px] mb-1" style={{ color: 'var(--t-dim)' }}>Revenue Meta / click</p>
            <p className="text-base font-mono font-bold" style={{ color: COLS[1] }}>{clicks > 0 ? ARS(metaRevenue / clicks) : '—'}</p>
          </div>
          <div className="rounded-xl border p-3"
            style={{ borderColor: 'var(--t-border, rgba(255,255,255,0.08))', background: 'var(--t-card-bg, rgba(255,255,255,0.03))' }}>
            <p className="text-[9.5px] mb-1" style={{ color: 'var(--t-dim)' }}>Revenue Meta / alcance</p>
            <p className="text-base font-mono font-bold" style={{ color: 'var(--t-muted)' }}>{reach > 0 ? ARS(metaRevenue / reach) : '—'}</p>
          </div>
        </div>
        <p className="text-[9px] leading-relaxed" style={{ color: 'var(--t-dim)' }}>
          Ambas usan solo revenue atribuido a Meta (no mezcla venta orgánica).
        </p>
      </div>
    </div>
  )
}
