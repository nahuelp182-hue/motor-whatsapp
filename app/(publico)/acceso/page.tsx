import FormAcceso from './FormAcceso'

// Área de cliente: no se indexa (no aporta a SEO y es la puerta de datos privados).
export const metadata = {
  title: 'Acceso a tu equipo',
  robots: { index: false, follow: false },
}

export default function PaginaAcceso() {
  return (
    <section style={{ paddingTop: '4.5rem', maxWidth: '32rem' }}>
      <p className="mic-eyebrow">Tu equipo</p>
      <h1 className="mic-titulo">Entrá a tu equipo</h1>
      <div className="mic-regla" />
      <p className="mic-bajada">
        Con tu número de pedido accedés a la guía específica de lo que compraste, el estado de
        tu envío y un asistente que ya sabe qué equipo tenés.
      </p>
      <FormAcceso />
    </section>
  )
}
