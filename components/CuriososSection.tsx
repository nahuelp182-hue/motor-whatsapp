'use client'
import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell,
} from 'recharts'
import { Ayuda } from '@/components/panel/Primitivos'

// Colores por canal — consistentes con AttributionSection.
const CANAL_META: Record<string, { label: string; color: string }> = {
  meta_ads:   { label: 'Meta (anuncios)', color: 'var(--pnl-amber)' },
  google_ads: { label: 'Google Ads',      color: 'var(--pnl-lilac-soft)' },
  seo:        { label: 'Google SEO',       color: 'var(--pnl-green)' },
  directo:    { label: 'Directo',          color: 'var(--pnl-lilac)' },
  otro_utm:   { label: 'Otro',             color: 'var(--pnl-text-3)' },
}

type Cohorte = {
  canal: string
  visitantes: number
  curiosidad: {
    dwell_1ra_visita_s: number | null
    scroll_1ra_visita_pct: number | null
    engaged_1ra_visita_pct: number | null
  }
  retorno_pct: number | null
  recompra: {
    total_pct: number | null
    d30_pct: number | null
    d60_pct: number | null
    d90_pct: number | null
    mediana_dias: number | null
  }
}
type Resp = { store: string; generado: string; cohortes: Cohorte[] }

const meta = (c: string) => CANAL_META[c] ?? { label: c, color: 'var(--pnl-text-3)' }
const pct = (n: number | null) => (n == null ? '—' : `${n.toFixed(0)}%`)
const seg = (n: number | null) => {
  if (n == null) return '—'
  if (n < 60) return `${n.toFixed(0)}s`
  const m = Math.floor(n / 60)
  return `${m}m ${Math.round(n % 60)}s`
}

export function CuriososSection({ acHex }: { acHex: string }) {
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/analytics/curiosos')
      .then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json() })
      .then((d: Resp) => { setData(d); setLoading(false) })
      .catch((e: Error) => { setErr(e.message); setLoading(false) })
  }, [])

  const cardCls = 'rounded-2xl border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] p-5'
  const titleCls = 'text-[10px] uppercase tracking-[0.18em] text-[var(--pnl-text-2)] flex items-center gap-1.5'

  const cohortes = (data?.cohortes ?? []).filter((c) => c.visitantes > 0)
  // Orden fijo por relevancia comercial.
  const orden = ['meta_ads', 'google_ads', 'seo', 'directo', 'otro_utm']
  cohortes.sort((a, b) => orden.indexOf(a.canal) - orden.indexOf(b.canal))

  const chartData = cohortes.map((c) => ({
    canal: meta(c.canal).label,
    color: meta(c.canal).color,
    Retorno: c.retorno_pct ?? 0,
    'Recompra 90d': c.recompra.d90_pct ?? 0,
  }))

  return (
    <div className={cardCls}>
      <div className="flex items-center justify-between mb-1">
        <h3 className={titleCls}>
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: acHex }} />
          Curiosos: quién mira, quién vuelve, quién compra
          <Ayuda>{"Sigue a cada visitante con un ID de primera parte. El canal se sella en la 1ra visita (fbclid/referrer) y no se pisa aunque después vuelva por directo. Separa el tráfico de anuncios de Meta del SEO/directo de Google. 'Curiosidad' = permanencia en la 1ra visita; 'Retorno' = volvió con sesión real otro día; 'Recompra' = compró dentro de 90 días."}</Ayuda>
        </h3>
        {data && (
          <span className="text-[10px] text-[var(--pnl-text-3)] font-mono">
            histórico · {new Date(data.generado).toLocaleDateString('es-AR')}
          </span>
        )}
      </div>
      <p className="text-[10px] text-[var(--pnl-text-3)] mb-4">
        Sirve para decidir presupuesto: si Meta trae mucho curioso que no vuelve ni compra, el TOFU está mal apuntado.
      </p>

      {loading && <div className="h-40 flex items-center justify-center text-[var(--pnl-text-3)] text-xs">Cargando…</div>}
      {err && <div className="h-40 flex items-center justify-center text-[var(--pnl-text-3)] text-xs">Sin datos todavía — se llena cuando el tracker esté activo en la tienda.</div>}

      {!loading && !err && cohortes.length === 0 && (
        <div className="h-40 flex items-center justify-center text-[var(--pnl-text-3)] text-xs text-center px-6">
          Sin visitas registradas aún. Los datos aparecen cuando <code className="text-[var(--pnl-text-3)]">curiosos.js</code> esté inyectado y empiece a llegar tráfico.
        </div>
      )}

      {!loading && !err && cohortes.length > 0 && (
        <>
          {/* Tarjetas por canal */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
            {cohortes.map((c) => {
              const m = meta(c.canal)
              return (
                <div key={c.canal} className="rounded-xl bg-[var(--pnl-panel-2)] border border-[var(--pnl-hair)] p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color }} />
                    <span className="text-[11px] text-[var(--pnl-text)] truncate">{m.label}</span>
                  </div>
                  <p className="text-lg font-bold font-mono text-[var(--pnl-text)]">{c.visitantes}</p>
                  <p className="text-[9px] text-[var(--pnl-text-3)] mb-2">visitantes</p>
                  <div className="space-y-1 text-[10px]">
                    <Row k="Permanencia 1ª" v={seg(c.curiosidad.dwell_1ra_visita_s)} />
                    <Row k="Enganchan" v={pct(c.curiosidad.engaged_1ra_visita_pct)} />
                    <Row k="Vuelven" v={pct(c.retorno_pct)} />
                    <Row k="Compran 90d" v={pct(c.recompra.d90_pct)} strong />
                    <Row k="Días a compra" v={c.recompra.mediana_dias == null ? '—' : `${c.recompra.mediana_dias.toFixed(0)}d`} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Gráfico comparativo retorno vs recompra */}
          <p className="text-[9px] uppercase tracking-widest text-[var(--pnl-text-3)] mb-3">Retorno vs recompra por canal (%)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barGap={4}>
              <CartesianGrid vertical={false} stroke="var(--pnl-hair)" />
              <XAxis dataKey="canal" tick={{ fill: 'var(--pnl-text-2)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--pnl-text-3)', fontSize: 10 }}
                tickFormatter={(v: number) => `${v}%`} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--pnl-panel)', border: '1px solid var(--pnl-hair)', borderRadius: 10, fontSize: 11 }}
                formatter={(v: unknown, name: unknown) => [`${Number(v).toFixed(0)}%`, String(name)]}
                cursor={{ fill: 'var(--pnl-panel-2)' }}
              />
              <Legend wrapperStyle={{ fontSize: 10, color: 'var(--pnl-text-3)', paddingTop: 4 }} iconSize={7} iconType="circle" />
              <Bar dataKey="Retorno" fill={acHex} opacity={0.55} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Recompra 90d" radius={[3, 3, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  )
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--pnl-text-3)]">{k}</span>
      <span className={`font-mono ${strong ? 'text-[var(--pnl-green-text)]/90 font-semibold' : 'text-[var(--pnl-text)]'}`}>{v}</span>
    </div>
  )
}
