import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { COOKIE_CLIENTE_NOMBRE, verificarSesionCliente } from '@/lib/session'
import { estadoEnvio, type EquipoId } from '@/lib/pedidos'
import { getGuia } from '@/lib/guias'
import SalirBoton from './SalirBoton'

// Datos privados del cliente: nunca se indexa. Dinámico (lee cookie + Tiendanube en vivo).
export const metadata = { title: 'Mi equipo', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

const NOMBRE_EQUIPO: Record<EquipoId, string> = {
  inc101: 'Incubadora INC101',
  pc400: 'Tableta térmica',
  otro: 'Tu compra',
}

// Material completo del cliente: primero los manuales detallados (privados), después las
// guías generales. El orden importa: lo que compró está arriba.
function guiasDe(equipos: string[]): string[] {
  if (equipos.includes('inc101')) {
    return ['manual-inc101', 'cultivo-paso-a-paso', 'los-dos-vitales', 'solucion-de-problemas']
  }
  return ['manual-inc101', 'los-dos-vitales', 'solucion-de-problemas']
}

function BloqueEnvio({
  envio,
}: {
  envio: Awaited<ReturnType<typeof estadoEnvio>>
}) {
  if (envio === null) {
    return (
      <p className="mic-p" style={{ color: 'var(--tinta-suave)' }}>
        No pudimos consultar el estado del envío en este momento. Probá de nuevo en un rato, o
        escribinos por WhatsApp con tu número de pedido.
      </p>
    )
  }
  if (!envio.tracking) {
    return (
      <p className="mic-p" style={{ color: 'var(--tinta-suave)' }}>
        Todavía no hay número de seguimiento cargado. Apenas despachemos tu pedido, va a
        aparecer acá.
      </p>
    )
  }
  return (
    <>
      <table className="mic-datos">
        <tbody>
          <tr>
            <th scope="row">Estado</th>
            <td>{envio.despachado ? 'Despachado, en camino' : 'En preparación'}</td>
          </tr>
          <tr>
            <th scope="row">Correo</th>
            <td>{envio.correo ?? (envio.esAndreani ? 'Andreani' : '—')}</td>
          </tr>
          <tr>
            <th scope="row">{envio.pickup ? 'Retiro en sucursal' : 'Entrega a domicilio'}</th>
            <td>Nº de seguimiento: {envio.tracking}</td>
          </tr>
        </tbody>
      </table>
      {envio.esAndreani && (
        <a
          className="mic-msg-guia"
          href={`https://www.andreani.com/#!/informacionEnvio/${envio.tracking}`}
        >
          Seguir en Andreani →
        </a>
      )}
    </>
  )
}

export default async function MiEquipo() {
  const jar = await cookies()
  const secreto = process.env.DASHBOARD_PASSWORD ?? ''
  const sesion = await verificarSesionCliente(jar.get(COOKIE_CLIENTE_NOMBRE)?.value, secreto)

  // Defensa en profundidad: el middleware ya bloquea, pero la página también valida por si
  // se la alcanza por otro camino. El customerId sale de la cookie, nunca de la URL (anti-IDOR).
  if (!sesion) redirect('/acceso')

  const envio = await estadoEnvio(sesion.num)
  const guias = guiasDe(sesion.eq)
  const equipos = (sesion.eq.length ? sesion.eq : ['otro']) as EquipoId[]

  return (
    <>
      <section style={{ paddingTop: '4.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
          <p className="mic-eyebrow">Tu equipo</p>
          <SalirBoton />
        </div>
        <h1 className="mic-titulo">Hola{sesion.nom ? `, ${sesion.nom}` : ''}</h1>
        <div className="mic-regla" />
        <p className="mic-bajada">
          Pedido #{sesion.num}. Acá tenés todo lo de tu compra en un solo lugar.
        </p>
      </section>

      <section id="equipo">
        <h2 className="mic-h2">Lo que compraste</h2>
        <ul className="mic-pasos" style={{ counterReset: 'none' }}>
          {equipos.map((e, i) => (
            <li key={i} style={{ paddingLeft: 0 }}>
              {NOMBRE_EQUIPO[e]}
            </li>
          ))}
        </ul>
      </section>

      <section id="guias">
        <h2 className="mic-h2">Tus manuales y guías</h2>
        <p className="mic-p" style={{ color: 'var(--tinta-suave)' }}>
          El material completo de tu equipo, con los tiempos, temperaturas y cantidades exactas.
          Está siempre acá: no hace falta que busques el mail.
        </p>
        <ul className="mic-lista" style={{ marginTop: '1rem' }}>
          {guias.map((slug, i) => {
            const g = getGuia(slug)
            if (!g) return null
            const href = g.privada ? `/mi-equipo/guia/${g.slug}` : `/guia/${g.slug}`
            return (
              <li key={slug} className="mic-item">
                <Link href={href}>
                  <span className="mic-item-num">{String(i + 1).padStart(2, '0')}</span>
                  <span>
                    <h3 className="mic-item-titulo">{g.titulo}</h3>
                    <p className="mic-item-resumen">{g.resumen}</p>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <section id="envio">
        <h2 className="mic-h2">Tu envío</h2>
        <BloqueEnvio envio={envio} />
      </section>

      <div className="mic-cierre">
        <h3>¿Tenés una duda sobre tu equipo?</h3>
        <p>
          El asistente ya sabe qué compraste y cómo viene tu envío: preguntale directamente. Y si
          tu cultivo va mal o hay una falla, escribinos por WhatsApp con tu pedido (#{sesion.num})
          y lo vemos con una persona.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link className="mic-boton" href="/guia/asistente">
            Preguntar al asistente
          </Link>
          <a
            className="mic-boton"
            href="https://wa.me/543512145521"
            style={{ background: 'transparent', color: 'var(--verde-accion)', border: '1px solid var(--linea-fuerte)' }}
          >
            Escribir por WhatsApp
          </a>
        </div>
      </div>
    </>
  )
}
