'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
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

  // El rango del filtro maestro viaja con el link. Sin esto, moverse de Resumen a Logística
  // reseteaba la ventana al default y el filtro dejaba de ser maestro apenas cambiabas de
  // pantalla — que es justo cuando más importa que no cambie.
  //
  // Se lee en un efecto y no en el render: en el servidor no existe `location`, y usar
  // `useSearchParams` obligaría a envolver cada página en <Suspense>.
  const [query, setQuery] = useState('')
  useEffect(() => {
    const leer = () => {
      const p = new URLSearchParams(window.location.search)
      const desde = p.get('desde'); const hasta = p.get('hasta')
      setQuery(desde && hasta ? `?desde=${desde}&hasta=${hasta}` : '')
    }
    leer()
    window.addEventListener('popstate', leer)
    return () => window.removeEventListener('popstate', leer)
  }, [path])
  return (
    <nav className="flex flex-wrap items-center gap-2" aria-label="Secciones de Operación">
      {SECCIONES.map(({ href, label, icon: Icono, dominio }) => {
        const activo = path === href
        return (
          <Link
            key={href}
            href={`${href}${query}`}
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
