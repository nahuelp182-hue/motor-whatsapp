import type { ReactNode } from 'react'
import { PanelNav } from '@/components/PanelNav'

// Shell del panel: navegación + offset + skip link, en un solo lugar.
//
// Antes cada una de las 8 vistas repetía el mismo bloque a mano, y ya habían
// divergido: /sistema usaba lg:pl-[248px] contra 256px del resto (la columna
// se corría 8px al cambiar de vista) y no todas traían los mismos efectos de
// fondo. Con esto el offset sale de --pnl-sidebar y no puede volver a
// desincronizarse.

export function PanelShell({
  titulo,
  sub,
  accion,
  children,
}: {
  titulo: string
  /** Contexto del título: período, cantidad, última actualización. */
  sub?: ReactNode
  /** Zona derecha de la barra: estado, botón de acción. */
  accion?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="panel-root min-h-screen max-md:pt-16 md:pl-[var(--pnl-rail)] lg:pl-[var(--pnl-sidebar)]">
      <a className="panel-skip" href="#panel-contenido">
        Saltar al contenido
      </a>

      <PanelNav />

      <header className="flex items-center gap-4 border-b border-[var(--pnl-hair)] bg-[color-mix(in_srgb,var(--pnl-panel)_50%,transparent)] px-5 py-4">
        <div className="min-w-0">
          {/* h1 y no h2: cada vista necesita su propio encabezado de nivel 1
              para que un lector de pantalla encuentre de qué trata la página. */}
          <h1 className="truncate text-base font-semibold">{titulo}</h1>
          {sub && <div className="mt-0.5 text-xs text-[var(--pnl-text-3)]">{sub}</div>}
        </div>
        {accion && <div className="ml-auto shrink-0">{accion}</div>}
      </header>

      {/* tabIndex -1 para que el skip link pueda dejar el foco acá. */}
      <main id="panel-contenido" tabIndex={-1} className="flex flex-col gap-6 p-5 outline-none">
        {children}
      </main>
    </div>
  )
}
