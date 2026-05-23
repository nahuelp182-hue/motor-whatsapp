'use client'

import { useEffect, useState } from 'react'
import { HelpTip } from '@/components/HelpTip'

// ── Types ────────────────────────────────────────────────────────────────────
type GadsCampaign = {
  id: string; name: string; status: string; type: string
  impressions: number; clicks: number; costARS: number
  conversions: number; convValue: number; ctr: number; avgCpc: number
}
type GadsData = {
  totalImpressions: number; totalClicks: number; totalCostARS: number
  totalConversions: number; totalConvValue: number
  ctr: number; avgCpc: number; roas: number
  campaigns: GadsCampaign[]
}
type ClarityData = {
  sessions: number; users: number; pagesPerSession: number
  activeTime: number; totalTime: number; scrollDepth: number
  mobilePct: number; desktopPct: number
  quickbackPct: number; rageClickPct: number; deadClickPct: number
  topPages: { url: string; views: number }[]
}
type GA4Source = { channel: string; sessions: number; users: number }
type GA4Data = {
  sessions: number; users: number; pageviews: number
  bounceRate: number; avgSessionDur: number
  sources: GA4Source[]
}
type PerformanceData = {
  since: string; until: string
  gads:    GadsData    | null
  clarity: ClarityData | null
  ga4:     GA4Data     | null
}

// ── Formatters ───────────────────────────────────────────────────────────────
const ARS = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
const NUM = (n: number) =>
  new Intl.NumberFormat('es-AR').format(Math.round(n))
const PCT = (n: number) => `${n.toFixed(1)}%`
function fmtDur(s: number) {
  const m = Math.floor(s / 60); const sec = Math.round(s % 60)
  return m ? `${m}m ${sec}s` : `${sec}s`
}
function fmtCampaignType(t: string) {
  const map: Record<string, string> = {
    SEARCH: 'Search', DISPLAY: 'Display', VIDEO: 'Video',
    PERFORMANCE_MAX: 'PMax', SHOPPING: 'Shopping',
  }
  return map[t] ?? t
}

// ── Sub-components ───────────────────────────────────────────────────────────
function StatRow({ label, value, sub, tip, highlight }: {
  label: string; value: string; sub?: string; tip?: string; highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
      <span className="text-[11px] text-white/50 flex items-center gap-1">
        {label}
        {tip && <HelpTip text={tip} />}
      </span>
      <div className="text-right">
        <span className={`text-[11px] font-mono font-semibold ${highlight ? 'text-emerald-400' : 'text-white/80'}`}>
          {value}
        </span>
        {sub && <span className="text-[10px] text-white/30 ml-1.5">{sub}</span>}
      </div>
    </div>
  )
}

function FrictionBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-white/45">{label}</span>
        <span className="font-mono" style={{ color }}>{PCT(pct)}</span>
      </div>
      <div className="h-1 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, pct * 3)}%`, background: color }} />
      </div>
    </div>
  )
}

// ── GA4 channel label map ────────────────────────────────────────────────────
const CHANNEL_LABEL: Record<string, string> = {
  'Organic Search': 'Orgánico', 'Paid Search': 'Pago (Search)',
  'Paid Social': 'Pago (Social)', 'Organic Social': 'Social orgánico',
  'Direct': 'Directo', 'Referral': 'Referido', 'Email': 'Email',
  'Unassigned': 'Sin clasificar', '(none)': 'Sin clasificar',
}

// ── Main component ───────────────────────────────────────────────────────────
export function PerformanceSection({
  since, until, acHex, isLight,
}: {
  since: string; until: string; acHex: string; isLight: boolean
}) {
  const [data, setData]       = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    setLoading(true); setError(null)
    fetch(`/api/performance?since=${since}&until=${until}`)
      .then(r => r.json())
      .then((d: PerformanceData) => { setData(d); setLoading(false) })
      .catch(() => { setError('Error al cargar datos de rendimiento'); setLoading(false) })
  }, [since, until])

  const cardCls = 'rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5'
  const titleCls = 'text-[10px] uppercase tracking-[0.18em] text-white/55 mb-4'

  if (loading) return (
    <div className={cardCls + ' flex items-center justify-center h-32'}>
      <div className="flex gap-1.5">
        {[0,150,300].map(d => (
          <span key={d} className="w-1.5 h-1.5 rounded-full animate-bounce"
            style={{ background: acHex, animationDelay: `${d}ms` }} />
        ))}
      </div>
    </div>
  )
  if (error) return (
    <div className={cardCls + ' text-red-400/70 text-xs font-mono'}>{error}</div>
  )
  if (!data) return null

  const { gads, clarity, ga4 } = data

  return (
    <div className="space-y-4">

      {/* ══ Google Ads ═══════════════════════════════════════════════ */}
      <div className={cardCls}>
        <div className="flex items-center justify-between mb-5">
          <h3 className={titleCls + ' mb-0 flex items-center gap-1.5'}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#4285F4' }} />
            Google Ads
            <HelpTip text="Métricas de Google Ads para el período seleccionado. Incluye todas las campañas activas." />
          </h3>
          {gads ? (
            <span className="text-[10px] text-emerald-400/70 font-mono">{data.since} → {data.until}</span>
          ) : (
            <span className="text-[10px] text-white/25">sin credenciales</span>
          )}
        </div>

        {gads ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* KPIs globales */}
            <div>
              <p className="text-[9px] uppercase tracking-widest text-white/30 mb-3">Totales del período</p>
              <StatRow label="Gasto total"     value={ARS(gads.totalCostARS)}
                tip="Inversión total en Google Ads durante el período." />
              <StatRow label="Impresiones"     value={NUM(gads.totalImpressions)} />
              <StatRow label="Clicks"          value={NUM(gads.totalClicks)} />
              <StatRow label="CTR"             value={PCT(gads.ctr * 100)}
                tip="Click-Through Rate: % de personas que hacen click al ver el anuncio. Saludable en Search: ≥5%."
                highlight={gads.ctr >= 0.05} />
              <StatRow label="CPC promedio"    value={ARS(gads.avgCpc)}
                tip="Costo promedio por click. Más bajo = más eficiente." />
              <StatRow label="Conversiones"    value={gads.totalConversions.toFixed(1)}
                highlight={gads.totalConversions > 0} />
              <StatRow label="Valor conv."     value={ARS(gads.totalConvValue)} />
              <StatRow label="ROAS Google"     value={gads.roas > 0 ? `${gads.roas.toFixed(1)}x` : '—'}
                highlight={gads.roas >= 3}
                tip="Return On Ad Spend de Google. ROAS = valor de conversiones / gasto. Saludable: ≥3x." />
            </div>

            {/* Campañas */}
            <div>
              <p className="text-[9px] uppercase tracking-widest text-white/30 mb-3">Campañas activas</p>
              {gads.campaigns.length === 0 ? (
                <p className="text-[11px] text-white/30 italic">Sin campañas activas en el período</p>
              ) : (
                <div className="space-y-2">
                  {gads.campaigns.map(c => (
                    <div key={c.id} className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-[11px] text-white/80 font-medium leading-tight">{c.name}</p>
                          <p className="text-[9px] text-white/30 mt-0.5">{fmtCampaignType(c.type)}</p>
                        </div>
                        <span className="text-[9px] text-emerald-400/70 bg-emerald-400/10 rounded-full px-2 py-0.5 flex-shrink-0">
                          {c.status === 'ENABLED' ? 'Activa' : c.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-[10px] font-mono text-white/70">{NUM(c.clicks)}</p>
                          <p className="text-[9px] text-white/30">clicks</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-mono text-white/70">{PCT(c.ctr * 100)}</p>
                          <p className="text-[9px] text-white/30">CTR</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-mono text-white/70">{ARS(c.costARS)}</p>
                          <p className="text-[9px] text-white/30">gasto</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-4 text-center">
            <p className="text-[11px] text-white/40 mb-2">Configurá las credenciales de Google Ads en Vercel</p>
            <p className="text-[10px] text-white/25 font-mono">GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET · GOOGLE_REFRESH_TOKEN · GOOGLE_ADS_DEVELOPER_TOKEN</p>
          </div>
        )}
      </div>

      {/* ══ Clarity + GA4 ══════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Clarity */}
        <div className={cardCls}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={titleCls + ' mb-0 flex items-center gap-1.5'}>
              <span className="w-2 h-2 rounded-full inline-block bg-purple-400" />
              Microsoft Clarity
              <HelpTip text="Comportamiento real de usuarios en infomicelium.com.ar. Sesiones, scroll, fricción y dispositivos." />
            </h3>
          </div>

          {clarity && clarity.sessions > 0 ? (
            <div className="space-y-0">
              {/* Métricas principales */}
              <StatRow label="Sesiones"     value={NUM(clarity.sessions)} />
              <StatRow label="Usuarios únicos" value={NUM(clarity.users)} />
              <StatRow label="Tiempo activo" value={fmtDur(clarity.activeTime)}
                tip="Tiempo promedio que el usuario interactuó activamente con la página (scroll, clicks, etc.)." />
              <StatRow label="Scroll promedio" value={PCT(clarity.scrollDepth)}
                highlight={clarity.scrollDepth >= 60}
                tip="Qué tan abajo llegan los usuarios en promedio. Menos del 50% → la mayoría no llega al precio/CTA." />

              {/* Dispositivos */}
              <div className="pt-3 pb-1">
                <p className="text-[9px] uppercase tracking-widest text-white/25 mb-2">Dispositivos</p>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-white/45">Mobile</span>
                      <span className="font-mono text-white/70">{PCT(clarity.mobilePct)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-purple-400/60"
                        style={{ width: `${clarity.mobilePct}%` }} />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-white/45">Desktop</span>
                      <span className="font-mono text-white/70">{PCT(clarity.desktopPct)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-indigo-400/60"
                        style={{ width: `${clarity.desktopPct}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Fricción */}
              <div className="pt-3 border-t border-white/5">
                <p className="text-[9px] uppercase tracking-widest text-white/25 mb-2 flex items-center gap-1">
                  Señales de fricción
                  <HelpTip text="% de sesiones con ese tipo de fricción. Quickback alto → la primera pantalla no convence. Rage clicks → elementos que parecen clickeables pero no lo son." />
                </p>
                <FrictionBar label="Quickback"    pct={clarity.quickbackPct}
                  color={clarity.quickbackPct > 10 ? '#f87171' : '#facc15'} />
                <FrictionBar label="Rage clicks"  pct={clarity.rageClickPct}   color="#f97316" />
                <FrictionBar label="Dead clicks"  pct={clarity.deadClickPct}   color="#818cf8" />
              </div>
            </div>
          ) : clarity ? (
            <div className="py-6 text-center">
              <p className="text-[11px] text-white/40">Sin datos suficientes aún</p>
              <p className="text-[10px] text-white/25 mt-1">Clarity acaba de instalarse — revisá en 48hs</p>
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="text-[11px] text-white/40">No configurado</p>
              <p className="text-[10px] text-white/25 font-mono mt-1">CLARITY_TOKEN · CLARITY_PROJECT_ID</p>
            </div>
          )}
        </div>

        {/* GA4 */}
        <div className={cardCls}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={titleCls + ' mb-0 flex items-center gap-1.5'}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#E37400' }} />
              Google Analytics 4
              <HelpTip text="Tráfico y comportamiento de sesiones en infomicelium.com.ar según GA4." />
            </h3>
          </div>

          {ga4 ? (
            <div>
              <StatRow label="Sesiones"         value={NUM(ga4.sessions)} />
              <StatRow label="Usuarios"          value={NUM(ga4.users)} />
              <StatRow label="Páginas vistas"    value={NUM(ga4.pageviews)} />
              <StatRow label="Bounce rate"       value={PCT(ga4.bounceRate * 100)}
                highlight={ga4.bounceRate < 0.6}
                tip="% de sesiones de una sola página. Menor es mejor. Saludable: < 60%." />
              <StatRow label="Duración sesión"   value={fmtDur(ga4.avgSessionDur)}
                highlight={ga4.avgSessionDur > 60}
                tip="Tiempo promedio de sesión. Para producto de alta consideración, objetivo: > 60s." />

              {ga4.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-[9px] uppercase tracking-widest text-white/25 mb-2">Fuentes de tráfico</p>
                  {ga4.sources.slice(0, 5).map(s => {
                    const pct = ga4.sessions > 0 ? (s.sessions / ga4.sessions) * 100 : 0
                    const label = CHANNEL_LABEL[s.channel] ?? s.channel
                    return (
                      <div key={s.channel} className="mb-2">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-white/50">{label}</span>
                          <span className="font-mono text-white/60">{NUM(s.sessions)} ({PCT(pct)})</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: acHex + 'aa' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="py-6 text-center space-y-2">
              <p className="text-[11px] text-white/40">Necesitás el Property ID numérico de GA4</p>
              <p className="text-[10px] text-white/25 leading-relaxed">
                En GA4: Administrar → Configuración de la propiedad → Property ID
              </p>
              <p className="text-[10px] text-white/25 font-mono mt-1">env var: GA4_PROPERTY_ID</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
