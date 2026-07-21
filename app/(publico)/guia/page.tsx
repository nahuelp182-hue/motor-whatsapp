import Link from 'next/link'
import { GUIAS } from '@/lib/guias'

// Estática: se sirve desde el CDN, sin tocar la base. Es lo que hace que la capa pública
// escale sin costo por visita.
export const revalidate = 3600

export const metadata = {
  title: 'Guías de cultivo',
  description:
    'Lo esencial primero: qué define el resultado de un cultivo, qué necesitás además del ' +
    'equipo y cómo funciona la incubadora.',
}

export default function IndiceGuias() {
  return (
    <>
      <section style={{ paddingTop: '5rem' }}>
        <p className="mic-eyebrow">Guías de cultivo</p>
        <h1 className="mic-titulo">
          Lo esencial primero.
          <br />
          El resto, después.
        </h1>
        <div className="mic-regla" />
        <p className="mic-bajada">
          La mayoría de las guías de cultivo tienen el mismo problema: todo parece igual de
          importante. Estas están ordenadas por lo que realmente cambia el resultado, y no por
          lo que es más fácil de explicar.
        </p>
      </section>

      <ol className="mic-lista">
        {GUIAS.map((g, i) => (
          <li key={g.slug} className="mic-item">
            <Link href={`/guia/${g.slug}`}>
              <span className="mic-item-num">{String(i + 1).padStart(2, '0')}</span>
              <span>
                <h2 className="mic-item-titulo">{g.titulo}</h2>
                <p className="mic-item-resumen">{g.resumen}</p>
                <p className="mic-item-meta">{g.eyebrow}</p>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <div className="mic-cierre">
        <h3>¿Tenés una duda puntual?</h3>
        <p>
          Preguntale al asistente: responde al instante con la información de estas guías. Y si
          tu cultivo va mal o hay una falla, te pasa con una persona del equipo.
        </p>
        <a className="mic-boton" href="/guia/asistente">
          Abrir el asistente
        </a>
      </div>
    </>
  )
}
