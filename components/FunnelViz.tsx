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

  const max = Math.max(reach, 1)
  const COLS = grayscale ? COLOR_GRAY : COLOR_ACCENT

  function wpct(v: number, minPct = 6) {
    return Math.max(minPct, (v / max) * 100)
  }

  // Colores de texto según modo
  const txtLabel  = grayscale ? 'var(--t-muted)'  : 'rgba(255,255,255,0.85)'
  const txtSub    = grayscale ? 'var(--t-dim)'    : 'rgba(255,255,255,0.45)'
  const badgeBg   = grayscale ? 'rgba(107,114,128,0.12)' : undefined
  const badgeBorder = grayscale ? '1px solid rgba(107,114,128,0.22)' : undefined

  // layer: 'meta'  = tráfico pago de Meta (reach/clicks)
  //        'total' = negocio completo, todos los canales (compras/recompras)
  const STAGES = [
    {
      label: 'Alcance',         sub: 'personas que vieron el anuncio (Meta)',
      value: reach,   display: NUM(reach),       color: COLS[0], layer: 'meta',
      topPct: 100,              botPct: wpct(clicks, 8),
      delta: pctDelta(reach, prevReach),
    },
    {
      label: 'Clicks al sitio', sub: 'llegaron desde Meta Ads',
      value: clicks,  display: NUM(clicks),      color: COLS[1], layer: 'meta',
      topPct: wpct(clicks, 8),  botPct: wpct(orders, 5),
      delta: pctDelta(clicks, prevClicks),
    },
    {
      label: 'Compras',         sub: `todos los canales · ticket prom. ${ARS(avgTicket)}`,
      value: orders,  display: `${NUM(orders)} órd.`, color: COLS[2], layer: 'total',
      topPct: wpct(orders, 5),  botPct: wpct(repeats, 4),
      delta: pctDelta(orders, prevOrders),
    },
    {
      label: 'Recompras',       sub: 'compraron en 2+ meses (todos los canales)',
      value: repeats, display: NUM(repeats),     color: COLS[3], layer: 'total',
      topPct: wpct(repeats, 4), botPct: Math.max(3, wpct(repeats, 4) - 5),
      delta: undefined,
    },
  ] as const

  // Transición DESPUÉS de cada etapa. 'rate' = tasa válida (misma población);
  // 'boundary' = cambio de población (tráfico Meta -> negocio total), NO es una
  // conversión de Meta.
  const TRANS = [
    { kind: 'rate' as const,     label: 'CTR',  rate: ctr, bench: 1.0 },
    { kind: 'boundary' as const },
    { kind: 'rate' as const,     label: 'Rep.', rate: rr,  bench: 15  },
  ]

  const LAYER_HEADER: Record<string, { text: string; hint: string }> = {
    meta:  { text: 'TRÁFICO META ADS',            hint: 'solo lo que trajo la publicidad' },
    total: { text: 'NEGOCIO TOTAL · TODOS LOS CANALES', hint: 'Meta + orgánico + directo + Google' },
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8">

      {/* ── Embudo SVG ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center gap-0">
        {STAGES.map((s, i) => {
          const lTop = (100 - s.topPct) / 2
          const rTop = 100 - lTop
          const lBot = (100 - s.botPct) / 2
          const rBot = 100 - lBot
          const gradId = `fg-${i}-${grayscale ? 'g' : 'c'}`
          // Header de capa: se muestra cuando cambia la población respecto a la etapa previa
          const showHeader = i === 0 || s.layer !== STAGES[i - 1].layer
          const header = showHeader ? LAYER_HEADER[s.layer] : null

          return (
            <div key={i} className="w-full flex flex-col items-center">

              {/* Etiqueta de capa */}
              {header && (
                <div style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                  margin: i === 0 ? '0 0 4px' : '10px 0 4px',
                }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(128,128,128,0.15)' }} />
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.14em',
                    color: 'var(--t-dim)', whiteSpace: 'nowrap',
                  }}>
                    {header.text}
                  </span>
                  <span style={{ fontSize: 8, color: 'var(--t-dim)', opacity: 0.7, whiteSpace: 'nowrap' }}>
                    {header.hint}
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(128,128,128,0.15)' }} />
                </div>
              )}

              {/* Trapecio via SVG */}
              <div className="relative w-full" style={{ height: 76 }}>
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                >
                  <defs>
                    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={s.color} stopOpacity={grayscale ? '0.5' : '0.7'} />
                      <stop offset="100%" stopColor={s.color} stopOpacity={grayscale ? '0.18' : '0.25'} />
                    </linearGradient>
                  </defs>
                  <polygon
                    points={`${lTop},0 ${rTop},0 ${rBot},100 ${lBot},100`}
                    fill={`url(#${gradId})`}
                  />
                  <line
                    x1={lTop} y1="1.5" x2={rTop} y2="1.5"
                    stroke={s.color} strokeWidth="3" strokeLinecap="round"
                  />
                </svg>

                {/* Contenido centrado */}
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 2,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: txtLabel, letterSpacing: '0.04em' }}>
                    {s.label}
                  </span>
                  <span style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: "'DM Mono',monospace", lineHeight: 1 }}>
                    {s.display}
                  </span>
                  <span style={{ fontSize: 9, color: txtSub }}>
                    {s.sub}
                  </span>
                </div>

                {/* Badge delta MoM */}
                {s.delta !== undefined && (
                  <div style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    padding: '3px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                    fontFamily: "'DM Mono',monospace",
                    background: grayscale
                      ? (s.delta >= 0 ? 'rgba(55,65,81,0.12)' : 'rgba(107,114,128,0.12)')
                      : (s.delta >= 0 ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.18)'),
                    color: grayscale
                      ? (s.delta >= 0 ? '#374151' : '#6b7280')
                      : (s.delta >= 0 ? '#34d399' : '#f87171'),
                    border: grayscale
                      ? '1px solid rgba(107,114,128,0.2)'
                      : (s.delta >= 0 ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(248,113,113,0.3)'),
                  }}>
                    {s.delta >= 0 ? '↑' : '↓'}{Math.abs(Math.round(s.delta))}%
                  </div>
                )}
              </div>

              {/* Transición entre etapas */}
              {i < STAGES.length - 1 && (() => {
                const t = TRANS[i]

                // Límite de población: tráfico Meta -> negocio total. NO es conversión de Meta.
                if (t.kind === 'boundary') {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, margin: '2px 0', width: '100%' }}>
                      <div style={{ width: 1, height: 8, background: 'rgba(128,128,128,0.2)' }} />
                      <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                        padding: '5px 14px', borderRadius: 12, textAlign: 'center',
                        background: 'rgba(128,128,128,0.06)',
                        border: '1px dashed rgba(128,128,128,0.28)',
                      }}>
                        <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--t-muted)' }}>
                          ⚠ cambia la población — no es conversión de Meta
                        </span>
                        <span style={{ fontSize: 9, color: 'var(--t-dim)' }}>
                          {metaShare > 0
                            ? <>de las {NUM(orders)} compras, <b style={{ color: COLS[1] }}>{NUM(metaOrders)} ({metaShare.toFixed(0)}%)</b> vinieron de Meta</>
                            : 'las compras incluyen todos los canales, no solo Meta'}
                        </span>
                      </div>
                      <div style={{ width: 1, height: 8, background: 'rgba(128,128,128,0.2)' }} />
                    </div>
                  )
                }

                const good = t.rate >= t.bench
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, margin: '2px 0' }}>
                    <div style={{ width: 1, height: 8, background: 'rgba(128,128,128,0.2)' }} />
                    <div style={{
                      padding: '3px 12px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                      fontFamily: "'DM Mono',monospace",
                      background: grayscale
                        ? (badgeBg ?? 'rgba(107,114,128,0.1)')
                        : (good ? 'rgba(52,211,153,0.12)' : 'rgba(249,115,22,0.12)'),
                      color: grayscale
                        ? '#374151'
                        : (good ? '#34d399' : '#f97316'),
                      border: grayscale
                        ? (badgeBorder ?? '1px solid rgba(107,114,128,0.22)')
                        : (good ? '1px solid rgba(52,211,153,0.35)' : '1px solid rgba(249,115,22,0.35)'),
                    }}>
                      {t.label} {t.rate.toFixed(1)}%
                    </div>
                    <div style={{ width: 1, height: 8, background: 'rgba(128,128,128,0.2)' }} />
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>

      {/* ── Panel derecho ────────────────────────────────────────── */}
      <div className="lg:w-56 flex flex-col gap-3 flex-shrink-0">
        <p className="text-[10px] uppercase tracking-[0.18em] mb-1" style={{ color: 'var(--t-dim)' }}>Benchmarks</p>

        {[
          { label: 'CTR (Alcance → Click)',        rate: ctr,     bench: 1.0,  scale: 20, hint: '≥1.0% Meta promedio' },
          { label: 'CVR Meta (Click → Compra Meta)', rate: cvrMeta, bench: 0.5, scale: 40, hint: 'conversión REAL de Meta (no mezcla orgánico)' },
          { label: 'Recompra',                     rate: rr,      bench: 15,   scale: 3,  hint: '≥15% cliente fidelizado' },
        ].map(m => {
          const pass = m.rate >= m.bench
          const barColor  = grayscale ? '#6b7280' : (pass ? '#34d399' : '#f97316')
          const textColor = grayscale ? 'var(--t-muted)' : (pass ? '#34d399' : '#f97316')
          return (
            <div key={m.label} className="rounded-xl border p-3.5"
              style={{ borderColor: 'var(--t-border, rgba(255,255,255,0.08))', background: 'var(--t-card-bg, rgba(255,255,255,0.03))' }}>
              <div className="flex justify-between mb-1.5">
                <span className="text-[10px]" style={{ color: 'var(--t-dim)' }}>{m.label}</span>
                <span className="text-sm font-mono font-bold" style={{ color: textColor }}>
                  {m.rate.toFixed(2)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(128,128,128,0.1)' }}>
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, m.rate * m.scale)}%`, background: barColor }} />
              </div>
              <p className="text-[9px]" style={{ color: 'var(--t-dim)' }}>{m.hint}</p>
            </div>
          )
        })}

        <div className="rounded-xl border p-3.5 mt-1"
          style={{
            borderColor: grayscale ? 'rgba(107,114,128,0.2)' : `${COLS[1]}26`,
            background:  grayscale ? 'rgba(107,114,128,0.05)' : `${COLS[1]}0d`,
          }}>
          <p className="text-[10px] mb-1" style={{ color: 'var(--t-dim)' }}>Revenue Meta / click</p>
          <p className="text-lg font-mono font-bold" style={{ color: COLS[1] }}>
            {clicks > 0 ? ARS(metaRevenue / clicks) : '—'}
          </p>
          <p className="text-[9px] mt-0.5" style={{ color: 'var(--t-dim)' }}>Valor en ventas Meta que generó cada click (no incluye orgánico)</p>
        </div>

        <div className="rounded-xl border p-3.5"
          style={{ borderColor: 'var(--t-border, rgba(255,255,255,0.08))', background: 'var(--t-card-bg, rgba(255,255,255,0.03))' }}>
          <p className="text-[10px] mb-1" style={{ color: 'var(--t-dim)' }}>Revenue Meta / persona alcanzada</p>
          <p className="text-base font-mono font-bold" style={{ color: 'var(--t-muted)' }}>
            {reach > 0 ? ARS(metaRevenue / reach) : '—'}
          </p>
          <p className="text-[9px] mt-0.5" style={{ color: 'var(--t-dim)' }}>Eficiencia del tráfico Meta (revenue atribuido a Meta)</p>
        </div>
      </div>
    </div>
  )
}
