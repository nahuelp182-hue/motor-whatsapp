import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, style, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border px-2.5 py-2 text-base transition-colors outline-none placeholder:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--pnl-amber)] disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
        className
      )}
      // Mismo motivo que Input (components/ui/input.tsx): colores fijos del panel (--pnl-*)
      // en vez de los de shadcn, que nunca se oscurecen en .panel-root.
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

export { Textarea }
