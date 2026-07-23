'use client'

import { PALETA, UBICACIONES, DESTINOS, EMOJIS, type Campo } from '@/lib/widgets/tipos'

// Formulario genérico: dibuja UN campo a partir de su declaración en lib/widgets/tipos.ts.
// Ningún tipo de widget tiene formulario propio. Agregar un tipo nuevo no toca este archivo
// mientras use los tipos de campo ya soportados — que es justo el punto del diseño.

type Props = {
  campo: Campo
  valor: unknown
  onChange: (v: unknown) => void
}

const input =
  'w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none'

export function CampoEditor({ campo, valor, onChange }: Props) {
  // La ayuda va SIEMPRE debajo del campo y en renglón aparte, no como texto gris al lado
  // del rótulo. Es la diferencia entre poder configurar un widget sin preguntarle a nadie y
  // tener que acordarse de qué hacía cada casilla.
  const ayuda = campo.ayuda ? (
    <p className="mt-1 text-xs leading-relaxed text-neutral-500">{campo.ayuda}</p>
  ) : null

  if (campo.tipo === 'booleano') {
    return (
      <div className="py-1">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={valor === true} onChange={e => onChange(e.target.checked)} />
          <span>{campo.label}</span>
        </label>
        {campo.ayuda && <p className="ml-6 mt-1 text-xs leading-relaxed text-neutral-500">{campo.ayuda}</p>}
      </div>
    )
  }

  const etiqueta = <label className="mb-1 block text-xs font-medium text-neutral-600">{campo.label}</label>

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
                className={`w-[104px] rounded border-2 p-2 text-left ${
                  activo ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200'
                }`}
              >
                <div className="mb-1.5 space-y-[3px] rounded bg-white p-1.5 ring-1 ring-neutral-200">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className={
                        i === posicion
                          ? 'h-2 rounded-sm bg-emerald-600'
                          : `h-[3px] rounded-sm bg-neutral-300 ${i % 2 ? 'w-3/4' : 'w-full'}`
                      }
                    />
                  ))}
                </div>
                <span className="block text-[11px] leading-tight text-neutral-700">{u.label}</span>
              </button>
            )
          })}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-neutral-500">{elegida.ayuda}</p>
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

  if (campo.tipo === 'emoji') {
    return (
      <div>
        {etiqueta}
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => onChange('')}
            className={`h-9 w-9 rounded border text-xs ${
              !valor ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200'
            }`}
            title="Sin emoji"
          >
            —
          </button>
          {EMOJIS.map(e => (
            <button
              key={e}
              type="button"
              onClick={() => onChange(e)}
              className={`h-9 w-9 rounded border text-lg ${
                valor === e ? 'border-neutral-900 bg-neutral-50' : 'border-neutral-200'
              }`}
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
      <div className="rounded border border-neutral-200 p-3">
        {etiqueta}
        {ayuda}
        <div className="mt-3 space-y-3">
          {items.map((item, i) => (
            <div key={i} className="rounded bg-neutral-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-neutral-400">#{i + 1}</span>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    className="text-neutral-500 disabled:opacity-30"
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
                    className="text-neutral-500 disabled:opacity-30"
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
                    className="text-red-600"
                    onClick={() => onChange(items.filter((_, j) => j !== i))}
                  >
                    Borrar
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {(campo.campos ?? []).map(sub => (
                  <CampoEditor
                    key={sub.key}
                    campo={sub}
                    valor={item[sub.key]}
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
          className="mt-3 rounded border border-neutral-300 px-3 py-1 text-xs disabled:opacity-40"
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
        // Sin selector libre: solo la paleta de marca. Ver el comentario en tipos.ts.
        <div className="flex gap-2">
          {PALETA.map(p => (
            <button
              key={p.value}
              type="button"
              title={p.label}
              onClick={() => onChange(p.value)}
              className={`h-8 w-8 rounded-full border-2 ${
                valor === p.value ? 'border-neutral-900' : 'border-neutral-200'
              }`}
              style={{ background: p.hex }}
            />
          ))}
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
