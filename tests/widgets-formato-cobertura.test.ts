import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Nace de un bug real (31/08/2026): activé `formato: true` (toolbar de cursiva/fuente/color,
// CampoEditor.tsx) en 62 campos del registro, pero solo conecté el efecto real en mic.js —
// vía `escStyle` — en un puñado de ellos. En los demás el toolbar aparecía en el panel sin
// tener ningún efecto en el sitio: UI que promete algo que no hace. Lo encontré recontando a
// mano una segunda vez, no la primera — un conteo que "coincide con lo esperado" no prueba
// que cada elemento contado tenga su contraparte, solo que el total cierra.
//
// Este test reemplaza esa cuenta manual: cada `key` con `formato: true` en el registro tiene
// que aparecer en mic.js pasando por `escStyle`, sea directo (`escStyle(c.titulo, ...)`) o
// indirecto (a través de una función local, ver INDIRECTOS abajo). Si algún día se agrega un
// campo con `formato: true` y no se conecta en mic.js, esto falla en vez de esperar a la
// próxima auditoría manual.

const raiz = resolve(__dirname, '..')
const tipos = readFileSync(resolve(raiz, 'lib/widgets/tipos.ts'), 'utf-8')
const micJs = readFileSync(resolve(raiz, 'public/mic.js'), 'utf-8')

// `key: 'x', ... formato: true` dentro del mismo objeto de campo (multilínea o inline).
function keysConFormato(src: string): string[] {
  const keys = new Set<string>()
  const re = /\{[^{}]*?key:\s*'(\w+)'[^{}]*?formato:\s*true[^{}]*?\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) keys.add(m[1])
  return [...keys].sort()
}

// Campos cuyo estilo NO llega a mic.js como `escStyle(algo.key, ...)` textual porque pasan
// por una función local (paso(), llenar()) que recibe el estilo como parámetro aparte. Cada
// uno tiene que poder verificarse igual, con el nombre real de la variable que carga el
// estilo en mic.js — si ese nombre desaparece o cambia, el test de abajo lo detecta.
const INDIRECTOS: Record<string, string> = {
  et_compra: 'c.et_compra_estilo',
  et_envio: 'c.et_envio_estilo',
  et_entrega: 'c.et_entrega_estilo',
  titulo_abierto: 'c.titulo_abierto_estilo',
}

describe('formato: true en el registro de widgets tiene efecto real en mic.js', () => {
  const keys = keysConFormato(tipos)

  it('el registro sigue teniendo campos con formato: true (si esto falla, el test de abajo no prueba nada)', () => {
    expect(keys.length).toBeGreaterThan(20)
  })

  it.each(keys)('el campo `%s` pasa por escStyle en mic.js (directo o vía INDIRECTOS)', (key) => {
    const directo = new RegExp(`escStyle\\(\\s*\\w+(?:\\.\\w+)*\\.${key}\\b`).test(micJs)
    const indirecto = key in INDIRECTOS && micJs.includes(INDIRECTOS[key])
    expect(directo || indirecto, `\`${key}\` tiene formato: true pero no se encontró escStyle ni una entrada en INDIRECTOS que aplique`).toBe(true)
  })

  it('cada entrada de INDIRECTOS sigue correspondiendo a un campo con formato: true (si no, es basura acumulada)', () => {
    for (const key of Object.keys(INDIRECTOS)) {
      expect(keys, `INDIRECTOS tiene '${key}' pero ya no tiene formato: true en el registro`).toContain(key)
    }
  })
})
