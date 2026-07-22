'use client'

import { useEffect } from 'react'

/**
 * Barra fina de progreso arriba de todo. Es el único elemento animado de la capa pública:
 * en una guía larga da la señal de "esto termina" sin ocupar espacio ni pedir atención.
 * Se escribe sobre una variable CSS y la barra escala con transform, así no dispara layout.
 */
export default function ProgresoLectura() {
  useEffect(() => {
    let pedido = 0
    const medir = () => {
      pedido = 0
      const alto = document.documentElement.scrollHeight - window.innerHeight
      const p = alto > 0 ? Math.min(1, Math.max(0, window.scrollY / alto)) : 0
      document.documentElement.style.setProperty('--mic-progreso', String(p))
    }
    const alScrollear = () => {
      if (!pedido) pedido = requestAnimationFrame(medir)
    }
    medir()
    window.addEventListener('scroll', alScrollear, { passive: true })
    window.addEventListener('resize', alScrollear)
    return () => {
      window.removeEventListener('scroll', alScrollear)
      window.removeEventListener('resize', alScrollear)
      if (pedido) cancelAnimationFrame(pedido)
    }
  }, [])

  return <div className="mic-progreso" aria-hidden="true" />
}
