'use client'

import { useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronDown } from 'lucide-react'
import { CARD } from './ui'

// Sección plegable del editor de widgets.
//
// El encabezado no es solo un título con una flecha: lleva el RESUMEN de lo que hay adentro
// —"Redondeado · sage · 2 px"—. Sin eso, plegar esconde información y hay que abrir las
// cinco secciones para saber cómo quedó configurado el widget, que es peor que tenerlo todo
// desplegado. Con el resumen, cerrado se lee el estado y abierto se edita.

export function Acordeon({
  icono,
  titulo,
  ayuda,
  resumen,
  cantidad,
  defaultAbierto = false,
  children,
}: {
  icono: string
  titulo: string
  ayuda?: string
  /** Estado actual de la sección en una línea. Lo que hace que valga la pena plegarla. */
  resumen?: string
  cantidad?: number
  defaultAbierto?: boolean
  children: ReactNode
}) {
  const [abierto, setAbierto] = useState(defaultAbierto)

  return (
    <div className={CARD}>
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-[15px] leading-none">
          {icono}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-[15px] font-semibold tracking-tight text-white">{titulo}</span>
            {typeof cantidad === 'number' && (
              <span className="rounded-md bg-white/[0.07] px-1.5 py-0.5 font-mono text-[10px] text-white/45">
                {cantidad}
              </span>
            )}
          </span>
          {/* Cerrada muestra el estado; abierta, para qué sirve la sección. Dos textos
              distintos porque las dos preguntas son distintas. */}
          <span className="mt-0.5 block truncate text-[12px] leading-relaxed text-white/45">
            {abierto ? ayuda : (resumen || ayuda)}
          </span>
        </span>

        <motion.span
          animate={{ rotate: abierto ? 180 : 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="shrink-0 text-white/35"
        >
          <ChevronDown className="size-4" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {abierto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-5 border-t border-white/[0.06] px-4 pb-4 pt-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
