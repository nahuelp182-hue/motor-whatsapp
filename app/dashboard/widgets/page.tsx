'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CampoEditor } from '@/components/widgets/CampoEditor'
import { VistaPrevia } from '@/components/widgets/VistaPrevia'
import { CARD, INPUT, LABEL, AYUDA, AVISO, BTN, CATEGORIAS, catDe, iconoDe } from '@/components/widgets/ui'
import type { TipoWidget, Contexto } from '@/lib/widgets/tipos'

// Panel de widgets. Todo lo que se ve acá sale del registro de tipos: la lista de widgets
// que se pueden crear, y el formulario de cada uno. Este archivo no conoce ningún widget
// en particular — si lo llegara a conocer, el motor dejó de ser genérico.

type Widget = {
  id: string
  tipo: string
  nombre: string
  contexto: string
  config: Record<string, unknown>
  reglas: { rutas?: string[]; dispositivo?: string; desde?: string | null; hasta?: string | null } | null
  activo: boolean
  orden: number
}
type Metricas = Record<string, { impresion: number; interaccion: number; conversion: number }>
type Pagina = { ruta: string; titulo: string }
type Producto = { id: string; nombre: string; precio: number; imagen: string | null }

const CONTEXTOS: { key: Contexto; label: string; icono: string; donde: string }[] = [
  { key: 'guias', label: 'Guías', icono: '📚', donde: 'Las notas y guías de guias.infomicelium.com.ar' },
  { key: 'tienda', label: 'Tienda', icono: '🏪', donde: 'Portada y listados de infomicelium.com.ar' },
  { key: 'producto', label: 'Ficha de producto', icono: '🏷️', donde: 'La página de un producto, donde se decide la compra' },
]

const NUM = (n: number) => new Intl.NumberFormat('es-AR').format(n)

export default function WidgetsPage() {
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [metricas, setMetricas] = useState<Metricas>({})
  const [tipos, setTipos] = useState<TipoWidget[]>([])
  const [paginas, setPaginas] = useState<Pagina[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [ctx, setCtx] = useState<Contexto>('guias')
  const [editando, setEditando] = useState<Widget | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [creando, setCreando] = useState(false)

  const cargar = useCallback(async () => {
    const r = await fetch('/api/widgets/admin')
    const d = await r.json()
    setWidgets(d.widgets ?? [])
    setMetricas(d.metricas ?? {})
    setTipos(d.tipos ?? [])
    setPaginas(d.paginas ?? [])
    setProductos(d.productos ?? [])
    setCargando(false)
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const patch = async (body: Record<string, unknown>) => {
    setGuardando(true)
    await fetch('/api/widgets/admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    await cargar()
    setGuardando(false)
  }

  const crear = async (tipo: TipoWidget) => {
    const r = await fetch('/api/widgets/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: tipo.slug, contexto: ctx }),
    })
    const d = await r.json()
    setCreando(false)
    await cargar()
    if (d.widget) setEditando(d.widget)
  }

  const borrar = async (w: Widget) => {
    if (!confirm(`¿Borrar "${w.nombre}"? No se puede deshacer.`)) return
    await fetch(`/api/widgets/admin?id=${w.id}`, { method: 'DELETE' })
    setEditando(null)
    await cargar()
  }

  const delCtx = widgets.filter(w => w.contexto === ctx)
  const disponibles = tipos.filter(t => t.contextos.includes(ctx))
  const tipoDe = (slug: string) => tipos.find(t => t.slug === slug)

  // Totales del contexto elegido. La suma importa más que cada widget suelto: dice si lo
  // que está prendido se está viendo de verdad o no lo ve nadie.
  const total = useMemo(() => {
    let impresion = 0, interaccion = 0, conversion = 0
    for (const w of delCtx) {
      const m = metricas[w.id]
      if (!m) continue
      impresion += m.impresion
      interaccion += m.interaccion
      conversion += m.conversion
    }
    return {
      impresion,
      interaccion,
      conversion,
      activos: delCtx.filter(w => w.activo).length,
      tasa: impresion > 0 ? (interaccion / impresion) * 100 : null,
    }
  }, [delCtx, metricas])

  const ctxActual = CONTEXTOS.find(c => c.key === ctx)!

  return (
    <main
      className="min-h-screen p-5 font-sans md:p-8"
      style={{
        '--ac': '111 138 95',
        color: 'white',
        background:
          'radial-gradient(ellipse 90% 40% at 50% -5%, rgb(111 138 95 / 0.10) 0%, transparent 60%), #07070f',
      } as React.CSSProperties}
    >
      {/* ── Encabezado ─────────────────────────────────────────────── */}
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-[rgb(var(--ac)/0.75)]">
            Motor de widgets
          </p>
          <h1 className="text-lg font-bold tracking-tight">Panel de widgets</h1>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-white/50">
            Prendés, apagás y editás desde acá. Los cambios salen al sitio en menos de un minuto,
            sin desplegar nada.
          </p>
          <div className="mt-2 flex gap-3">
            <a href="/dashboard" className="text-xs text-white/45 hover:text-white/80">
              ← Panel de métricas
            </a>
            <a
              href="https://guias.infomicelium.com.ar/guia"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-white/45 hover:text-white/80"
            >
              🌱 Ver el sitio →
            </a>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => void cargar()} className={BTN}>
            ↻ Actualizar
          </button>
          <button
            onClick={() => setCreando(v => !v)}
            className="rounded-xl border px-4 py-1.5 text-xs font-semibold transition-all"
            style={{
              background: 'rgb(var(--ac) / 0.15)',
              borderColor: 'rgb(var(--ac) / 0.35)',
              color: 'rgb(var(--ac))',
            }}
          >
            {creando ? 'Cerrar catálogo' : '+ Agregar widget'}
          </button>
        </div>
      </div>

      {/* ── Resumen del contexto ───────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Prendidos"
          valor={`${total.activos}/${delCtx.length}`}
          sub={delCtx.length === 0 ? 'Todavía no hay widgets acá' : `en ${ctxActual.label.toLowerCase()}`}
          destacado
        />
        <Kpi label="Vistas" valor={NUM(total.impresion)} sub="últimos 30 días" />
        <Kpi label="Clics" valor={NUM(total.interaccion)} sub="interacciones registradas" />
        <Kpi
          label="Interacción"
          valor={total.tasa === null ? '—' : `${total.tasa.toFixed(1)}%`}
          sub={total.conversion > 0 ? `${NUM(total.conversion)} conversiones` : 'de cada vista, un clic'}
        />
      </div>

      {/* ── Contextos ──────────────────────────────────────────────── */}
      <div className={`${CARD} mb-6 p-1.5`}>
        <div className="flex flex-wrap gap-1">
          {CONTEXTOS.map(c => {
            const n = widgets.filter(w => w.contexto === c.key).length
            const activo = ctx === c.key
            return (
              <button
                key={c.key}
                onClick={() => {
                  setCtx(c.key)
                  setEditando(null)
                  setCreando(false)
                }}
                title={c.donde}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-all"
                style={
                  activo
                    ? { background: 'rgb(var(--ac) / 0.15)', color: 'rgb(var(--ac))' }
                    : { color: 'rgba(255,255,255,0.5)' }
                }
              >
                <span className="text-sm leading-none">{c.icono}</span>
                {c.label}
                <span
                  className="rounded-md px-1.5 py-0.5 text-[10px] font-mono"
                  style={{ background: activo ? 'rgb(var(--ac) / 0.18)' : 'rgba(255,255,255,0.06)' }}
                >
                  {n}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <p className="-mt-4 mb-6 text-[11px] text-white/35">{ctxActual.donde}.</p>

      {/* ── Catálogo por categoría ─────────────────────────────────── */}
      {creando && <Catalogo tipos={disponibles} onElegir={t => void crear(t)} />}

      {/* ── Lista o editor ─────────────────────────────────────────── */}
      {cargando ? (
        <p className="text-sm text-white/40">Cargando…</p>
      ) : editando ? (
        <Editor
          widget={editando}
          tipo={tipoDe(editando.tipo)}
          paginas={paginas}
          productos={productos}
          guardando={guardando}
          activo={widgets.find(w => w.id === editando.id)?.activo ?? false}
          onCerrar={() => setEditando(null)}
          onCambio={setEditando}
          onToggle={() =>
            patch({ id: editando.id, activo: !(widgets.find(w => w.id === editando.id)?.activo ?? false) })
          }
          onGuardar={() =>
            patch({
              id: editando.id,
              nombre: editando.nombre,
              config: editando.config,
              reglas: editando.reglas ?? {},
            })
          }
          onBorrar={() => void borrar(editando)}
        />
      ) : delCtx.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/12 p-12 text-center">
          <p className="text-sm text-white/60">Todavía no hay widgets en {ctxActual.label.toLowerCase()}.</p>
          <button
            onClick={() => setCreando(true)}
            className="mt-3 rounded-xl px-4 py-1.5 text-xs font-semibold"
            style={{ background: 'rgb(var(--ac) / 0.15)', color: 'rgb(var(--ac))' }}
          >
            Ver el catálogo
          </button>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {delCtx.map(w => (
            <TarjetaWidget
              key={w.id}
              widget={w}
              tipo={tipoDe(w.tipo)}
              metrica={metricas[w.id] ?? { impresion: 0, interaccion: 0, conversion: 0 }}
              maxImpresion={Math.max(1, ...delCtx.map(x => metricas[x.id]?.impresion ?? 0))}
              onToggle={() => void patch({ id: w.id, activo: !w.activo })}
              onEditar={() => setEditando(w)}
            />
          ))}
        </div>
      )}
    </main>
  )
}

// ── Tarjeta de indicador ──────────────────────────────────────────────────────
function Kpi({
  label,
  valor,
  sub,
  destacado,
}: {
  label: string
  valor: string
  sub?: string
  destacado?: boolean
}) {
  return (
    <div
      className={`relative flex min-h-[104px] flex-col justify-between rounded-2xl border p-4 ${
        destacado ? '' : 'border-white/[0.07] bg-gradient-to-br from-white/[0.04] to-white/[0.01]'
      }`}
      style={
        destacado
          ? {
              background:
                'linear-gradient(to bottom right, rgb(var(--ac) / 0.14) 0%, rgb(var(--ac) / 0.04) 100%)',
              borderColor: 'rgb(var(--ac) / 0.22)',
            }
          : undefined
      }
    >
      <p className="text-[10px] font-semibold uppercase leading-none tracking-[0.15em] text-white/50">
        {label}
      </p>
      <div>
        <p
          className="font-mono text-2xl font-bold leading-none tracking-tight"
          style={{ color: destacado ? 'rgb(var(--ac))' : '#fff' }}
        >
          {valor}
        </p>
        {sub && <p className="mt-1.5 text-[10px] leading-snug text-white/45">{sub}</p>}
      </div>
    </div>
  )
}

// ── Catálogo ─────────────────────────────────────────────────────────────────
// Agrupado por categoría, con el para qué de cada grupo arriba. Elegir un widget es elegir
// qué palanca tocar; una grilla plana de veinte tarjetas no deja ver eso.
function Catalogo({ tipos, onElegir }: { tipos: TipoWidget[]; onElegir: (t: TipoWidget) => void }) {
  const orden = Object.keys(CATEGORIAS) as (keyof typeof CATEGORIAS)[]
  return (
    <div className={`${CARD} mb-6 p-5`}>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/50">
        Catálogo
      </p>
      <p className="mb-5 text-xs leading-relaxed text-white/45">
        Nace apagado: podés configurarlo tranquilo antes de que lo vea nadie.
      </p>

      <div className="space-y-7">
        {orden.map(k => {
          const cat = CATEGORIAS[k]
          const delGrupo = tipos.filter(t => t.categoria === k)
          if (delGrupo.length === 0) return null
          return (
            <section key={k}>
              <div className="mb-3 flex items-center gap-2.5">
                <span className="text-base leading-none">{cat.icono}</span>
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: cat.color }}
                >
                  {cat.label}
                </span>
                <span className="h-px flex-1" style={{ background: `${cat.color}33` }} />
                <p className="text-[11px] leading-relaxed text-white/40">{cat.para}</p>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {delGrupo.map(t => (
                  <button
                    key={t.slug}
                    onClick={() => onElegir(t)}
                    // El texto largo (uso, advertencia) vive acá: está a un segundo de
                    // distancia si hace falta, y no obliga a leer veinte párrafos para
                    // recorrer el catálogo con la vista.
                    title={[t.descripcion, t.uso, t.cuidado && `⚠ ${t.cuidado}`]
                      .filter(Boolean)
                      .join('\n\n')}
                    className="group flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 text-left transition-all hover:bg-white/[0.06]"
                    style={{ borderLeft: `2px solid ${cat.color}66` }}
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl leading-none"
                      style={{ background: `${cat.color}1f` }}
                    >
                      {iconoDe(t.slug)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-white">{t.nombre}</span>
                        {t.cuidado && (
                          <span className="text-[11px] text-amber-300/80" title={t.cuidado}>
                            ⚠
                          </span>
                        )}
                        {t.datosVivos && (
                          <span className="text-[11px] text-emerald-300/80" title="Se llena solo con datos reales del sitio">
                            ⚡
                          </span>
                        )}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-white/50">
                        {t.descripcion}
                      </span>
                    </span>
                    <span
                      className="text-base leading-none opacity-0 transition-opacity group-hover:opacity-100"
                      style={{ color: cat.color }}
                    >
                      +
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

// ── Tarjeta de un widget ─────────────────────────────────────────────────────
function TarjetaWidget({
  widget: w,
  tipo,
  metrica: m,
  maxImpresion,
  onToggle,
  onEditar,
}: {
  widget: Widget
  tipo?: TipoWidget
  metrica: { impresion: number; interaccion: number; conversion: number }
  maxImpresion: number
  onToggle: () => void
  onEditar: () => void
}) {
  const cat = catDe(tipo?.categoria ?? 'contenido')
  const tasa = m.impresion > 0 ? (m.interaccion / m.impresion) * 100 : null
  return (
    <div
      className={`${CARD} p-4 transition-all hover:border-white/[0.14] ${w.activo ? '' : 'opacity-60'}`}
      style={{ borderLeft: `2px solid ${w.activo ? cat.color : 'rgba(255,255,255,0.10)'}` }}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={onToggle}
          className={`mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${
            w.activo ? 'bg-emerald-500' : 'bg-white/15'
          }`}
          title={w.activo ? 'Prendido — se está viendo en el sitio' : 'Apagado'}
        >
          <span
            className={`block h-5 w-5 rounded-full bg-white transition ${
              w.activo ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>

        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg leading-none"
          style={{ background: `${cat.color}1f` }}
          title={`${cat.label} — ${tipo?.nombre ?? w.tipo}`}
        >
          {iconoDe(w.tipo)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{w.nombre}</p>
          <p className="mt-0.5 truncate text-[11px] text-white/45">{tipo?.nombre ?? w.tipo}</p>
        </div>

        <button onClick={onEditar} className={BTN}>
          Editar
        </button>
      </div>

      {/* Rendimiento de 30 días. La barra compara contra el widget más visto del contexto:
          un número suelto no dice si 300 vistas es mucho o nada. */}
      <div className="mt-4 flex items-end gap-4">
        <Dato valor={NUM(m.impresion)} label="vistas" />
        <Dato valor={NUM(m.interaccion)} label="clics" />
        <Dato valor={tasa === null ? '—' : `${tasa.toFixed(1)}%`} label="interacción" acento={cat.color} />
        {m.conversion > 0 && <Dato valor={NUM(m.conversion)} label="conversiones" acento="#34d399" />}
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(100, (m.impresion / maxImpresion) * 100)}%`,
            background: cat.color,
            opacity: w.activo ? 0.8 : 0.3,
          }}
        />
      </div>
    </div>
  )
}

function Dato({ valor, label, acento }: { valor: string; label: string; acento?: string }) {
  return (
    <div>
      <p className="font-mono text-base font-bold leading-none" style={{ color: acento ?? '#fff' }}>
        {valor}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-white/40">{label}</p>
    </div>
  )
}

// ── Editor ───────────────────────────────────────────────────────────────────
function Editor({
  widget,
  tipo,
  paginas,
  productos,
  guardando,
  activo,
  onCerrar,
  onCambio,
  onToggle,
  onGuardar,
  onBorrar,
}: {
  widget: Widget
  tipo?: TipoWidget
  paginas: Pagina[]
  productos: Producto[]
  guardando: boolean
  activo: boolean
  onCerrar: () => void
  onCambio: (w: Widget) => void
  onToggle: () => void
  onGuardar: () => void
  onBorrar: () => void
}) {
  if (!tipo) {
    return (
      <div className={`${CARD} p-5`}>
        <button onClick={onCerrar} className={`${BTN} mb-4`}>
          ← Volver
        </button>
        <p className={AVISO}>
          El tipo «{widget.tipo}» ya no existe en el código. El widget queda guardado pero no se
          muestra.
        </p>
      </div>
    )
  }

  const cat = catDe(tipo.categoria)
  const reglas = widget.reglas ?? {}

  return (
    <div>
      {/* Barra del editor: siempre visible qué se está tocando y si está al aire. */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button onClick={onCerrar} className={BTN}>
          ← Todos los widgets
        </button>
        <span
          className="flex h-8 w-8 items-center justify-center rounded-xl text-base leading-none"
          style={{ background: `${cat.color}1f` }}
          title={cat.label}
        >
          {iconoDe(widget.tipo)}
        </span>
        <span className="text-sm font-semibold text-white">{tipo.nombre}</span>
        <button
          onClick={onToggle}
          className="ml-auto flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all"
          style={
            activo
              ? { background: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.3)', color: '#34d399' }
              : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)' }
          }
        >
          <span className={`h-1.5 w-1.5 rounded-full ${activo ? 'bg-emerald-400' : 'bg-white/40'}`} />
          {activo ? 'Al aire' : 'Apagado'}
        </button>
        <button
          onClick={onGuardar}
          disabled={guardando}
          className="rounded-xl px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
          style={{ background: 'rgb(var(--ac) / 0.18)', color: 'rgb(var(--ac))' }}
        >
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
        {/* ── Columna de configuración ───────────────────────────── */}
        <div className="space-y-4">
          {/* Qué hace y qué necesita, arriba de todo: configurar un widget no debería
              requerir acordarse de nada ni preguntar. */}
          <div className={`${CARD} p-4`} style={{ borderLeft: `2px solid ${cat.color}66` }}>
            <p className="text-xs leading-relaxed text-white/70">{tipo.descripcion}</p>
            <p className="mt-2 text-xs leading-relaxed text-white/45">{tipo.uso}</p>
            {tipo.cuidado && <p className={`mt-2 ${AVISO}`}>⚠ {tipo.cuidado}</p>}
          </div>

          <div className={`${CARD} space-y-5 p-4`}>
            <div>
              <label className={LABEL}>Nombre interno</label>
              <input
                className={INPUT}
                value={widget.nombre}
                onChange={e => onCambio({ ...widget, nombre: e.target.value })}
              />
              <p className={AYUDA}>Solo para reconocerlo en esta lista. No se ve en el sitio.</p>
            </div>

            {tipo.campos.map(c => (
              <CampoEditor
                key={c.key}
                campo={c}
                valor={widget.config?.[c.key]}
                productos={productos}
                config={widget.config}
                onChange={v => onCambio({ ...widget, config: { ...widget.config, [c.key]: v } })}
              />
            ))}
          </div>

          <details className={`${CARD} p-4`}>
            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
              Dónde y cuándo aparece
            </summary>
            <div className="mt-4 space-y-5">
              <div>
                <label className={LABEL}>En qué páginas</label>
                <p className="mb-2 text-xs leading-relaxed text-white/45">
                  Sin marcar ninguna, aparece en todas. Marcá solo si querés acotarlo.
                </p>
                {/* Casillas con las páginas que existen de verdad. Antes había que escribir la
                    dirección a mano, que es la forma más fácil de equivocarse en una letra y no
                    enterarse nunca. */}
                <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-2.5">
                  {paginas.map(p => {
                    const marcada = (reglas.rutas ?? []).includes(p.ruta)
                    return (
                      <label
                        key={p.ruta}
                        className="flex cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1 text-xs text-white/70 hover:bg-white/[0.04]"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-emerald-500"
                          checked={marcada}
                          onChange={() => {
                            const actuales = reglas.rutas ?? []
                            onCambio({
                              ...widget,
                              reglas: {
                                ...reglas,
                                rutas: marcada
                                  ? actuales.filter(r => r !== p.ruta)
                                  : [...actuales, p.ruta],
                              },
                            })
                          }}
                        />
                        <span>{p.titulo}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className={LABEL}>Dispositivo</label>
                <select
                  className={INPUT}
                  value={reglas.dispositivo ?? 'todos'}
                  onChange={e =>
                    onCambio({ ...widget, reglas: { ...reglas, dispositivo: e.target.value } })
                  }
                >
                  <option value="todos">Todos</option>
                  <option value="movil">Solo celular</option>
                  <option value="escritorio">Solo escritorio</option>
                </select>
              </div>

              <div>
                <label className={LABEL}>Ventana de fechas</label>
                <p className="mb-2 text-xs leading-relaxed text-white/45">
                  Opcional. Fuera de la ventana el widget ni siquiera se envía a la página, así que
                  una promoción vencida no queda escondida en el código a la vista de nadie.
                </p>
                <div className="flex gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] text-white/45">Desde</label>
                    <input
                      type="date"
                      className={INPUT}
                      value={(reglas.desde ?? '').slice(0, 10)}
                      onChange={e => onCambio({ ...widget, reglas: { ...reglas, desde: e.target.value } })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-white/45">Hasta</label>
                    <input
                      type="date"
                      className={INPUT}
                      value={(reglas.hasta ?? '').slice(0, 10)}
                      onChange={e => onCambio({ ...widget, reglas: { ...reglas, hasta: e.target.value } })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </details>

          <div className="flex items-center gap-4 px-1">
            <button onClick={onBorrar} className="text-xs text-red-400/80 hover:text-red-400">
              Borrar widget
            </button>
          </div>
        </div>

        {/* ── Columna de vista previa ────────────────────────────── */}
        {/* Queda pegada arriba: se edita mirando el resultado, no alternando entre pestañas. */}
        <div className="lg:sticky lg:top-6">
          <VistaPrevia tipo={widget.tipo} config={widget.config} />
        </div>
      </div>
    </div>
  )
}
