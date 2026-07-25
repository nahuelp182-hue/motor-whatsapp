'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
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
  Sprout,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Navegación lateral del motor. Iconos SVG (Lucide), disposición tipo sidebar: rail fijo en
// escritorio, drawer deslizante en celular. Item activo con píldora holográfica que se desliza
// (layoutId). Sin emojis. Es fixed y data-isolated: no toca el flujo ni lo pisan los overrides
// de modo claro. Las páginas solo suman padding-left en lg para dejarle el lugar.

const ITEMS = [
  { href: '/dashboard', label: 'Métricas', icon: LayoutDashboard },
  { href: '/conversaciones', label: 'Conversaciones', icon: MessagesSquare },
  { href: '/marketing-automatico', label: 'Marketing', icon: Megaphone },
  { href: '/calendario', label: 'Calendario', icon: CalendarDays },
  { href: '/radar', label: 'Radar', icon: Radar },
  { href: '/dashboard/widgets', label: 'Widgets', icon: LayoutGrid },
  { href: '/dashboard/resenas', label: 'Reseñas', icon: Star },
] as const

export function SidebarNav() {
  const path = usePathname()
  const [open, setOpen] = useState(false)

  const activo = (href: string) =>
    href === '/dashboard' ? path === '/dashboard' : path.startsWith(href)

  function Contenido({ id, onNavegar }: { id: string; onNavegar?: () => void }) {
    return (
      <div className="flex h-full flex-col p-3">
        {/* Marca */}
        <div className="mb-5 flex items-center gap-2.5 px-2 pt-1">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-violet-500/30 shadow-[0_0_16px_-3px_rgba(56,189,248,0.6)]">
            <Sprout className="size-5 text-cyan-200" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-white">Micelium</span>
        </div>

        {/* Items */}
        <nav className="flex flex-1 flex-col gap-1">
          {ITEMS.map(it => {
            const on = activo(it.href)
            const Icon = it.icon
            return (
              <Link
                key={it.href}
                href={it.href}
                onClick={onNavegar}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors',
                  on ? 'text-white' : 'text-white/55 hover:text-white/90',
                )}
              >
                {on && (
                  <motion.span
                    layoutId={`navPill-${id}`}
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/25 to-violet-500/25 ring-1 ring-white/10"
                    transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                  />
                )}
                <Icon className={cn('relative z-10 size-[18px] shrink-0', on && 'text-cyan-200')} />
                <span className="relative z-10 truncate">{it.label}</span>
              </Link>
            )
          })}
        </nav>

        <p className="px-3 pb-1 pt-3 text-[10px] uppercase tracking-[0.15em] text-white/25">
          Motor Micelium
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Botón hamburguesa — solo celular */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        className="fixed left-3 top-3 z-40 flex size-10 items-center justify-center rounded-xl border border-white/10 bg-[#0a0a14]/85 text-white/70 backdrop-blur transition-colors hover:text-white lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      {/* Sidebar fija — escritorio */}
      <aside
        data-isolated=""
        className="fixed inset-y-0 left-0 z-30 hidden w-[232px] border-r border-white/10 bg-[#0a0a12]/80 backdrop-blur-xl lg:block"
      >
        <Contenido id="desk" />
      </aside>

      {/* Drawer — celular */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              data-isolated=""
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 w-[248px] border-r border-white/10 bg-[#0a0a12]/95 backdrop-blur-xl lg:hidden"
            >
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="absolute right-3 top-3.5 z-10 text-white/50 hover:text-white"
              >
                <X className="size-5" />
              </button>
              <Contenido id="mob" onNavegar={() => setOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
