// Renderizador compartido de guías. Lo usan la ruta pública (/guia/[slug], estática) y la
// privada (/mi-equipo/guia/[slug], dinámica y detrás de sesión). Una sola implementación para
// que las dos se vean igual y no diverjan.
import Link from 'next/link'
import { getGuia, type Bloque, type Guia } from '@/lib/guias'

export function RenderBloque({ b }: { b: Bloque }) {
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
                <td>{f.verificar ? <span className="mic-pendiente">falta confirmar</span> : f.valor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )

    case 'cronograma':
      return (
        <div className="mic-crono">
          {b.filas.map((f, i) => (
            <div key={i} className="mic-crono-fila">
              <div className="mic-crono-cab">
                <span className="mic-crono-etapa">{f.etapa}</span>
                <span className="mic-crono-dias">{f.dias}</span>
              </div>
              <p className="mic-crono-que">{f.que}</p>
              {f.ojo && <p className="mic-crono-ojo">{f.ojo}</p>}
            </div>
          ))}
        </div>
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

/** Cuerpo completo del artículo. `base` define a dónde apuntan las guías relacionadas. */
export function ArticuloGuia({ g, base = '/guia' }: { g: Guia; base?: string }) {
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
                  // Cada guía se linkea a su propia zona: las privadas dentro de /mi-equipo.
                  const href = r.privada ? `/mi-equipo/guia/${r.slug}` : `/guia/${r.slug}`
                  return (
                    <span key={slug}>
                      {i > 0 && ' · '}
                      <Link href={href} style={{ color: 'var(--verde-accion)' }}>
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
