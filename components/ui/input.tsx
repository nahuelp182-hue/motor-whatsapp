import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, style, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--pnl-amber)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
        className
      )}
      // Colores fijos del panel (--pnl-*), no los de shadcn (--card/--muted/--foreground):
      // este Input solo se usa dentro de .panel-root (el editor de widgets), que es oscuro
      // por diseño propio y nunca activa la clase `.dark` de Tailwind — shadcn se quedaba
      // sirviendo su paleta clara (fondo casi blanco) mientras heredaba el `color` casi
      // blanco de `.panel-root`, y el resultado era texto invisible sobre fondo invisible.
      style={{
        background: 'var(--pnl-panel-2)',
        borderColor: 'var(--pnl-hair)',
        color: 'var(--pnl-text)',
        ...style,
      }}
      {...props}
    />
  )
}

export { Input }
