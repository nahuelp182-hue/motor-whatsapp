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

const keys = keysConFormato(tipos)

describe('formato: true en el registro de widgets tiene efecto real en mic.js', () => {
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

// Segundo bug real, mismo día (31/08/2026), encontrado DESPUÉS de que el test de arriba ya
// pasaba en verde: `escStyle` presente no alcanza si el dato que le llega ya perdió el
// estilo antes. banner_anuncio hacía `items.map(i => i.texto)` para armar un array de
// strings planos y de ahí en más ningún `i.texto_estilo` viajaba con ellos; el toolbar
// aparecía en el panel, el JSON se guardaba bien, pero el sitio nunca se enteraba.
// crosssell_carrito tenía el mismo problema un nivel más abajo: reconstruía el objeto de
// cada sugerencia (`{ p: pr, nota: regla.nota }`) sin copiar `regla.nota_estilo`.
//
// Estos dos escapan al test de arriba porque buscan la PRESENCIA de `escStyle`, no si la
// variable que recibe es realmente el dato completo. Esto agrega esa segunda verificación,
// específica de los dos antipatrones que ya causaron el bug — no es un análisis de flujo de
// datos genérico (eso pertenece a un linter, no a un test), es una lista negra concreta que
// crece cada vez que aparece una tercera forma de este mismo error.
describe('un campo con formato: true no pierde su _estilo antes de llegar a escStyle', () => {
  it('ningún `.map` extrae solo el texto de un ítem sin extraer su `_estilo` en paralelo', () => {
    // items.map(function (i) { return i.CAMPO; }) — sin que la misma función (o una línea
    // cercana) arme también un array/objeto con CAMPO_estilo. Excepción: dentro de
    // rotarTexto, `pares.map(p => p.texto)` es seguro porque `pares` es un par {texto,
    // estilo} armado ahí mismo (ver la línea de arriba) — se reconoce por `.estilo` sin
    // sufijo, no `${campo}_estilo`, porque ya no es un campo de config sino un par propio.
    const re = /\.map\(function\s*\((\w+)\)\s*\{\s*return\s+\1\.(\w+);?\s*\}\)/g
    let m: RegExpExecArray | null
    const problemas: string[] = []
    while ((m = re.exec(micJs))) {
      const [, , campo] = m
      if (!keys.includes(campo)) continue // no es un campo con formato: true, no aplica
      const alrededor = micJs.slice(Math.max(0, m.index - 300), m.index + 200)
      if (!alrededor.includes(`${campo}_estilo`) && !alrededor.includes('.estilo')) {
        const linea = micJs.slice(0, m.index).split('\n').length
        problemas.push(`L${linea}: .map extrae '${campo}' sin '${campo}_estilo' cerca`)
      }
    }
    expect(problemas, problemas.join('\n')).toEqual([])
  })

  it('ningún objeto reconstruido copia `CAMPO: x.CAMPO` sin copiar `CAMPO_estilo` junto', () => {
    // { ..., CAMPO: regla.CAMPO || '', ... } dentro de un literal de objeto — sin
    // `CAMPO_estilo` en ese mismo literal.
    const re = /\{[^{}]*?(\w+):\s*\w+\.(\w+)(?:\s*\|\|[^,}]*)?,?[^{}]*?\}/g
    let m: RegExpExecArray | null
    const problemas: string[] = []
    while ((m = re.exec(micJs))) {
      const [literal, propName, campo] = m
      if (propName !== campo) continue // { nota: regla.nota } — no { x: regla.nota }
      if (!keys.includes(campo)) continue
      if (literal.includes(`${campo}_estilo`)) continue
      const linea = micJs.slice(0, m.index).split('\n').length
      problemas.push(`L${linea}: objeto copia '${campo}' sin '${campo}_estilo' — ${literal.trim().slice(0, 80)}`)
    }
    expect(problemas, problemas.join('\n')).toEqual([])
  })
})
