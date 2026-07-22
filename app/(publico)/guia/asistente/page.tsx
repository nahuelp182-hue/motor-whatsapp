import { cookies } from 'next/headers'
import { COOKIE_CLIENTE_NOMBRE, verificarSesionCliente } from '@/lib/session'
import ChatAsistente from './ChatAsistente'

export const metadata = {
  title: 'Asistente',
  description:
    'Preguntale al asistente de Micelium® sobre el equipo, el cultivo o tu compra. Respuestas ' +
    'al instante, y si hace falta te pasamos con una persona.',
}

// Dinámico: mira la cookie de cliente para personalizar el saludo si ya compró.
export const dynamic = 'force-dynamic'

export default async function PaginaAsistente() {
  const jar = await cookies()
  const secreto = process.env.DASHBOARD_PASSWORD ?? ''
  const ses = await verificarSesionCliente(jar.get(COOKIE_CLIENTE_NOMBRE)?.value, secreto)
  const nombre = ses?.nom ?? null

  return (
    <>
      <section style={{ paddingTop: '4.5rem' }}>
        <p className="mic-eyebrow">Asistente</p>
        <h1 className="mic-titulo">Preguntá lo que quieras</h1>
        <div className="mic-regla" />
        <p className="mic-bajada">
          {nombre
            ? 'Ya sé qué equipo tenés y cómo viene tu envío: preguntame directamente. Si tu cultivo va mal o hay una falla, te paso con una persona del equipo.'
            : 'Te respondo al instante sobre el equipo, el cultivo y tu compra, con la misma información de las guías. Si tu cultivo va mal o hay una falla, te paso con una persona del equipo.'}
        </p>
      </section>

      <ChatAsistente nombreCliente={nombre} />
    </>
  )
}
