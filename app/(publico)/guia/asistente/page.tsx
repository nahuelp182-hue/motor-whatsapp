import ChatAsistente from './ChatAsistente'

export const metadata = {
  title: 'Asistente',
  description:
    'Preguntale al asistente de Micelium sobre el equipo, el cultivo o tu compra. Respuestas ' +
    'al instante, y si hace falta te pasamos con una persona.',
}

export default function PaginaAsistente() {
  return (
    <>
      <section style={{ paddingTop: '4.5rem' }}>
        <p className="mic-eyebrow">Asistente</p>
        <h1 className="mic-titulo">Preguntá lo que quieras</h1>
        <div className="mic-regla" />
        <p className="mic-bajada">
          Te respondo al instante sobre el equipo, el cultivo y tu compra, con la misma
          información de las guías. Si tu cultivo va mal o hay una falla, te paso con una
          persona del equipo.
        </p>
      </section>

      <ChatAsistente />
    </>
  )
}
