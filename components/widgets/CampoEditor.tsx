'use client'

import { PALETA, UBICACIONES, DESTINOS, EMOJIS, PROPORCIONES, type Campo } from '@/lib/widgets/tipos'
import { SubirMedia } from './SubirMedia'
import { INPUT, LABEL, AYUDA, AVISO } from './ui'

// Formulario genérico: dibuja UN campo a partir de su declaración en lib/widgets/tipos.ts.
// Ningún tipo de widget tiene formulario propio. Agregar un tipo nuevo no toca este archivo
// mientras use los tipos de campo ya soportados — que es justo el punto del diseño.
//
// Los estilos salen de ./ui: el panel es oscuro, y un campo con borde gris claro sobre
// fondo negro se lee tan mal como no estar.

export type Producto = { id: string; nombre: string; precio: number; imagen: string | null }

type Props = {
  campo: Campo
  valor: unknown
  /** Catálogo real de Tiendanube, para los campos de tipo producto. */
  productos?: Producto[]
  /** Config completa del widget: algún campo necesita mirar a otro (la medida sugerida
   *  del archivo depende de la proporción elegida). */
  config?: Record<string, unknown>
  onChange: (v: unknown) => void
}

const input = INPUT

export function CampoEditor({ campo, valor, productos = [], config, onChange }: Props) {
  // La ayuda va SIEMPRE debajo del campo y en renglón aparte, no como texto gris al lado
  // del rótulo. Es la diferencia entre poder configurar un widget sin preguntarle a nadie y
  // tener que acordarse de qué hacía cada casilla.
  const ayuda = campo.ayuda ? <p className={AYUDA}>{campo.ayuda}</p> : null

  if (campo.tipo === 'booleano') {
    const prendido = valor === true
    return (
      <div className="py-1">
        <label className="flex cursor-pointer items-center gap-3 text-sm text-white/85">
          <button
            type="button"
            onClick={() => onChange(!prendido)}
            className={`h-5 w-9 shrink-0 rounded-full transition ${
              prendido ? 'bg-emerald-500' : 'bg-white/15'
            }`}
          >
            <span
              className={`block h-4 w-4 rounded-full bg-white transition ${
                prendido ? 'translate-x-[18px]' : 'translate-x-0.5'
              }`}
            />
          </button>
          <span onClick={() => onChange(!prendido)}>{campo.label}</span>
        </label>
        {campo.ayuda && <p className={`ml-12 ${AYUDA}`}>{campo.ayuda}</p>}
      </div>
    )
  }

  const etiqueta = <label className={LABEL}>{campo.label}</label>

  // Dónde se inserta el widget: se elige mirando un dibujo de la página, no escribiendo
  // HTML. Antes esto era un <div data-mic-slot="..."> que había que pegar a mano en cada
  // página; el dibujo dice exactamente lo mismo sin pedirle código a nadie.
  if (campo.tipo === 'ubicacion') {
    const actual = String(valor ?? 'final')
    const elegida = UBICACIONES.find(u => u.value === actual) ?? UBICACIONES[4]
    return (
      <div>
        {etiqueta}
        <div className="flex flex-wrap gap-2">
          {UBICACIONES.map(u => {
            const activo = u.value === actual
            // Miniatura de la página: renglones grises de texto y una banda de color donde
            // caería el widget.
            const filas = ['inicio', 'tras_intro', 'medio', 'antes_final', 'final']
            const posicion = filas.indexOf(u.value)
            return (
              <button
                key={u.value}
                type="button"
                onClick={() => onChange(u.value)}
                title={u.ayuda}
                className="w-[104px] rounded-xl border p-2 text-left transition-all"
                style={{
                  borderColor: activo ? 'rgb(var(--ac) / 0.55)' : 'rgba(255,255,255,0.10)',
                  background: activo ? 'rgb(var(--ac) / 0.10)' : 'rgba(255,255,255,0.02)',
                }}
              >
                <div className="mb-1.5 space-y-[3px] rounded-md bg-white/[0.07] p-1.5">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className={
                        i === posicion
                          ? 'h-2 rounded-sm'
                          : `h-[3px] rounded-sm bg-white/20 ${i % 2 ? 'w-3/4' : 'w-full'}`
                      }
                      style={i === posicion ? { background: 'rgb(var(--ac))' } : undefined}
                    />
                  ))}
                </div>
                <span
                  className="block text-[11px] leading-tight"
                  style={{ color: activo ? '#fff' : 'rgba(255,255,255,0.6)' }}
                >
                  {u.label}
                </span>
              </button>
            )
          })}
        </div>
        <p className={AYUDA}>{elegida.ayuda}</p>
        {ayuda}
      </div>
    )
  }

  // Destino de un enlace: lista cerrada de páginas reales. Escribir la dirección a mano es
  // la forma más fácil de mandar a los visitantes a una página que no existe.
  if (campo.tipo === 'enlace') {
    return (
      <div>
        {etiqueta}
        <select className={input} value={String(valor ?? '')} onChange={e => onChange(e.target.value)}>
          {DESTINOS.map(d => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        {ayuda}
      </div>
    )
  }

  // Producto del catálogo real. Nunca se escribe un id: un id mal tipeado no falla a la
  // vista, deja el widget ofreciendo algo que no existe.
  // Subida de archivo: la conversión y el tope de peso viven en SubirMedia.
  if (campo.tipo === 'media') {
    // La medida sugerida sale de la proporción que el widget ya tenga elegida, así el
    // número que se muestra es el que corresponde y no una tabla genérica.
    const prop = PROPORCIONES.find(x => x.value === String(config?.proporcion ?? '16:9'))
    return (
      <SubirMedia
        valor={String(valor ?? '')}
        label={campo.label}
        ayuda={campo.ayuda}
        recomendado={prop?.medida}
        onChange={onChange}
      />
    )
  }

  if (campo.tipo === 'producto') {
    const elegido = productos.find(p => p.id === String(valor ?? ''))
    return (
      <div>
        {etiqueta}
        <div className="flex items-center gap-2">
          {elegido?.imagen && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={elegido.imagen}
              alt=""
              className="h-11 w-11 shrink-0 rounded-lg border border-white/10 object-cover"
            />
          )}
          <select
            className={input}
            value={String(valor ?? '')}
            onChange={e => onChange(e.target.value)}
          >
            <option value="">Elegí un producto…</option>
            {productos.map(p => (
              <option key={p.id} value={p.id}>
                {p.nombre}
                {p.precio ? ` — $${p.precio.toLocaleString('es-AR')}` : ''}
              </option>
            ))}
          </select>
        </div>
        {productos.length === 0 && (
          <p className={`mt-1.5 ${AVISO}`}>
            No se pudo leer el catálogo de Tiendanube. Recargá en un rato.
          </p>
        )}
        {ayuda}
      </div>
    )
  }

  if (campo.tipo === 'emoji') {
    return (
      <div>
        {etiqueta}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onChange('')}
            className="h-9 w-9 rounded-lg border text-xs text-white/60 transition-all"
            style={{
              borderColor: !valor ? 'rgb(var(--ac) / 0.55)' : 'rgba(255,255,255,0.10)',
              background: !valor ? 'rgb(var(--ac) / 0.10)' : 'rgba(255,255,255,0.02)',
            }}
            title="Sin emoji"
          >
            —
          </button>
          {EMOJIS.map(e => (
            <button
              key={e}
              type="button"
              onClick={() => onChange(e)}
              className="h-9 w-9 rounded-lg border text-lg leading-none transition-all"
              style={{
                borderColor: valor === e ? 'rgb(var(--ac) / 0.55)' : 'rgba(255,255,255,0.10)',
                background: valor === e ? 'rgb(var(--ac) / 0.10)' : 'rgba(255,255,255,0.02)',
              }}
            >
              {e}
            </button>
          ))}
        </div>
        {ayuda}
      </div>
    )
  }

  if (campo.tipo === 'lista') {
    const items = Array.isArray(valor) ? (valor as Record<string, unknown>[]) : []
    const tope = campo.maxItems ?? 20
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-3.5">
        {etiqueta}
        {ayuda}
        <div className="mt-3 space-y-3">
          {items.map((item, i) => (
            <div key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="font-mono text-[11px] text-white/35">#{i + 1}</span>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    className="text-white/50 hover:text-white disabled:opacity-25"
                    disabled={i === 0}
                    onClick={() => {
                      const c = [...items]
                      ;[c[i - 1], c[i]] = [c[i], c[i - 1]]
                      onChange(c)
                    }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="text-white/50 hover:text-white disabled:opacity-25"
                    disabled={i === items.length - 1}
                    onClick={() => {
                      const c = [...items]
                      ;[c[i + 1], c[i]] = [c[i], c[i + 1]]
                      onChange(c)
                    }}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="text-red-400/80 hover:text-red-400"
                    onClick={() => onChange(items.filter((_, j) => j !== i))}
                  >
                    Borrar
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {(campo.campos ?? []).map(sub => (
                  <CampoEditor
                    key={sub.key}
                    campo={sub}
                    valor={item[sub.key]}
                    productos={productos}
                    onChange={v => {
                      const c = [...items]
                      c[i] = { ...c[i], [sub.key]: v }
                      onChange(c)
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-3 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs text-white/80 transition-all hover:border-white/25 hover:text-white disabled:opacity-30"
          disabled={items.length >= tope}
          onClick={() => onChange([...items, {}])}
        >
          + Agregar
        </button>
      </div>
    )
  }

  return (
    <div>
      {etiqueta}
      {campo.tipo === 'textarea' ? (
        <textarea
          className={input}
          rows={3}
          value={String(valor ?? '')}
          placeholder={campo.placeholder}
          onChange={e => onChange(e.target.value)}
        />
      ) : campo.tipo === 'select' ? (
        <select className={input} value={String(valor ?? '')} onChange={e => onChange(e.target.value)}>
          {(campo.opciones ?? []).map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : campo.tipo === 'color' ? (
        // La paleta de marca primero, y un código propio para lo puntual (un evento, una
        // fecha). El orden importa: lo de marca es el camino fácil, el color libre es el
        // desvío deliberado.
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {PALETA.map(p => (
              <button
                key={p.value}
                type="button"
                title={p.label}
                onClick={() => onChange(p.value)}
                className="h-8 w-8 rounded-full border-2 transition-all"
                style={{
                  background: p.hex,
                  borderColor: valor === p.value ? '#fff' : 'rgba(255,255,255,0.15)',
                  boxShadow: valor === p.value ? '0 0 0 3px rgba(255,255,255,0.12)' : undefined,
                }}
              />
            ))}
            <span className="mx-1 h-6 w-px bg-white/10" />
            <label
              className="flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-1"
              style={{
                borderColor: String(valor ?? '').startsWith('#')
                  ? 'rgba(255,255,255,0.5)'
                  : 'rgba(255,255,255,0.10)',
              }}
              title="Elegir un color propio"
            >
              <input
                type="color"
                className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
                value={String(valor ?? '').startsWith('#') ? String(valor) : '#6f8a5f'}
                onChange={e => onChange(e.target.value)}
              />
              <span className="text-xs text-white/70">Otro color</span>
            </label>
            <input
              type="text"
              placeholder="#a1b2c3"
              maxLength={7}
              className="w-24 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 font-mono text-xs uppercase text-white placeholder:text-white/25 focus:border-white/25 focus:outline-none"
              value={String(valor ?? '').startsWith('#') ? String(valor) : ''}
              onChange={e => {
                const v = e.target.value.trim()
                // Se avisa recién con el código completo: marcar en rojo mientras todavía
                // lo está escribiendo es ruido, no ayuda.
                onChange(v === '' ? 'sage' : v.startsWith('#') ? v : '#' + v)
              }}
            />
          </div>
          {String(valor ?? '').startsWith('#') &&
            !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(valor)) && (
              <p className={`mt-1.5 ${AVISO}`}>
                Código incompleto. Va con almohadilla y seis dígitos, por ejemplo #b0341d. Si se
                guarda así, vuelve al color de marca.
              </p>
            )}
        </div>
      ) : campo.tipo === 'numero' ? (
        <input
          type="number"
          className={input}
          value={Number(valor ?? 0)}
          min={campo.min}
          max={campo.max}
          onChange={e => onChange(Number(e.target.value))}
        />
      ) : (
        <input
          type="text"
          className={input}
          value={String(valor ?? '')}
          placeholder={campo.placeholder}
          onChange={e => onChange(e.target.value)}
        />
      )}
      {ayuda}
    </div>
  )
}
