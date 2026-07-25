'use client'

import { AnimatedGridPattern } from '@/components/ui/animated-grid-pattern'

// Ambiente holográfico compartido: grilla animada en perspectiva + auroras difusas cyan/violeta.
// Decorativo puro, detrás del contenido y sin capturar el puntero. Va dentro de un
// <main className="relative isolate"> — se ancla a inset-0 con -z-10.

export function FondoHolografico() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <AnimatedGridPattern
        numSquares={24}
        maxOpacity={0.05}
        duration={5}
        className="absolute inset-x-0 -top-1/4 h-[140%] skew-y-12 text-cyan-300/40 [mask-image:radial-gradient(ellipse_at_top,white,transparent_75%)]"
      />
      <div
        className="absolute -top-40 left-[16%] h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[130px]"
        style={{ animation: 'aurora 12s ease-in-out infinite alternate' }}
      />
      <div
        className="absolute top-24 right-[13%] h-[440px] w-[440px] rounded-full bg-violet-500/10 blur-[130px]"
        style={{ animation: 'aurora 14s ease-in-out infinite alternate' }}
      />
    </div>
  )
}
