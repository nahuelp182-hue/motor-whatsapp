import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getGuia } from '@/lib/guias'
import { COOKIE_CLIENTE_NOMBRE, verificarSesionCliente } from '@/lib/session'
import { ArticuloGuia } from '../../../_guia/RenderGuia'

// Material de los manuales: solo para clientes verificados. Nunca estático, nunca indexado.
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const g = getGuia((await params).slug)
  if (!g) return {}
  return { title: g.titulo, robots: { index: false, follow: false } }
}

export default async function GuiaPrivada({ params }: { params: Promise<{ slug: string }> }) {
  const g = getGuia((await params).slug)
  if (!g) notFound()

  // Defensa en profundidad: el middleware ya cubre /mi-equipo/*, pero la página revalida.
  const jar = await cookies()
  const secreto = process.env.DASHBOARD_PASSWORD ?? ''
  const ses = await verificarSesionCliente(jar.get(COOKIE_CLIENTE_NOMBRE)?.value, secreto)
  if (!ses) redirect('/acceso')

  return (
    <>
      <p style={{ paddingTop: '2rem', margin: 0 }}>
        <Link href="/mi-equipo" className="mic-msg-guia">
          ← Volver a mi equipo
        </Link>
      </p>
      <ArticuloGuia g={g} base="/mi-equipo/guia" />
    </>
  )
}
