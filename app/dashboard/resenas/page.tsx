'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { RefreshCw, Star, Camera, TriangleAlert, Clock } from 'lucide-react'
import { CARD, BTN, ACENTO, SECCION, SECCION_SUB, TONOS, type TonoKey } from '@/components/widgets/ui'
import { NumeroRodante } from '@/components/widgets/NumeroRodante'
import { PanelShell } from '@/components/PanelShell'
import { Banda, Seccion as PanelSeccion } from '@/components/panel/Primitivos'
import { Button } from '@/components/ui/button'

// Moderación de reseñas. Las del formulario público nacen pendientes y no se muestran en el
// sitio hasta que se aprueban acá. Las de WhatsApp/Google entran ya aprobadas (son verificadas),
// pero también se pueden ocultar desde acá si hiciera falta.
//
// Estética: sistema del panel — grafito + ámbar (ver components/widgets/ui.ts).
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
  whatsapp: { label: 'WhatsApp', color: '#4CAF7D' },
  google: { label: 'Google', color: '#7E86B8' },
  form: { label: 'Formulario', color: '#F5A623' },
}

const DORADO = '#F5A623'
const NUM = (n: number) => new Intl.NumberFormat('es-AR').format(n)

/** Días desde una fecha ISO corta (yyyy-mm-dd). Sirve para envejecer lo pendiente. */
const diasDesde = (iso: string) => Math.floor((Date.now() - new Date(`${iso}T00:00:00`).getTime()) / 864e5)

/** Estrellas editables: clic fija el puntaje. Sirve sobre todo para las de WhatsApp, que
    llegan sin estrellas y conviene puntuar a mano según lo que dice el texto. Cada botón
    tiene 44px de área táctil (el ::after) aunque la estrella se vea de 17px. */
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
            style={{ color: n && i <= n ? DORADO : 'var(--pnl-track)', lineHeight: 1 }}
            className="relative cursor-pointer p-1 transition-transform hover:scale-110 after:absolute after:left-1/2 after:top-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2"
          >
            ★
          </button>
        ))}
      </span>
      {!n && <span className="text-[11px] text-[var(--pnl-text-3)]">sin puntaje — clic para asignar</span>}
    </span>
  )
}

function Kpi({ label, valor, sub, tono, alerta }: { label: string; valor: string; sub?: string; tono: TonoKey; alerta?: boolean }) {
  const t = TONOS[tono]
  return (
    <div
      className="relative flex min-h-[116px] flex-col justify-between rounded-md border p-4"
      style={{ background: t.fondo, borderColor: alerta ? 'var(--pnl-amber)' : t.borde }}
    >
      <p className="text-[11px] font-semibold uppercase leading-none tracking-[0.15em] text-[var(--pnl-text-3)]">{label}</p>
      <div>
        <p className="num text-[34px] font-bold leading-none tracking-tight text-[var(--pnl-text)]">
          <NumeroRodante value={valor} />
        </p>
        {sub && <p className="mt-2 text-[12px] leading-snug text-[var(--pnl-text-3)]">{sub}</p>}
      </div>
    </div>
  )
}

function TooltipChart({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div data-isolated className="min-w-[150px] rounded-md border border-[var(--pnl-track)] bg-[#1B1E26] p-3 text-xs shadow-[0_16px_40px_rgba(0,0,0,.55)]">
      <p className="mb-2 font-semibold text-[var(--pnl-text-3)]">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="mb-1 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            <span className="text-[var(--pnl-text-2)]">{p.name}</span>
          </div>
          <span className="num font-semibold text-[var(--pnl-text)]">{p.value ?? '—'}</span>
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
        { key: 'pendientes', icon: Clock, label: 'Esperando aprobación', n: resumen.pendientes, color: '#F5A623', ayuda: masVieja !== null && masVieja > 0 ? `la más vieja hace ${masVieja} día${masVieja > 1 ? 's' : ''}` : 'sin publicar en el sitio' },
        { key: 'negativas', icon: TriangleAlert, label: '3 estrellas o menos', n: resumen.negativas, color: '#FF8A73', ayuda: 'revisar qué dicen' },
        { key: 'sin_puntaje', icon: Star, label: 'Sin puntaje', n: resumen.sinPuntaje, color: '#969DC9', ayuda: 'no suman al promedio' },
        { key: 'con_foto', icon: Camera, label: 'Con foto', n: resumen.conFoto, color: '#2BB3A3', ayuda: 'material para contenido' },
      ]
    : []

  return (
    <PanelShell
      titulo="Reseñas"
      sub="Prueba social — las del formulario nacen pendientes, las de WhatsApp y Google ya publicadas"
      accion={
        <Button variant="outline" size="sm" onClick={() => void cargar()}>
          <RefreshCw />
          Actualizar
        </Button>
      }
    >
      <PanelSeccion>
        <Banda n="01">Estado general</Banda>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
      </PanelSeccion>

      <PanelSeccion>
        <Banda n="02">Necesita tu criterio</Banda>
        {/* Cada aviso es un filtro de un clic: ver el número y actuar sobre él no debería ser
            dos gestos distintos. */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {AVISOS.map(a => {
            const on = chip === a.key
            const Icon = a.icon
            const apagado = a.n === 0
            return (
              <button
                key={a.key}
                disabled={apagado}
                onClick={() => { setChip(on ? null : a.key); if (!on) setFiltro('todas') }}
                className={`flex min-h-11 items-center gap-3 rounded-md border px-3.5 py-3 text-left transition-colors ${
                  apagado ? 'cursor-default opacity-40' : 'hover:border-[var(--pnl-track)]'
                }`}
                style={{
                  borderColor: on ? a.color : 'var(--pnl-hair)',
                  background: on ? `${a.color}1f` : 'var(--pnl-panel)',
                }}
              >
                <Icon className="size-4 shrink-0" style={{ color: a.color }} aria-hidden />
                <span className="min-w-0">
                  <span className="num block text-[19px] font-bold leading-none text-[var(--pnl-text)]">{NUM(a.n)}</span>
                  <span className="mt-1 block truncate text-[12px] leading-tight text-[var(--pnl-text-2)]">{a.label}</span>
                  <span className="block truncate text-[11px] leading-tight text-[var(--pnl-text-3)]">{a.ayuda}</span>
                </span>
              </button>
            )
          })}
        </div>
      </PanelSeccion>

      <PanelSeccion>
        <Banda n="03">Cómo viene el flujo</Banda>
        <div className="grid gap-3 lg:grid-cols-3">
          <div className={`${CARD} p-5 lg:col-span-2`}>
            <h2 className={SECCION}>Tendencia mensual</h2>
            <p className={`mb-4 mt-1 ${SECCION_SUB}`}>
              Cuántas llegan por mes (barras) y con qué puntaje promedio (línea). Un mes en cero
              no es un bache de opinión: es que nadie pidió la reseña.
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={resumen?.meses ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--pnl-hair)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--pnl-text-3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: 'var(--pnl-text-3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="p" orientation="right" domain={[0, 5]} ticks={[0, 5]} tick={{ fill: 'var(--pnl-text-3)', fontSize: 10 }} axisLine={false} tickLine={false} width={22} />
                <Tooltip content={<TooltipChart />} cursor={{ fill: 'rgba(245,166,35,.04)' }} />
                <Bar dataKey="n" name="Reseñas" fill="var(--pnl-lilac)" opacity={0.85} radius={[3, 3, 0, 0]} />
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
            <div className="flex flex-col gap-2">
              {(resumen?.distribucion ?? []).map(d => (
                <button
                  key={d.estrellas}
                  onClick={() => { setFiltro('todas'); setChip(null); setBusca('') }}
                  className="flex min-h-9 w-full items-center gap-3"
                  title={`${d.n} reseña${d.n === 1 ? '' : 's'} de ${d.estrellas} estrellas`}
                >
                  <span className="num w-9 shrink-0 text-right text-[12px] text-[var(--pnl-text-3)]">{d.estrellas}★</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--pnl-track)]">
                    <motion.span
                      className="block h-full rounded-full"
                      style={{ background: d.estrellas <= 3 ? 'var(--pnl-lilac)' : DORADO }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(d.n / maxDist) * 100}%` }}
                      transition={{ type: 'spring', stiffness: 120, damping: 22 }}
                    />
                  </span>
                  <span className="num w-7 shrink-0 text-[12px] text-[var(--pnl-text-2)]">{d.n}</span>
                </button>
              ))}
            </div>

            <div className="mt-5 border-t border-[var(--pnl-hair)] pt-4">
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--pnl-text-3)]">De dónde vienen</p>
              <div className="flex flex-wrap gap-2">
                {(resumen?.fuentes ?? []).map(f => {
                  const meta = FUENTE[f.source] ?? FUENTE.form
                  const on = fuente === f.source
                  return (
                    <button
                      key={f.source}
                      disabled={f.n === 0}
                      onClick={() => { setFuente(on ? null : f.source); setFiltro('todas') }}
                      className={`min-h-9 rounded-full border px-3 py-1 text-[12px] transition-colors ${f.n === 0 ? 'cursor-default opacity-35' : 'hover:border-[var(--pnl-track)]'}`}
                      style={{
                        borderColor: on ? meta.color : 'var(--pnl-hair)',
                        background: on ? `${meta.color}26` : 'transparent',
                        color: on ? 'var(--pnl-text)' : 'var(--pnl-text-2)',
                      }}
                    >
                      <span className="mr-1.5 inline-block size-1.5 rounded-full align-middle" style={{ background: meta.color }} />
                      {meta.label} <span className="num text-[var(--pnl-text-3)]">{f.n}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </PanelSeccion>

      <PanelSeccion>
        <Banda n="04">Moderación</Banda>
        <div className="flex flex-wrap items-center gap-2">
          <div className={`${CARD} flex gap-1 p-1`} data-isolated>
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => { setFiltro(t.key); setChip(null) }}
                className="relative min-h-9 rounded-md px-4 text-[13px] font-medium transition-colors"
                style={{ color: filtro === t.key && !chip ? ACENTO : 'var(--pnl-text-3)' }}
              >
                {filtro === t.key && !chip && (
                  <motion.span
                    layoutId="tabResenas"
                    className="absolute inset-0 rounded-md"
                    style={{ background: 'color-mix(in srgb, var(--pnl-amber) 15%, transparent)' }}
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
            className="min-h-11 min-w-[220px] flex-1 rounded-md border border-[var(--pnl-hair)] bg-[var(--pnl-panel-2)] px-3 text-sm text-[var(--pnl-text)] transition-colors placeholder:text-[var(--pnl-text-3)] focus-visible:border-[var(--pnl-track)] focus-visible:outline-2 focus-visible:outline-[var(--pnl-amber)]"
          />

          {(chip || fuente || busca) && (
            <button className={BTN} onClick={() => { setChip(null); setFuente(null); setBusca('') }}>
              Limpiar filtros
            </button>
          )}
        </div>

        <p className="text-[12px] text-[var(--pnl-text-3)]">
          {cargando ? 'Cargando…' : `${visibles.length} de ${resenas.length} reseñas`}
        </p>

        <div className="flex flex-col gap-3">
          {!cargando && visibles.length === 0 && (
            <div className={`${CARD} p-8 text-center text-sm text-[var(--pnl-text-3)]`}>
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
                    ? { borderColor: 'rgba(232,80,58,.3)', background: 'rgba(232,80,58,.05)' }
                    : !r.approved
                      ? { borderColor: 'rgba(245,166,35,.25)' }
                      : undefined
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[var(--pnl-text)]">{r.autor}</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        style={{ background: `${f.color}26`, color: f.color }}
                      >
                        {f.label}
                      </span>
                      {!r.approved && (
                        <span className="rounded-full bg-[rgba(245,166,35,.15)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--pnl-amber)]">
                          Pendiente
                        </span>
                      )}
                      {negativa && (
                        <span className="rounded-full bg-[rgba(232,80,58,.15)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--pnl-red-text)]">
                          Puntaje bajo
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5"><Estrellas n={r.rating} onSet={v => fijarRating(r.id, v)} /></div>
                    {r.producto && <div className="mt-1.5 text-[11px] text-[var(--pnl-text-3)]">{r.producto}</div>}
                  </div>
                  <span className="shrink-0 text-right text-[11px] text-[var(--pnl-text-3)]">
                    {r.fecha}
                    {dias >= 0 && <span className="block text-[var(--pnl-text-3)]">hace {dias === 0 ? 'hoy' : `${dias} d`}</span>}
                  </span>
                </div>

                {r.foto && (
                  <a href={r.foto} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.foto} alt="" className="mt-3 max-h-40 rounded-md border border-[var(--pnl-hair)]" />
                  </a>
                )}

                <p className="mt-2.5 text-sm leading-relaxed text-[var(--pnl-text-2)]">{r.texto}</p>

                <div className="mt-3 flex gap-2">
                  {r.approved ? (
                    <button className={BTN} onClick={() => aprobar(r.id, false)}>Ocultar del sitio</button>
                  ) : (
                    <button
                      className="min-h-9 rounded-md px-3 text-xs font-medium text-[#23262F] transition-opacity hover:opacity-90"
                      style={{ background: ACENTO }}
                      onClick={() => aprobar(r.id, true)}
                    >
                      Aprobar y publicar
                    </button>
                  )}
                  <button className={`${BTN} hover:!border-[var(--pnl-red)] hover:!text-[var(--pnl-red-text)]`} onClick={() => descartar(r.id)}>
                    Descartar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </PanelSeccion>
    </PanelShell>
  )
}
