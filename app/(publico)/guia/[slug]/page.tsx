import { notFound } from 'next/navigation'
import { GUIAS_PUBLICAS, getGuia } from '@/lib/guias'
import { ArticuloGuia } from '../../_guia/RenderGuia'

export const revalidate = 3600

export function generateStaticParams() {
  return GUIAS_PUBLICAS.map(g => ({ slug: g.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const g = getGuia((await params).slug)
  if (!g || g.privada) return {}
  return { title: g.titulo, description: g.resumen }
}

export default async function PaginaGuia({ params }: { params: Promise<{ slug: string }> }) {
  const g = getGuia((await params).slug)
  // Las guías privadas (material de los manuales) no existen en la zona pública: viven en
  // /mi-equipo/guia/[slug], detrás de sesión de cliente.
  if (!g || g.privada) notFound()

  return <ArticuloGuia g={g} />
}
