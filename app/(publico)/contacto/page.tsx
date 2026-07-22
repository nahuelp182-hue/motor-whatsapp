import FormContacto from './FormContacto'

export const metadata = {
  title: 'Contacto',
  description:
    'Escribile al equipo de Micelium: dudas del equipo, de tu compra o de tu cultivo. ' +
    'Respondemos por correo, normalmente dentro del día.',
}

export default function PaginaContacto() {
  return (
    <>
      <section style={{ paddingTop: '4.5rem' }}>
        <p className="mic-eyebrow">Contacto</p>
        <h1 className="mic-titulo">Escribinos</h1>
        <div className="mic-regla" />
        <p className="mic-bajada">
          Contanos qué necesitás y te respondemos por correo, normalmente dentro del día. Si tu
          cultivo va mal, sumá cuántos días pasaron desde que armaste, qué temperatura marca el
          equipo y en qué zona estás: con esos tres datos se resuelve casi siempre.
        </p>
      </section>

      <FormContacto />

      <div className="mic-cierre">
        <h3>¿Preferís una respuesta ahora?</h3>
        <p>
          El asistente responde al instante con la información de las guías, y si hace falta te
          pasa con una persona del equipo.
        </p>
        <a className="mic-boton" href="/guia/asistente">
          Abrir el asistente
        </a>
      </div>
    </>
  )
}
