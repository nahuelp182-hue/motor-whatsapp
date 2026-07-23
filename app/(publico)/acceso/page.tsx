import FormAcceso from './FormAcceso'

// Área de cliente: no se indexa (no aporta a SEO y es la puerta de datos privados).
export const metadata = {
  title: 'Acceso a tu cuenta',
  robots: { index: false, follow: false },
}

export default async function PaginaAcceso({
  searchParams,
}: {
  searchParams: Promise<{ link?: string }>
}) {
  // `?link=vencido|usado` lo pone /e/[token] cuando el enlace pre-autenticado no sirve. El
  // cliente aterriza acá sabiendo por qué, y con la puerta de email lista para pedir otro.
  const { link } = await searchParams
  const aviso = link === 'usado' || link === 'vencido' ? link : undefined

  return (
    <section style={{ paddingTop: '4.5rem', maxWidth: '32rem' }}>
      <p className="mic-eyebrow">Tu cuenta</p>
      <h1 className="mic-titulo">Entrá a tu cuenta</h1>
      <div className="mic-regla" />
      <p className="mic-bajada">
        Accedés al material completo de lo que compraste: manuales, guía de cultivo, tu
        biblioteca digital, el estado de tu envío y un asistente que ya sabe qué tenés.
      </p>
      <FormAcceso aviso={aviso} />
    </section>
  )
}
