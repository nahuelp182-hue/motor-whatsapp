'use client'

import { motion, useReducedMotion } from 'motion/react'

// Número que rueda tipo odómetro. Cada dígito es una columna 0-9 que se desliza en vertical
// hasta el valor objetivo; los separadores (. / % $ —) van estáticos. Es agnóstico al formato,
// así sirve igual para "1.234", "12.5%", "3/12" o "—" sin ninguna cuenta aparte.
//
// Por qué propio y no el componente de Framer: ese módulo importa el runtime de Framer y no
// entra en un Next normal. Con `motion` (Framer Motion, ya instalado) el efecto es el mismo,
// pesa nada y respeta prefers-reduced-motion.

const TRANS = { type: 'spring', stiffness: 140, damping: 20, mass: 0.7 } as const

// Una celda de alto 1em para TODO carácter (dígito o separador): al ser todas iguales,
// alinean perfecto en una fila, sin problemas de baseline con las columnas recortadas.
const CELDA: React.CSSProperties = { display: 'inline-block', height: '1em', lineHeight: 1, verticalAlign: 'bottom' }

function Digito({ d }: { d: number }) {
  return (
    <span style={{ ...CELDA, overflow: 'hidden' }}>
      <motion.span
        style={{ display: 'flex', flexDirection: 'column' }}
        animate={{ y: `-${d}em` }}
        transition={TRANS}
      >
        {Array.from({ length: 10 }, (_, n) => (
          <span key={n} style={{ height: '1em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  )
}

export function NumeroRodante({ value, className }: { value: string; className?: string }) {
  const reduce = useReducedMotion()
  if (reduce) return <span className={className}>{value}</span>
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'flex-end', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
    >
      {value.split('').map((ch, i) =>
        /[0-9]/.test(ch) ? (
          <Digito key={i} d={Number(ch)} />
        ) : (
          <span key={i} style={{ ...CELDA, display: 'inline-flex', alignItems: 'center' }}>
            {ch}
          </span>
        ),
      )}
    </span>
  )
}
