'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  MessagesSquare,
  Megaphone,
  CalendarDays,
  Radar,
  LayoutGrid,
  Star,
  Menu,
  X,
  Activity,
} from 'lucide-react'
import { MARCA, seccionHabilitada } from '@/lib/marca'

// Navegación del panel. Reemplaza a SidebarNav resolviendo tres cosas que
// aquella no tenía:
//   1. Tramo de tablet. SidebarNav era `hidden ... lg:block`: entre 768 y 1024
//      la navegación desaparecía entera y solo quedaba el hamburguesa. Acá
//      md: muestra un riel de iconos.
//   2. Escape no cerraba el drawer. Sí el scrim, pero no el teclado.
//   3. El hamburguesa no declaraba aria-expanded/aria-controls, así que un
//      lector de pantalla no sabía si el menú estaba abierto.
// El foco entra al drawer al abrir y vuelve al disparador al cerrar.

const ITEMS = [
  { href: '/dashboard', label: 'Métricas', icon: LayoutDashboard },
  { href: '/conversaciones', label: 'Conversaciones', icon: MessagesSquare },
  { href: '/marketing-automatico', label: 'Marketing', icon: Megaphone },
  { href: '/calendario', label: 'Calendario', icon: CalendarDays },
  { href: '/radar', label: 'Radar', icon: Radar },
  { href: '/dashboard/widgets', label: 'Widgets', icon: LayoutGrid },
  { href: '/dashboard/resenas', label: 'Reseñas', icon: Star },
  { href: '/sistema', label: 'Sistema', icon: Activity },
] as const

// Cada instancia ve solo sus secciones (ver lib/marca.ts). Micelium las ve todas.
const ITEMS_VISIBLES = ITEMS.filter(i => seccionHabilitada(i.href))

// `/dashboard` es prefijo de `/dashboard/widgets`, así que la coincidencia
// exacta va primero: si no, Métricas queda activa en las tres.
function esActivo(href: string, path: string) {
  if (path === href) return true
  if (href === '/dashboard') return false
  return path.startsWith(href + '/')
}

function Items({ riel, onNavegar }: { riel?: boolean; onNavegar?: () => void }) {
  const path = usePathname()

  return (
    <nav className="flex flex-col gap-0.5 px-3" aria-label="Secciones del panel">
      {ITEMS_VISIBLES.map(({ href, label, icon: Icono }) => {
        const activo = esActivo(href, path)
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavegar}
            aria-current={activo ? 'page' : undefined}
            title={riel ? label : undefined}
            className={[
              'flex min-h-11 items-center gap-3 rounded-md px-3 text-[13.5px] transition-colors',
              riel ? 'justify-center px-0' : 'border-l-2',
              activo
                ? riel
                  ? 'bg-[var(--pnl-panel-2)] text-[var(--pnl-text)] shadow-[inset_2px_0_0_var(--pnl-amber)]'
                  : 'border-l-[var(--pnl-amber)] bg-[var(--pnl-panel-2)] font-semibold text-[var(--pnl-text)]'
                : [
                    'text-[var(--pnl-text-2)] hover:bg-[var(--pnl-panel-2)] hover:text-[var(--pnl-text)]',
                    riel ? '' : 'border-l-transparent',
                  ].join(' '),
            ].join(' ')}
          >
            <Icono className="size-4 shrink-0" aria-hidden />
            {!riel && <span className="whitespace-nowrap">{label}</span>}
          </Link>
        )
      })}
    </nav>
  )
}

function Marca({ riel }: { riel?: boolean }) {
  return (
    <div
      className={[
        'mb-4 flex items-center gap-3 border-b border-[var(--pnl-hair)] pb-5',
        riel ? 'justify-center px-0' : 'px-5',
      ].join(' ')}
    >
      <span className="grid size-[26px] shrink-0 place-items-center rounded-md bg-gradient-to-br from-[var(--pnl-amber)] to-[var(--pnl-amber-soft)] text-[13px] font-bold text-[#23262F]">
        {MARCA.inicial}
      </span>
      {!riel && <span className="whitespace-nowrap text-[13.5px] font-semibold">{MARCA.nombre}</span>}
    </div>
  )
}

export function PanelNav() {
  const [abierto, setAbierto] = useState(false)
  const disparador = useRef<HTMLButtonElement>(null)
  const drawer = useRef<HTMLElement>(null)
  const path = usePathname()

  // Cambiar de ruta cierra el drawer: si no, queda tapando la vista nueva.
  const pathAnterior = useRef(path)
  useEffect(() => {
    if (pathAnterior.current !== path) {
      pathAnterior.current = path
      setAbierto(false)
    }
  }, [path])

  function cerrar() {
    setAbierto(false)
    disparador.current?.focus()
  }

  useEffect(() => {
    if (!abierto) return

    function alTeclado(e: KeyboardEvent) {
      if (e.key === 'Escape') cerrar()
    }
    document.addEventListener('keydown', alTeclado)

    // El foco entra al drawer; si no, el lector de pantalla sigue leyendo
    // el contenido de atrás como si nada se hubiera abierto.
    drawer.current?.querySelector<HTMLElement>('a')?.focus()

    return () => document.removeEventListener('keydown', alTeclado)
  }, [abierto])

  return (
    <>
      {/* Disparador — solo por debajo de md */}
      <button
        ref={disparador}
        onClick={() => setAbierto(true)}
        aria-label="Abrir menú"
        aria-expanded={abierto}
        aria-controls="panel-drawer"
        className="fixed left-3 top-3 z-40 flex size-11 items-center justify-center rounded-lg border border-[var(--pnl-hair)] bg-[var(--pnl-panel-2)] text-[var(--pnl-text)] transition-colors hover:bg-[var(--pnl-track)] md:hidden"
      >
        <Menu className="size-[17px]" aria-hidden />
      </button>

      {/* Riel de iconos — tablet (md a lg) */}
      <aside
        data-isolated=""
        aria-label="Navegación"
        className="fixed inset-y-0 left-0 z-30 hidden w-[var(--pnl-rail)] flex-col border-r border-[var(--pnl-hair)] bg-[var(--pnl-panel)] py-6 md:flex lg:hidden"
      >
        <Marca riel />
        <Items riel />
      </aside>

      {/* Sidebar completa — escritorio */}
      <aside
        data-isolated=""
        aria-label="Navegación"
        className="fixed inset-y-0 left-0 z-30 hidden w-[var(--pnl-sidebar)] flex-col border-r border-[var(--pnl-hair)] bg-[var(--pnl-panel)] py-6 lg:flex"
      >
        <Marca />
        <Items />
      </aside>

      {/* Drawer — celular */}
      {abierto && (
        <div
          onClick={cerrar}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          aria-hidden
        />
      )}
      <aside
        id="panel-drawer"
        ref={drawer}
        data-isolated=""
        aria-label="Navegación"
        aria-hidden={!abierto}
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-[260px] max-w-[82%] flex-col overflow-y-auto',
          'border-r border-[var(--pnl-hair)] bg-[var(--pnl-panel)] py-6 md:hidden',
          'transition-transform duration-200 ease-out motion-reduce:transition-none',
          abierto ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <button
          onClick={cerrar}
          aria-label="Cerrar menú"
          className="absolute right-4 top-4 grid size-9 place-items-center rounded-md border border-[var(--pnl-hair)] bg-[var(--pnl-panel-2)] text-[var(--pnl-text-2)] hover:text-[var(--pnl-text)]"
        >
          <X className="size-4" aria-hidden />
        </button>
        <Marca />
        <Items onNavegar={cerrar} />
      </aside>
    </>
  )
}
