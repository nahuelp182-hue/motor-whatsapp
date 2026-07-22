import Link from 'next/link'
import { notFound } from 'next/navigation'
import { GUIAS, getGuia, type Bloque, type Guia } from '@/lib/guias'

export const revalidate = 3600

export function generateStaticParams() {
  return GUIAS.map(g => ({ slug: g.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const g = getGuia((await params).slug)
  if (!g) return {}
  return { title: g.titulo, description: g.resumen }
}

function RenderBloque({ b }: { b: Bloque }) {
  switch (b.tipo) {
    case 'parrafo':
      return <p className="mic-p">{b.texto}</p>

    case 'vital':
      return (
        <div className="mic-vital">
          <span className="mic-vital-num">{b.numero}</span>
          <div>
            <h3 className="mic-vital-titulo">{b.titulo}</h3>
            <p className="mic-vital-texto">{b.texto}</p>
          </div>
        </div>
      )

    case 'pasos':
      return (
        <ol className="mic-pasos">
          {b.items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      )

    case 'aviso':
      return (
        <p className="mic-aviso" data-tono={b.tono}>
          {b.texto}
        </p>
      )

    case 'faq':
      return (
        <dl className="mic-faq">
          {b.items.map((it, i) => (
            <div key={i}>
              <dt>{it.p}</dt>
              <dd>
                {it.r.startsWith('PENDIENTE') ? (
                  <span className="mic-pendiente">falta confirmar</span>
                ) : (
                  it.r
                )}
              </dd>
            </div>
          ))}
        </dl>
      )

    case 'datos':
      return (
        <table className="mic-datos">
          <tbody>
            {b.filas.map((f, i) => (
              <tr key={i}>
                <th scope="row">{f.clave}</th>
                <td>
                  {f.verificar ? <span className="mic-pendiente">falta confirmar</span> : f.valor}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )
  }
}

function Indice({ g }: { g: Guia }) {
  if (g.secciones.length < 2) return null
  return (
    <aside className="mic-toc">
      <p>En esta guía</p>
      {g.secciones.map(s => (
        <a key={s.id} href={`#${s.id}`}>
          {s.titulo}
        </a>
      ))}
    </aside>
  )
}

export default async function PaginaGuia({ params }: { params: Promise<{ slug: string }> }) {
  const g = getGuia((await params).slug)
  if (!g) notFound()

  const fecha = new Date(g.actualizado + 'T12:00:00').toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <article>
      <header style={{ paddingTop: '4.5rem' }}>
        <p className="mic-eyebrow">{g.eyebrow}</p>
        <h1 className="mic-titulo">{g.titulo}</h1>
        <div className="mic-regla" />
        <p className="mic-bajada">{g.resumen}</p>
      </header>

      <div className="mic-articulo">
        <div className="mic-lectura">
          {g.secciones.map(s => (
            <section key={s.id} id={s.id}>
              <h2 className="mic-h2">{s.titulo}</h2>
              {s.bloques.map((b, i) => (
                <RenderBloque key={i} b={b} />
              ))}
            </section>
          ))}

          <p className="mic-item-meta" style={{ marginTop: '3rem' }}>
            Última revisión: {fecha}
          </p>

          {g.relacionadas && g.relacionadas.length > 0 && (
            <div className="mic-cierre">
              <h3>Seguí por acá</h3>
              <p>
                {g.relacionadas.map((slug, i) => {
                  const r = getGuia(slug)
                  if (!r) return null
                  return (
                    <span key={slug}>
                      {i > 0 && ' · '}
                      <Link href={`/guia/${r.slug}`} style={{ color: 'var(--verde-accion)' }}>
                        {r.titulo}
                      </Link>
                    </span>
                  )
                })}
              </p>
              <a className="mic-boton" href="https://wa.me/543512145521">
                Consultar por WhatsApp
              </a>
            </div>
          )}
        </div>

        <Indice g={g} />
      </div>
    </article>
  )
}
