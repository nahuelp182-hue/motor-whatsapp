'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CampoEditor } from '@/components/widgets/CampoEditor'
import { VistaPrevia } from '@/components/widgets/VistaPrevia'
import { Metricas } from '@/components/widgets/Metricas'
import { CARD, INPUT, LABEL, AYUDA, AVISO, BTN, ACENTO, TITULO, CATEGORIAS, catDe, iconoDe } from '@/components/widgets/ui'
import type { TipoWidget, Contexto } from '@/lib/widgets/tipos'

// Panel de widgets. Todo lo que se ve acá sale del registro de tipos: la lista de widgets
// que se pueden crear, y el formulario de cada uno. Este archivo no conoce ningún widget
// en particular — si lo llegara a conocer, el motor dejó de ser genérico.
//
// Estética: sistema de diseño Micelium "Neutro premium + salvia" (definitivo 23/07/26).
// Blanco/negro editorial, Fraunces en títulos, salvia solo como firma. Ver ./ui.

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
      className="min-h-screen p-5 font-sans text-[#3f3f3c] md:p-8"
      style={{
        '--ac': '111 138 95',
        background:
          'radial-gradient(ellipse 90% 40% at 50% -5%, rgb(111 138 95 / 0.06) 0%, transparent 60%), #fafafa',
      } as React.CSSProperties}
    >
      {/* ── Encabezado ─────────────────────────────────────────────── */}
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p
            className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: ACENTO }}
          >
            Motor de widgets
          </p>
          <h1 className="text-2xl font-medium tracking-tight text-[#171717]" style={{ fontFamily: TITULO }}>
            Panel de widgets
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[#737373]">
            Prendés, apagás y editás desde acá. Los cambios salen al sitio en menos de un minuto,
            sin desplegar nada.
          </p>
          <div className="mt-3 flex gap-3">
            <a href="/dashboard" className="text-xs text-[#a3a3a0] transition-colors hover:text-[#171717]">
              ← Panel de métricas
            </a>
            <a
              href="https://guias.infomicelium.com.ar/guia"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-[#a3a3a0] transition-colors hover:text-[#171717]"
            >
              Ver el sitio →
            </a>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => void cargar()} className={BTN}>
            ↻ Actualizar
          </button>
          <button
            onClick={() => setCreando(v => !v)}
            className="rounded-md px-4 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90"
            style={{ background: '#171717' }}
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
                    ? { background: '#eef1e9', color: ACENTO }
                    : { color: '#737373' }
                }
              >
                <span className="text-sm leading-none">{c.icono}</span>
                {c.label}
                <span
                  className="rounded-md px-1.5 py-0.5 font-mono text-[10px]"
                  style={{ background: activo ? '#dfe6d6' : '#f4f4f1', color: activo ? ACENTO : '#737373' }}
                >
                  {n}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <p className="-mt-4 mb-6 text-[11px] text-[#a3a3a0]">{ctxActual.donde}.</p>

      {/* ── Catálogo por categoría ─────────────────────────────────── */}
      {creando && <Catalogo tipos={disponibles} onElegir={t => void crear(t)} />}

      {/* ── Rendimiento ────────────────────────────────────────────
          Arriba de la lista y no escondido en otra pantalla: la decisión que importa es
          cuál apagar, y esa se toma mirando los números al lado de los widgets. */}
      {!editando && !creando && <Metricas />}

      {/* ── Lista o editor ─────────────────────────────────────────── */}
      {cargando ? (
        <p className="text-sm text-[#a3a3a0]">Cargando…</p>
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
        <div className="rounded-2xl border border-dashed border-[#d9d9d3] bg-white/50 p-12 text-center">
          <p className="text-sm text-[#737373]">Todavía no hay widgets en {ctxActual.label.toLowerCase()}.</p>
          <button
            onClick={() => setCreando(true)}
            className="mt-3 rounded-md px-4 py-1.5 text-xs font-semibold text-white"
            style={{ background: '#171717' }}
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
      className="relative flex min-h-[104px] flex-col justify-between rounded-2xl border p-4"
      style={
        destacado
          ? {
              background: '#eef1e9',
              borderColor: 'rgb(var(--ac) / 0.25)',
            }
          : {
              background: '#fff',
              borderColor: '#e7e7e2',
              boxShadow: '0 1px 3px rgba(23,23,23,0.04)',
            }
      }
    >
      <p className="text-[10px] font-semibold uppercase leading-none tracking-[0.15em] text-[#737373]">
        {label}
      </p>
      <div>
        <p
          className="font-mono text-2xl font-bold leading-none tracking-tight"
          style={{ color: destacado ? ACENTO : '#171717' }}
        >
          {valor}
        </p>
        {sub && <p className="mt-1.5 text-[10px] leading-snug text-[#a3a3a0]">{sub}</p>}
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
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#737373]">
        Catálogo
      </p>
      <p className="mb-5 text-xs leading-relaxed text-[#737373]">
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
                <p className="text-[11px] leading-relaxed text-[#a3a3a0]">{cat.para}</p>
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
                    className="group flex items-start gap-3 rounded-xl border border-[#e7e7e2] bg-white p-3.5 text-left transition-all hover:border-[#d9d9d3] hover:bg-[#f4f4f1]"
                    style={{ borderLeft: `2px solid ${cat.color}88` }}
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl leading-none"
                      style={{ background: `${cat.color}22` }}
                    >
                      {iconoDe(t.slug)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-[#171717]">{t.nombre}</span>
                        {t.cuidado && (
                          <span className="text-[11px] text-amber-600" title={t.cuidado}>
                            ⚠
                          </span>
                        )}
                        {t.datosVivos && (
                          <span className="text-[11px] text-emerald-600" title="Se llena solo con datos reales del sitio">
                            ⚡
                          </span>
                        )}
                      </span>
                      <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-[#737373]">
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
      className={`${CARD} p-4 transition-all hover:border-[#d9d9d3] ${w.activo ? '' : 'opacity-60'}`}
      style={{ borderLeft: `2px solid ${w.activo ? cat.color : '#d9d9d3'}` }}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={onToggle}
          className={`mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${
            w.activo ? 'bg-emerald-500' : 'bg-[#d4d4d0]'
          }`}
          title={w.activo ? 'Prendido — se está viendo en el sitio' : 'Apagado'}
        >
          <span
            className={`block h-5 w-5 rounded-full bg-white shadow-sm transition ${
              w.activo ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>

        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg leading-none"
          style={{ background: `${cat.color}22` }}
          title={`${cat.label} — ${tipo?.nombre ?? w.tipo}`}
        >
          {iconoDe(w.tipo)}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#171717]">{w.nombre}</p>
          <p className="mt-0.5 truncate text-[11px] text-[#a3a3a0]">{tipo?.nombre ?? w.tipo}</p>
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
        <Dato valor={tasa === null ? '—' : `${tasa.toFixed(1)}%`} label="interacción" acento={ACENTO} />
        {m.conversion > 0 && <Dato valor={NUM(m.conversion)} label="conversiones" acento="#059669" />}
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#eeeeea]">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(100, (m.impresion / maxImpresion) * 100)}%`,
            background: cat.color,
            opacity: w.activo ? 0.85 : 0.35,
          }}
        />
      </div>
    </div>
  )
}

function Dato({ valor, label, acento }: { valor: string; label: string; acento?: string }) {
  return (
    <div>
      <p className="font-mono text-base font-bold leading-none" style={{ color: acento ?? '#171717' }}>
        {valor}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-[#a3a3a0]">{label}</p>
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
          style={{ background: `${cat.color}22` }}
          title={cat.label}
        >
          {iconoDe(widget.tipo)}
        </span>
        <span className="text-sm font-semibold text-[#171717]">{tipo.nombre}</span>
        <button
          onClick={onToggle}
          className="ml-auto flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all"
          style={
            activo
              ? { background: 'rgba(16,185,129,0.10)', borderColor: 'rgba(16,185,129,0.35)', color: '#059669' }
              : { background: '#f4f4f1', borderColor: '#e7e7e2', color: '#737373' }
          }
        >
          <span className={`h-1.5 w-1.5 rounded-full ${activo ? 'bg-emerald-500' : 'bg-[#a3a3a0]'}`} />
          {activo ? 'Al aire' : 'Apagado'}
        </button>
        <button
          onClick={onGuardar}
          disabled={guardando}
          className="rounded-md px-4 py-1.5 text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: '#171717' }}
        >
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-start">
        {/* ── Columna de configuración ───────────────────────────── */}
        <div className="space-y-4">
          {/* Qué hace y qué necesita, arriba de todo: configurar un widget no debería
              requerir acordarse de nada ni preguntar. */}
          <div className={`${CARD} p-4`} style={{ borderLeft: `2px solid ${cat.color}88` }}>
            <p className="text-xs leading-relaxed text-[#3f3f3c]">{tipo.descripcion}</p>
            <p className="mt-2 text-xs leading-relaxed text-[#737373]">{tipo.uso}</p>
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
            <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]">
              Dónde y cuándo aparece
            </summary>
            <div className="mt-4 space-y-5">
              <div>
                <label className={LABEL}>En qué páginas</label>
                <p className="mb-2 text-xs leading-relaxed text-[#737373]">
                  Sin marcar ninguna, aparece en todas. Marcá solo si querés acotarlo.
                </p>
                {/* Casillas con las páginas que existen de verdad. Antes había que escribir la
                    dirección a mano, que es la forma más fácil de equivocarse en una letra y no
                    enterarse nunca. */}
                <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-[#e7e7e2] bg-[#fafafa] p-2.5">
                  {paginas.map(p => {
                    const marcada = (reglas.rutas ?? []).includes(p.ruta)
                    return (
                      <label
                        key={p.ruta}
                        className="flex cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1 text-xs text-[#3f3f3c] hover:bg-[#f0f0ec]"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-[#6f8a5f]"
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
                <p className="mb-2 text-xs leading-relaxed text-[#737373]">
                  Opcional. Fuera de la ventana el widget ni siquiera se envía a la página, así que
                  una promoción vencida no queda escondida en el código a la vista de nadie.
                </p>
                <div className="flex gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] text-[#737373]">Desde</label>
                    <input
                      type="date"
                      className={INPUT}
                      value={(reglas.desde ?? '').slice(0, 10)}
                      onChange={e => onCambio({ ...widget, reglas: { ...reglas, desde: e.target.value } })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-[#737373]">Hasta</label>
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
            <button onClick={onBorrar} className="text-xs text-red-500 hover:text-red-600">
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
