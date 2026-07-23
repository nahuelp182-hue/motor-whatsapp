'use client'

import { useCallback, useEffect, useState } from 'react'
import { CampoEditor } from '@/components/widgets/CampoEditor'
import { VistaPrevia } from '@/components/widgets/VistaPrevia'
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

const CONTEXTOS: { key: Contexto; label: string }[] = [
  { key: 'guias', label: 'Guías' },
  { key: 'tienda', label: 'Tienda' },
  { key: 'producto', label: 'Ficha de producto' },
]

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

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Widgets</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Prendés, apagás y editás desde acá. Los cambios salen al sitio en menos de un minuto, sin
          desplegar nada.
        </p>
      </header>

      <div className="mb-5 flex gap-2">
        {CONTEXTOS.map(c => (
          <button
            key={c.key}
            onClick={() => {
              setCtx(c.key)
              setEditando(null)
            }}
            className={`rounded-full px-4 py-1.5 text-sm ${
              ctx === c.key ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            {c.label}
          </button>
        ))}
        <button
          onClick={() => setCreando(v => !v)}
          className="ml-auto rounded-full border border-neutral-300 px-4 py-1.5 text-sm"
        >
          + Agregar widget
        </button>
      </div>

      {creando && (
        <div className="mb-6 grid gap-3 rounded-lg border border-neutral-200 p-4 sm:grid-cols-2">
          {disponibles.map(t => (
            <button
              key={t.slug}
              onClick={() => void crear(t)}
              className="rounded border border-neutral-200 p-3 text-left hover:border-neutral-400"
            >
              <div className="text-sm font-medium">{t.nombre}</div>
              <div className="mt-1 text-xs leading-relaxed text-neutral-500">{t.descripcion}</div>
              <div className="mt-2 text-xs leading-relaxed text-neutral-400">{t.uso}</div>
              {t.cuidado && (
                <div className="mt-2 text-xs leading-relaxed text-amber-700">⚠ {t.cuidado}</div>
              )}
            </button>
          ))}
        </div>
      )}

      {cargando ? (
        <p className="text-sm text-neutral-400">Cargando…</p>
      ) : delCtx.length === 0 ? (
        <p className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          Todavía no hay widgets acá. Usá «Agregar widget».
        </p>
      ) : (
        <ul className="space-y-2">
          {delCtx.map(w => {
            const m = metricas[w.id] ?? { impresion: 0, interaccion: 0, conversion: 0 }
            const tasa = m.impresion > 0 ? ((m.interaccion / m.impresion) * 100).toFixed(1) : '—'
            return (
              <li key={w.id} className="rounded-lg border border-neutral-200 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => void patch({ id: w.id, activo: !w.activo })}
                    className={`h-6 w-11 shrink-0 rounded-full transition ${
                      w.activo ? 'bg-emerald-600' : 'bg-neutral-300'
                    }`}
                    title={w.activo ? 'Prendido' : 'Apagado'}
                  >
                    <span
                      className={`block h-5 w-5 rounded-full bg-white transition ${
                        w.activo ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{w.nombre}</div>
                    <div className="text-xs text-neutral-400">{tipoDe(w.tipo)?.nombre ?? w.tipo}</div>
                  </div>
                  <div className="text-right text-xs text-neutral-500">
                    <div>{m.impresion} vistas · {m.interaccion} clics</div>
                    <div className="text-neutral-400">interacción {tasa}%</div>
                  </div>
                  <button
                    onClick={() => setEditando(editando?.id === w.id ? null : w)}
                    className="rounded border border-neutral-300 px-3 py-1 text-xs"
                  >
                    {editando?.id === w.id ? 'Cerrar' : 'Editar'}
                  </button>
                </div>

                {editando?.id === w.id && (
                  <Editor
                    widget={editando}
                    tipo={tipoDe(w.tipo)}
                    paginas={paginas}
                    productos={productos}
                    guardando={guardando}
                    onCambio={setEditando}
                    onGuardar={() =>
                      patch({
                        id: editando.id,
                        nombre: editando.nombre,
                        config: editando.config,
                        reglas: editando.reglas ?? {},
                      })
                    }
                    onBorrar={() => void borrar(w)}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Editor({
  widget,
  tipo,
  paginas,
  productos,
  guardando,
  onCambio,
  onGuardar,
  onBorrar,
}: {
  widget: Widget
  tipo?: TipoWidget
  paginas: Pagina[]
  productos: Producto[]
  guardando: boolean
  onCambio: (w: Widget) => void
  onGuardar: () => void
  onBorrar: () => void
}) {
  if (!tipo) {
    return (
      <p className="mt-4 rounded bg-amber-50 p-3 text-xs text-amber-800">
        El tipo «{widget.tipo}» ya no existe en el código. El widget queda guardado pero no se
        muestra.
      </p>
    )
  }

  const reglas = widget.reglas ?? {}

  return (
    <div className="mt-4 space-y-4 border-t border-neutral-200 pt-4">
      {/* Qué hace y qué necesita, arriba de todo: configurar un widget no debería requerir
          acordarse de nada ni preguntar. */}
      <div className="rounded bg-neutral-50 p-3">
        <p className="text-xs leading-relaxed text-neutral-600">{tipo.descripcion}</p>
        <p className="mt-2 text-xs leading-relaxed text-neutral-500">{tipo.uso}</p>
        {tipo.cuidado && (
          <p className="mt-2 text-xs leading-relaxed text-amber-700">⚠ {tipo.cuidado}</p>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">Nombre interno</label>
        <input
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          value={widget.nombre}
          onChange={e => onCambio({ ...widget, nombre: e.target.value })}
        />
        <p className="mt-1 text-xs leading-relaxed text-neutral-500">
          Solo para reconocerlo en esta lista. No se ve en el sitio.
        </p>
      </div>

      <VistaPrevia tipo={widget.tipo} config={widget.config} />

      {tipo.campos.map(c => (
        <CampoEditor
          key={c.key}
          campo={c}
          valor={widget.config?.[c.key]}
          productos={productos}
          onChange={v => onCambio({ ...widget, config: { ...widget.config, [c.key]: v } })}
        />
      ))}

      <details className="rounded border border-neutral-200 p-3">
        <summary className="cursor-pointer text-xs font-medium text-neutral-600">
          Dónde y cuándo aparece
        </summary>
        <div className="mt-3 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-neutral-500">En qué páginas</label>
            <p className="mb-2 text-xs leading-relaxed text-neutral-500">
              Sin marcar ninguna, aparece en todas. Marcá solo si querés acotarlo.
            </p>
            {/* Casillas con las páginas que existen de verdad. Antes había que escribir la
                dirección a mano, que es la forma más fácil de equivocarse en una letra y no
                enterarse nunca. */}
            <div className="max-h-44 space-y-1 overflow-y-auto rounded border border-neutral-200 p-2">
              {paginas.map(p => {
                const marcada = (reglas.rutas ?? []).includes(p.ruta)
                return (
                  <label key={p.ruta} className="flex items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="mt-0.5"
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
            <label className="mb-1 block text-xs text-neutral-500">Dispositivo</label>
            <select
              className="rounded border border-neutral-300 px-3 py-2 text-sm"
              value={reglas.dispositivo ?? 'todos'}
              onChange={e => onCambio({ ...widget, reglas: { ...reglas, dispositivo: e.target.value } })}
            >
              <option value="todos">Todos</option>
              <option value="movil">Solo celular</option>
              <option value="escritorio">Solo escritorio</option>
            </select>
          </div>
          <p className="text-xs leading-relaxed text-neutral-500">
            Fechas opcionales. Fuera de la ventana el widget ni siquiera se envía a la página, así
            que una promoción vencida no queda escondida en el código a la vista de nadie.
          </p>
          <div className="flex gap-3">
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Desde</label>
              <input
                type="date"
                className="rounded border border-neutral-300 px-3 py-2 text-sm"
                value={(reglas.desde ?? '').slice(0, 10)}
                onChange={e => onCambio({ ...widget, reglas: { ...reglas, desde: e.target.value } })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500">Hasta</label>
              <input
                type="date"
                className="rounded border border-neutral-300 px-3 py-2 text-sm"
                value={(reglas.hasta ?? '').slice(0, 10)}
                onChange={e => onCambio({ ...widget, reglas: { ...reglas, hasta: e.target.value } })}
              />
            </div>
          </div>
        </div>
      </details>

      <div className="flex items-center gap-3">
        <button
          onClick={onGuardar}
          disabled={guardando}
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button onClick={onBorrar} className="text-xs text-red-600">
          Borrar widget
        </button>
      </div>
    </div>
  )
}
