'use client'

import { useEffect, useState } from 'react'

/**
 * Índice lateral con marcador de sección activa. Sin el marcador, el índice es una lista de
 * links; con él, es un mapa que dice dónde estás parado en una guía larga. Usa
 * IntersectionObserver con un margen que activa la sección cuando su título cruza el tercio
 * superior de la pantalla, que es donde el ojo la está leyendo.
 */
export default function IndiceLateral({
  secciones,
}: {
  secciones: Array<{ id: string; titulo: string }>
}) {
  const [activa, setActiva] = useState<string>(secciones[0]?.id ?? '')

  useEffect(() => {
    const nodos = secciones
      .map(s => document.getElementById(s.id))
      .filter((n): n is HTMLElement => Boolean(n))
    if (!nodos.length) return

    const obs = new IntersectionObserver(
      entradas => {
        const visibles = entradas.filter(e => e.isIntersecting)
        if (visibles.length) {
          // La más alta de las visibles: la que el lector tiene arriba de todo.
          const arriba = visibles.reduce((a, b) =>
            a.boundingClientRect.top < b.boundingClientRect.top ? a : b,
          )
          setActiva(arriba.target.id)
        }
      },
      { rootMargin: '-12% 0px -70% 0px', threshold: 0 },
    )
    nodos.forEach(n => obs.observe(n))
    return () => obs.disconnect()
  }, [secciones])

  if (secciones.length < 2) return null

  return (
    <aside className="mic-toc">
      <p>En esta guía</p>
      <nav>
        {secciones.map((s, i) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            data-activa={s.id === activa ? 'si' : undefined}
          >
            <span className="mic-toc-num">{String(i + 1).padStart(2, '0')}</span>
            {s.titulo}
          </a>
        ))}
      </nav>
    </aside>
  )
}
