'use client'

import { PALETA, type Campo } from '@/lib/widgets/tipos'

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
  if (campo.tipo === 'booleano') {
    return (
      <label className="flex items-center gap-2 py-1 text-sm">
        <input type="checkbox" checked={valor === true} onChange={e => onChange(e.target.checked)} />
        <span>{campo.label}</span>
      </label>
    )
  }

  const etiqueta = (
    <label className="mb-1 block text-xs font-medium text-neutral-600">
      {campo.label}
      {campo.ayuda && <span className="ml-2 font-normal text-neutral-400">{campo.ayuda}</span>}
    </label>
  )

  if (campo.tipo === 'lista') {
    const items = Array.isArray(valor) ? (valor as Record<string, unknown>[]) : []
    const tope = campo.maxItems ?? 20
    return (
      <div className="rounded border border-neutral-200 p-3">
        {etiqueta}
        <div className="space-y-3">
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
    </div>
  )
}
