import Link from 'next/link'
import { GUIAS_PUBLICAS as GUIAS, minutosLectura } from '@/lib/guias'

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
      <section className="mic-hero mic-hero-portada">
        <p className="mic-eyebrow">Guías de cultivo</p>
        <h1 className="mic-titulo">
          Lo esencial primero.
          <br />
          El resto, después.
        </h1>
        <div className="mic-regla" />
        <p className="mic-bajada">
          La mayoría de las guías de cultivo comparten un defecto: presentan toda la información
          con el mismo peso. Estas están ordenadas según su incidencia real en el resultado, no
          según su facilidad de exposición.
        </p>

        <div className="mic-meta">
          <span className="mic-chip">{GUIAS.length} guías</span>
          <span className="mic-chip">
            {GUIAS.reduce((t, g) => t + minutosLectura(g), 0)} min en total
          </span>
          <span className="mic-chip">Escritas por quienes fabrican el equipo</span>
        </div>
      </section>

      <ol className="mic-lista">
        {GUIAS.map((g, i) => (
          <li key={g.slug} className="mic-item">
            <Link href={`/guia/${g.slug}`}>
              <span className="mic-item-num">{String(i + 1).padStart(2, '0')}</span>
              <span>
                <p className="mic-item-eyebrow">{g.eyebrow}</p>
                <h2 className="mic-item-titulo">{g.titulo}</h2>
                <p className="mic-item-resumen">{g.resumen}</p>
                <p className="mic-item-meta">
                  {minutosLectura(g)} min de lectura
                  <span className="mic-item-flecha" aria-hidden="true">
                    Leer
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M4 12h15m0 0-5.5-5.5M19 12l-5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </p>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <div className="mic-cierre">
        <h3>¿Tenés una consulta puntual?</h3>
        <p>
          Consultale al asistente: responde de inmediato con la información de estas guías. Ante
          un cultivo comprometido o una falla del equipo, deriva a una persona del equipo técnico.
        </p>
        <a className="mic-boton" href="/guia/asistente">
          Abrir el asistente
        </a>
      </div>
    </>
  )
}
