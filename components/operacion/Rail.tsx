'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Truck, LayoutGrid, Megaphone, Factory, Wallet } from 'lucide-react'
import { DOMINIO } from '@/components/operacion/ui'

// Rail de secciones de Operación.
//
// Son rutas de verdad y no pestañas en memoria: /operacion/logistica se puede compartir,
// marcar y volver atrás con el botón del navegador. Además cada sección carga solo sus
// datos — entrar a Logística no consulta Meta ni MercadoPago.
//
// SECCIONES lista únicamente lo que ya tiene pantalla. Una entrada que lleva a un 404 o a
// un "próximamente" enseña a desconfiar del menú. El orden es el de lectura: primero qué
// pasa, después por qué (adquisición), después qué hacer (producción, logística) y al final
// cómo quedó la caja.
const SECCIONES = [
  { href: '/operacion/resumen', label: 'Resumen', icon: LayoutGrid, dominio: 'web' as const },
  { href: '/operacion/adquisicion', label: 'Adquisición', icon: Megaphone, dominio: 'crm' as const },
  { href: '/operacion/produccion', label: 'Producción', icon: Factory, dominio: 'prod' as const },
  { href: '/operacion/logistica', label: 'Logística', icon: Truck, dominio: 'log' as const },
  { href: '/operacion/caja', label: 'Caja', icon: Wallet, dominio: 'web' as const },
] as const

export function RailOperacion() {
  const path = usePathname()
  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label="Secciones de Operación">
      {SECCIONES.map(({ href, label, icon: Icono, dominio }) => {
        const activo = path === href
        return (
          <Link
            key={href}
            href={href}
            aria-current={activo ? 'page' : undefined}
            className={`flex h-10 items-center gap-2 rounded-full border px-4 text-[13px] font-medium transition-colors ${
              activo
                ? 'border-[var(--pnl-track)] bg-[var(--pnl-panel-2)] text-[var(--pnl-text)]'
                : 'border-[var(--pnl-hair)] text-[var(--pnl-text-3)] hover:bg-[var(--pnl-panel)] hover:text-[var(--pnl-text-2)]'
            }`}
          >
            <Icono className="size-4" style={{ color: activo ? DOMINIO[dominio].color : undefined }} aria-hidden />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
