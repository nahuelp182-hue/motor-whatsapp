import Link from 'next/link'
import { MARCA } from '@/lib/marca'

// Destino del rewrite del middleware cuando se pide una sección que esta instancia no
// tiene habilitada (ver PREFIJOS_MARCA en middleware.ts). Se sirve con status 404: para
// esta tienda la ruta no existe, no es "no tenés permiso".
export const metadata = { robots: { index: false, follow: false } }

export default function SeccionInexistente() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 p-6 text-center"
      style={{ background: '#07070f' }}>
      <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">{MARCA.nombre}</p>
      <h1 className="text-lg font-semibold text-white">Esta sección no existe en este panel</h1>
      <p className="max-w-sm text-xs leading-relaxed text-white/40">
        El panel de esta tienda tiene solo las secciones del menú lateral.
      </p>
      <Link
        href={MARCA.inicio}
        className="rounded-lg border border-white/[0.12] px-4 py-2 text-xs text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
      >
        Volver
      </Link>
    </main>
  )
}
