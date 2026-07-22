// Renderizador compartido de guías. Lo usan la ruta pública (/guia/[slug], estática) y la
// privada (/mi-equipo/guia/[slug], dinámica y detrás de sesión). Una sola implementación para
// que las dos se vean igual y no diverjan.
import Link from 'next/link'
import { getGuia, minutosLectura, type Bloque, type Guia } from '@/lib/guias'
import { formatearPesos, precioProducto } from '@/lib/tienda'
import CapturaEmail from './CapturaEmail'
import IndiceLateral from './IndiceLateral'
import ProgresoLectura from './ProgresoLectura'

/* Íconos en SVG inline y monocromo (heredan `currentColor`): sin requests, nítidos en
   cualquier pantalla y siempre en el color del bloque que los contiene. */
const ICONOS = {
  cuidado: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M12 3.5 21.5 20h-19L12 3.5Z" strokeLinejoin="round" />
      <path d="M12 10v4.5" strokeLinecap="round" />
      <circle cx="12" cy="17.4" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  ),
  dato: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" strokeLinecap="round" />
      <circle cx="12" cy="7.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  ),
}

/** Precio leído de Tiendanube al renderizar (componente async de servidor). */
async function BloquePrecio() {
  const p = await precioProducto()

  // Sin dato confiable no se inventa un número: se manda a la tienda.
  if (!p || (!p.promocional && !p.lista)) {
    return (
      <p className="mic-p">
        El precio actualizado está en{' '}
        <a href="https://infomicelium.com.ar" style={{ color: 'var(--verde-accion)' }}>
          la tienda
        </a>
        .
      </p>
    )
  }

  const hoy = p.promocional ?? p.lista!
  const tachado = p.promocional && p.lista && p.lista > p.promocional ? p.lista : null

  return (
    <div className="mic-precio">
      <p className="mic-precio-nota" style={{ margin: '0 0 0.75rem' }}>
        {p.nombre}
      </p>
      <div>
        {tachado && <span className="mic-precio-antes">{formatearPesos(tachado)}</span>}
        <span className="mic-precio-hoy">{formatearPesos(hoy)}</span>
      </div>
      <p className="mic-precio-nota">Con tarjeta, en la tienda</p>

      {p.transferencia && (
        <div className="mic-precio-transf">
          <span className="mic-precio-transf-monto">{formatearPesos(p.transferencia)}</span>
          <span className="mic-precio-transf-label">pagando por transferencia o depósito</span>
        </div>
      )}

      <a className="mic-boton" href={p.url} style={{ marginTop: '1.35rem' }}>
        {p.hayStock ? 'Comprar en la tienda' : 'Ver en la tienda'}
      </a>
    </div>
  )
}

export function RenderBloque({ b, capitular }: { b: Bloque; capitular?: boolean }) {
  switch (b.tipo) {
    case 'parrafo':
      // La capitular solo en el primer párrafo de la guía: marca dónde empieza el texto y
      // le da al artículo un ancla visual sin necesidad de una foto de portada.
      return <p className={capitular ? 'mic-p mic-capitular' : 'mic-p'}>{b.texto}</p>

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
        <aside className="mic-aviso" data-tono={b.tono}>
          <span className="mic-aviso-icono">{ICONOS[b.tono]}</span>
          <p>{b.texto}</p>
        </aside>
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
              <span className="mic-crono-punto" aria-hidden="true">
                {i + 1}
              </span>
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

    case 'precio':
      return <BloquePrecio />
  }
}

/** Cuerpo completo del artículo. `base` define a dónde apuntan las guías relacionadas. */
export function ArticuloGuia({ g, base = '/guia' }: { g: Guia; base?: string }) {
  const fecha = new Date(g.actualizado + 'T12:00:00').toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const minutos = minutosLectura(g)

  return (
    <article>
      <ProgresoLectura />

      <header className="mic-hero">
        <p className="mic-eyebrow">{g.eyebrow}</p>
        <h1 className="mic-titulo">{g.titulo}</h1>
        <div className="mic-regla" />
        <p className="mic-bajada">{g.resumen}</p>

        {/* Barra de datos: lo que el lector necesita para decidir si entra ahora. */}
        <div className="mic-meta">
          <span className="mic-chip">{minutos} min de lectura</span>
          <span className="mic-chip">
            {g.secciones.length} {g.secciones.length === 1 ? 'sección' : 'secciones'}
          </span>
          <span className="mic-chip">Revisada el {fecha}</span>
        </div>
      </header>

      <div className="mic-articulo">
        <div className="mic-lectura">
          {g.secciones.map((s, si) => (
            <section key={s.id} id={s.id} className="mic-seccion">
              <h2 className="mic-h2">
                <span className="mic-h2-num" aria-hidden="true">
                  {String(si + 1).padStart(2, '0')}
                </span>
                {s.titulo}
              </h2>
              {s.bloques.map((b, i) => (
                <RenderBloque key={i} b={b} capitular={si === 0 && i === 0} />
              ))}
            </section>
          ))}

          <p className="mic-item-meta" style={{ marginTop: '3rem' }}>
            Última revisión: {fecha}
          </p>

          {/* Solo en las públicas: a quien ya compró no tiene sentido pedirle el mail a
              cambio de una guía de introducción. */}
          {!g.privada && <CapturaEmail />}

          {g.relacionadas && g.relacionadas.length > 0 && (
            <div className="mic-cierre">
              <h3>Seguí por acá</h3>

              {/* Tarjetas en vez de una línea de links separados por puntos: la guía que
                  sigue tiene que verse como un destino, no como una nota al pie. */}
              <div className="mic-relacionadas">
                {g.relacionadas.map(slug => {
                  const r = getGuia(slug)
                  if (!r) return null
                  // Cada guía se linkea a su propia zona: las privadas dentro de /mi-equipo.
                  const href = r.privada ? `/mi-equipo/guia/${r.slug}` : `/guia/${r.slug}`
                  return (
                    <Link key={slug} href={href} className="mic-tarjeta">
                      <span className="mic-tarjeta-eyebrow">{r.eyebrow}</span>
                      <span className="mic-tarjeta-titulo">{r.titulo}</span>
                      <span className="mic-tarjeta-meta">{minutosLectura(r)} min</span>
                    </Link>
                  )
                })}
              </div>

              <a className="mic-boton" href="https://wa.me/543512145521">
                Consultar por WhatsApp
              </a>
            </div>
          )}
        </div>

        <IndiceLateral secciones={g.secciones.map(s => ({ id: s.id, titulo: s.titulo }))} />
      </div>
    </article>
  )
}
