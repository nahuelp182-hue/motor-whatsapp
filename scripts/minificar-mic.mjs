// Corre solo en el build de Vercel (postbuild), nunca en dev/local. Minifica public/mic.js
// in-place DESPUÉS de que `next build` ya copió /public al output — Next no vuelve a tocar
// esa carpeta, así que el orden es seguro.
//
// Por qué in-place y no un archivo aparte (mic.min.js): la tienda ya apunta a
// https://mw-micelium.vercel.app/mic.js — cambiar la ruta serviría el cambio a las tiendas
// pero rompería cualquier caché/CDN que todavía apunte al nombre viejo por las dudas.
//
// Por qué la fuente legible en public/mic.js no se mueve de lugar: tests/widgets-formato-
// cobertura.test.ts lee public/mic.js como texto y busca patrones (`escStyle(c.titulo, ...)`)
// para verificar que cada campo `formato: true` del registro tenga efecto real — eso solo
// funciona contra el código fuente, no contra una versión minificada con variables renombradas.
// El test corre en CI/pre-deploy contra la fuente sin tocar; recién acá, al final del build de
// producción, se sobreescribe con la versión minificada que efectivamente se sirve.

import { minify } from 'terser'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ruta = resolve(import.meta.dirname, '..', 'public', 'mic.js')
const original = readFileSync(ruta, 'utf-8')

const resultado = await minify(original, {
  compress: true,
  mangle: true,
})

if (!resultado.code) {
  throw new Error('terser no devolvió código minificado para mic.js')
}

writeFileSync(ruta, resultado.code)

const antes = Buffer.byteLength(original)
const despues = Buffer.byteLength(resultado.code)
const ahorro = Math.round((1 - despues / antes) * 100)
console.log(`mic.js minificado: ${antes} -> ${despues} bytes (-${ahorro}%)`)
