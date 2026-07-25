'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { RefreshCw, Star, Camera, TriangleAlert, Clock } from 'lucide-react'
import { CARD, BTN, ACENTO, TITULO, SECCION, SECCION_SUB, TONOS, type TonoKey } from '@/components/widgets/ui'
import { NumeroRodante } from '@/components/widgets/NumeroRodante'
import { SidebarNav } from '@/components/SidebarNav'
import { BorderBeam } from '@/components/ui/border-beam'
import { AnimatedGridPattern } from '@/components/ui/animated-grid-pattern'
import { Button } from '@/components/ui/button'

// Moderación de reseñas. Las del formulario público nacen pendientes y no se muestran en el
// sitio hasta que se aprueban acá. Las de WhatsApp/Google entran ya aprobadas (son verificadas),
// pero también se pueden ocultar desde acá si hiciera falta.
//
// Estética: mismo tema oscuro glass del resto del motor (ver components/widgets/ui). Antes esta
// pantalla era la única isla clara con texto #171717 → sobre el fondo oscuro quedaba negro sobre
// negro, ilegible.
//
// Lectura de la pantalla, de arriba abajo: primero el estado general (KPIs), después qué pide
// atención hoy (avisos, que son filtros de un clic), después la tendencia (gráfico), y recién
// al final la lista para moderar. La reseña es prueba social: lo que importa no es la reseña
// suelta sino si el flujo sigue vivo y si hay algo malo publicado.

type Resena = {
  id: string
  autor: string
  texto: string
  rating: number | null
  source: 'whatsapp' | 'google' | 'form'
  approved: boolean
  producto: string | null
  foto: string | null
  fecha: string
}

type Resumen = {
  total: number
  aprobadas: number
  pendientes: number
  sinPuntaje: number
  negativas: number
  conFoto: number
  promedio: number | null
  distribucion: { estrellas: number; n: number }[]
  fuentes: { source: string; n: number }[]
  meses: { key: string; label: string; n: number; promedio: number | null }[]
  ultimos30: number
  previos30: number
}

const FUENTE: Record<string, { label: string; color: string }> = {
  whatsapp: { label: 'WhatsApp', color: '#34d399' },
  google: { label: 'Google', color: '#60a5fa' },
  form: { label: 'Formulario', color: '#fbbf24' },
}

const DORADO = '#fbbf24'
const NUM = (n: number) => new Intl.NumberFormat('es-AR').format(n)

/** Días desde una fecha ISO corta (yyyy-mm-dd). Sirve para envejecer lo pendiente. */
const diasDesde = (iso: string) => Math.floor((Date.now() - new Date(`${iso}T00:00:00`).getTime()) / 864e5)

/** Estrellas editables: clic fija el puntaje. Sirve sobre todo para las de WhatsApp, que
    llegan sin estrellas y conviene puntuar a mano según lo que dice el texto. */
function Estrellas({ n, onSet }: { n: number | null; onSet: (v: number) => void }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="tracking-[1px] text-[17px]">
        {[1, 2, 3, 4, 5].map(i => (
          <button
            key={i}
            type="button"
            onClick={() => onSet(i)}
            title={`${i} estrella${i > 1 ? 's' : ''}`}
            style={{ color: n && i <= n ? DORADO : 'rgba(255,255,255,0.18)', lineHeight: 1 }}
            className="cursor-pointer transition-transform hover:scale-110"
          >
            ★
          </button>
        ))}
      </span>
      {!n && <span className="text-[11px] text-white/35">sin puntaje — clic para asignar</span>}
    </span>
  )
}

function Kpi({ label, valor, sub, tono, alerta }: { label: string; valor: string; sub?: string; tono: TonoKey; alerta?: boolean }) {
  const t = TONOS[tono]
  return (
    <div
      className="relative flex min-h-[116px] flex-col justify-between overflow-hidden rounded-2xl border p-4"
      style={{ background: t.fondo, borderColor: t.borde }}
    >
      {alerta && (
        <BorderBeam size={80} duration={9} borderWidth={1.5} colorFrom="#fbbf24" colorTo="#f43f5e" className="opacity-70" />
      )}
      <p className="text-[11px] font-semibold uppercase leading-none tracking-[0.15em] text-white/50">{label}</p>
      <div>
        <p className="font-mono text-[34px] font-bold leading-none tracking-tight text-white">
          <NumeroRodante value={valor} />
        </p>
        {sub && <p className="mt-2 text-[12px] leading-snug text-white/50">{sub}</p>}
      </div>
    </div>
  )
}

function TooltipChart({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-[150px] rounded-xl border border-white/10 bg-[#0d0d18]/95 p-3 text-xs shadow-2xl backdrop-blur-md">
      <p className="mb-2 font-semibold text-white/50">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="mb-1 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-white/60">{p.name}</span>
          </div>
          <span className="font-mono font-semibold text-white">{p.value ?? '—'}</span>
        </div>
      ))}
    </div>
  )
}

type Chip = 'pendientes' | 'sin_puntaje' | 'negativas' | 'con_foto' | null

export default function ResenasPage() {
  const [resenas, setResenas] = useState<Resena[]>([])
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [filtro, setFiltro] = useState<'pendientes' | 'aprobadas' | 'todas'>('pendientes')
  const [chip, setChip] = useState<Chip>(null)
  const [fuente, setFuente] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [cargando, setCargando] = useState(true)

  // Se traen todas y se filtra en el navegador: son pocas (tope 300) y así los avisos de
  // arriba funcionan como filtros instantáneos, sin ir y volver al servidor por cada clic.
  const cargar = useCallback(async () => {
    setCargando(true)
    const r = await fetch('/api/resenas?estado=todas')
    const d = await r.json()
    setResenas(d.resenas ?? [])
    setResumen(d.resumen ?? null)
    setCargando(false)
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  async function aprobar(id: string, approved: boolean) {
    setResenas(rs => rs.map(r => (r.id === id ? { ...r, approved } : r)))
    await fetch('/api/resenas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, approved }),
    })
    void cargar()
  }

  async function fijarRating(id: string, rating: number) {
    // Optimista: se ve el cambio al toque y se persiste en segundo plano.
    setResenas(rs => rs.map(r => (r.id === id ? { ...r, rating } : r)))
    await fetch('/api/resenas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, rating }),
    })
  }

  async function descartar(id: string) {
    if (!confirm('¿Descartar esta reseña? No se puede deshacer.')) return
    await fetch(`/api/resenas?id=${id}`, { method: 'DELETE' })
    void cargar()
  }

  const visibles = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return resenas.filter(r => {
      if (filtro === 'pendientes' && r.approved) return false
      if (filtro === 'aprobadas' && !r.approved) return false
      if (chip === 'pendientes' && r.approved) return false
      if (chip === 'sin_puntaje' && typeof r.rating === 'number') return false
      if (chip === 'negativas' && !(typeof r.rating === 'number' && r.rating <= 3)) return false
      if (chip === 'con_foto' && !r.foto) return false
      if (fuente && r.source !== fuente) return false
      if (q && !`${r.autor} ${r.texto} ${r.producto ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [resenas, filtro, chip, fuente, busca])

  const pendientes = resumen?.pendientes ?? 0
  const maxDist = Math.max(1, ...(resumen?.distribucion.map(d => d.n) ?? [1]))
  // La pendiente más vieja: si hay una esperando hace días, el sitio está mostrando menos
  // prueba social de la que ya se ganó.
  const masVieja = useMemo(() => {
    const p = resenas.filter(r => !r.approved)
    if (!p.length) return null
    return Math.max(...p.map(r => diasDesde(r.fecha)))
  }, [resenas])

  const delta = resumen ? resumen.ultimos30 - resumen.previos30 : 0

  const TABS: { key: typeof filtro; label: string }[] = [
    { key: 'pendientes', label: `Pendientes${pendientes ? ` (${pendientes})` : ''}` },
    { key: 'aprobadas', label: 'Publicadas' },
    { key: 'todas', label: 'Todas' },
  ]

  const AVISOS: { key: Exclude<Chip, null>; icon: typeof Star; label: string; n: number; color: string; ayuda: string }[] = resumen
    ? [
        { key: 'pendientes', icon: Clock, label: 'Esperando aprobación', n: resumen.pendientes, color: '#fbbf24', ayuda: masVieja !== null && masVieja > 0 ? `la más vieja hace ${masVieja} día${masVieja > 1 ? 's' : ''}` : 'sin publicar en el sitio' },
        { key: 'negativas', icon: TriangleAlert, label: '3 estrellas o menos', n: resumen.negativas, color: '#f87171', ayuda: 'revisar qué dicen' },
        { key: 'sin_puntaje', icon: Star, label: 'Sin puntaje', n: resumen.sinPuntaje, color: '#a5b4fc', ayuda: 'no suman al promedio' },
        { key: 'con_foto', icon: Camera, label: 'Con foto', n: resumen.conFoto, color: '#5eead4', ayuda: 'material para contenido' },
      ]
    : []

  return (
    <main
      className="dark fx-holo relative isolate min-h-screen px-5 pb-8 pt-16 font-sans text-white/70 md:px-8 lg:pl-[256px] lg:pt-8"
      style={{
        '--ac': '167 139 250',
        background:
          'radial-gradient(ellipse 90% 40% at 50% -5%, rgb(167 139 250 / 0.10) 0%, transparent 55%), #07070f',
      } as React.CSSProperties}
    >
      <SidebarNav />

      {/* Ambiente holográfico igual que el resto del motor: decorativo, detrás y sin puntero. */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <AnimatedGridPattern
          numSquares={22}
          maxOpacity={0.05}
          duration={5}
          className="absolute inset-x-0 -top-1/4 h-[140%] skew-y-12 text-cyan-300/40 [mask-image:radial-gradient(ellipse_at_top,white,transparent_75%)]"
        />
        <div className="absolute -top-40 left-[18%] h-[480px] w-[480px] rounded-full bg-cyan-500/10 blur-[130px]" style={{ animation: 'aurora 12s ease-in-out infinite alternate' }} />
        <div className="absolute right-[14%] top-24 h-[440px] w-[440px] rounded-full bg-violet-500/10 blur-[130px]" style={{ animation: 'aurora 14s ease-in-out infinite alternate' }} />
      </div>

      {/* ── Encabezado ─────────────────────────────────────────────── */}
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: ACENTO }}>
            Prueba social
          </p>
          <h1 className="text-[32px] font-semibold leading-none tracking-tight text-white md:text-[36px]" style={{ fontFamily: TITULO }}>
            Reseñas
          </h1>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/70">
            Las del formulario del sitio quedan acá pendientes hasta que las aprobás. Las de
            WhatsApp y Google entran ya publicadas.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void cargar()}>
          <RefreshCw />
          Actualizar
        </Button>
      </div>

      {/* ── Estado general ─────────────────────────────────────────── */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          tono="salvia"
          label="Publicadas"
          valor={NUM(resumen?.aprobadas ?? 0)}
          sub={resumen ? `de ${NUM(resumen.total)} recibidas` : 'cargando…'}
        />
        <Kpi
          tono="durazno"
          label="Promedio"
          valor={resumen?.promedio ? resumen.promedio.toFixed(2).replace('.', ',') : '—'}
          sub={resumen ? `${NUM(resumen.total - resumen.sinPuntaje)} con puntaje` : ''}
        />
        <Kpi
          tono="violeta"
          label="Pendientes"
          valor={NUM(pendientes)}
          alerta={pendientes > 0}
          sub={pendientes === 0 ? 'todo al día' : masVieja !== null ? `hasta ${masVieja} días esperando` : 'sin publicar'}
        />
        <Kpi
          tono="celeste"
          label="Últimos 30 días"
          valor={NUM(resumen?.ultimos30 ?? 0)}
          sub={resumen ? (delta === 0 ? 'igual que el mes previo' : `${delta > 0 ? '+' : ''}${delta} vs. 30 días antes`) : ''}
        />
      </div>

      {/* ── Avisos ─────────────────────────────────────────────────── */}
      {/* Cada aviso es un filtro de un clic: ver el número y actuar sobre él no debería ser
          dos gestos distintos. */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {AVISOS.map(a => {
          const on = chip === a.key
          const Icon = a.icon
          const apagado = a.n === 0
          return (
            <button
              key={a.key}
              disabled={apagado}
              onClick={() => { setChip(on ? null : a.key); if (!on) setFiltro('todas') }}
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors ${
                apagado ? 'cursor-default opacity-40' : 'hover:border-white/25'
              }`}
              style={{
                borderColor: on ? a.color : 'rgba(255,255,255,0.08)',
                background: on ? `${a.color}1f` : 'rgba(255,255,255,0.02)',
              }}
            >
              <Icon className="size-4 shrink-0" style={{ color: a.color }} />
              <span className="min-w-0">
                <span className="block font-mono text-[19px] font-bold leading-none text-white">{NUM(a.n)}</span>
                <span className="mt-1 block truncate text-[12px] leading-tight text-white/60">{a.label}</span>
                <span className="block truncate text-[11px] leading-tight text-white/35">{a.ayuda}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Tendencia y reparto ────────────────────────────────────── */}
      <div className="mb-6 grid gap-3 lg:grid-cols-3">
        <div className={`${CARD} p-5 lg:col-span-2`}>
          <h2 className={SECCION}>Cómo viene el flujo</h2>
          <p className={`mb-4 mt-1 ${SECCION_SUB}`}>
            Cuántas llegan por mes (barras) y con qué puntaje promedio (línea). Un mes en cero
            no es un bache de opinión: es que nadie pidió la reseña.
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={resumen?.meses ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="p" orientation="right" domain={[0, 5]} ticks={[0, 5]} tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} axisLine={false} tickLine={false} width={22} />
              <Tooltip content={<TooltipChart />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
              <Bar dataKey="n" name="Reseñas" fill="#a78bfa" opacity={0.7} radius={[3, 3, 0, 0]} />
              <Line
                yAxisId="p"
                type="monotone"
                dataKey="promedio"
                name="Promedio"
                connectNulls
                stroke={DORADO}
                strokeWidth={2}
                dot={{ r: 3, fill: DORADO, strokeWidth: 0 }}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className={`${CARD} p-5`}>
          <h2 className={SECCION}>Puntajes</h2>
          <p className={`mb-4 mt-1 ${SECCION_SUB}`}>Dónde se concentran las estrellas.</p>
          <div className="space-y-2">
            {(resumen?.distribucion ?? []).map(d => (
              <button
                key={d.estrellas}
                onClick={() => { setFiltro('todas'); setChip(null); setBusca('') }}
                className="flex w-full items-center gap-3"
                title={`${d.n} reseña${d.n === 1 ? '' : 's'} de ${d.estrellas} estrellas`}
              >
                <span className="w-9 shrink-0 text-right font-mono text-[12px] text-white/45">{d.estrellas}★</span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.span
                    className="block h-full rounded-full"
                    style={{ background: d.estrellas <= 3 ? '#f87171' : DORADO }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(d.n / maxDist) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 22 }}
                  />
                </span>
                <span className="w-7 shrink-0 font-mono text-[12px] text-white/70">{d.n}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">De dónde vienen</p>
            <div className="flex flex-wrap gap-2">
              {(resumen?.fuentes ?? []).map(f => {
                const meta = FUENTE[f.source] ?? FUENTE.form
                const on = fuente === f.source
                return (
                  <button
                    key={f.source}
                    disabled={f.n === 0}
                    onClick={() => { setFuente(on ? null : f.source); setFiltro('todas') }}
                    className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${f.n === 0 ? 'cursor-default opacity-35' : 'hover:border-white/30'}`}
                    style={{
                      borderColor: on ? meta.color : 'rgba(255,255,255,0.1)',
                      background: on ? `${meta.color}26` : 'transparent',
                      color: on ? '#fff' : 'rgba(255,255,255,0.6)',
                    }}
                  >
                    <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: meta.color }} />
                    {meta.label} <span className="font-mono text-white/50">{f.n}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Moderación ─────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className={`${CARD} flex gap-1 p-1`} data-isolated>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setFiltro(t.key); setChip(null) }}
              className="relative rounded-xl px-4 py-1.5 text-[13px] font-medium transition-colors"
              style={{ color: filtro === t.key && !chip ? ACENTO : 'rgba(255,255,255,0.5)' }}
            >
              {filtro === t.key && !chip && (
                <motion.span
                  layoutId="tabResenas"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: 'rgb(var(--ac) / 0.15)' }}
                  transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                />
              )}
              <span className="relative z-10">{t.label}</span>
            </button>
          ))}
        </div>

        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nombre, texto o producto…"
          className="min-w-[220px] flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/80 transition-colors placeholder:text-white/30 focus:border-white/25 focus:outline-none focus:ring-2 focus:ring-white/10"
        />

        {(chip || fuente || busca) && (
          <button className={BTN} onClick={() => { setChip(null); setFuente(null); setBusca('') }}>
            Limpiar filtros
          </button>
        )}
      </div>

      <p className="mb-3 text-[12px] text-white/35">
        {cargando ? 'Cargando…' : `${visibles.length} de ${resenas.length} reseñas`}
      </p>

      <div className="space-y-3">
        {!cargando && visibles.length === 0 && (
          <div className={`${CARD} p-8 text-center text-sm text-white/40`}>
            No hay reseñas para mostrar con estos filtros.
          </div>
        )}
        {visibles.map(r => {
          const f = FUENTE[r.source] ?? FUENTE.form
          const negativa = typeof r.rating === 'number' && r.rating <= 3
          const dias = diasDesde(r.fecha)
          return (
            <div
              key={r.id}
              className={`${CARD} p-4`}
              style={
                negativa
                  ? { borderColor: 'rgb(248 113 113 / 0.3)', background: 'rgb(248 113 113 / 0.05)' }
                  : !r.approved
                    ? { borderColor: 'rgb(251 191 36 / 0.25)' }
                    : undefined
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-white">{r.autor}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{ background: `${f.color}26`, color: f.color }}
                    >
                      {f.label}
                    </span>
                    {!r.approved && (
                      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                        Pendiente
                      </span>
                    )}
                    {negativa && (
                      <span className="rounded-full bg-red-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300">
                        Puntaje bajo
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5"><Estrellas n={r.rating} onSet={v => fijarRating(r.id, v)} /></div>
                  {r.producto && <div className="mt-1.5 text-[11px] text-white/40">{r.producto}</div>}
                </div>
                <span className="shrink-0 text-right text-[11px] text-white/35">
                  {r.fecha}
                  {dias >= 0 && <span className="block text-white/25">hace {dias === 0 ? 'hoy' : `${dias} d`}</span>}
                </span>
              </div>

              {r.foto && (
                <a href={r.foto} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.foto} alt="" className="mt-3 max-h-40 rounded-lg border border-white/10" />
                </a>
              )}

              <p className="mt-2.5 text-sm leading-relaxed text-white/75">{r.texto}</p>

              <div className="mt-3 flex gap-2">
                {r.approved ? (
                  <button className={BTN} onClick={() => aprobar(r.id, false)}>Ocultar del sitio</button>
                ) : (
                  <button
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-[#0b0b14] transition-opacity hover:opacity-90"
                    style={{ background: ACENTO }}
                    onClick={() => aprobar(r.id, true)}
                  >
                    Aprobar y publicar
                  </button>
                )}
                <button className={`${BTN} hover:!border-red-400/50 hover:!text-red-300`} onClick={() => descartar(r.id)}>
                  Descartar
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}
