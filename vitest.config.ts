import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Tests unitarios de la lógica pura de `lib/` (firma de sesiones, validaciones, parseo).
// A propósito NO levanta base ni servidor: lo que corre acá tiene que poder correr en
// cualquier lado y en menos de un segundo, o deja de correrse.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
