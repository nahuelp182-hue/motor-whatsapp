import { getGuia, GUIAS_PUBLICAS } from '@/lib/guias'
import { OG_CONTENT_TYPE, OG_SIZE, ogImagen } from '../../_guia/og'

// Una tarjeta por guía: al compartir el link se ve el título real de esa guía, no un genérico.
// Estáticas (como las páginas): se generan en build y se sirven desde el CDN.
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'Guía de cultivo de Micelium®'

export function generateStaticParams() {
  return GUIAS_PUBLICAS.map(g => ({ slug: g.slug }))
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const g = getGuia((await params).slug)
  // Las privadas no tienen tarjeta pública: caen al genérico de marca.
  if (!g || g.privada) {
    return ogImagen({ eyebrow: 'Guías de cultivo', titulo: 'Lo esencial primero. El resto, después.' })
  }
  return ogImagen({ eyebrow: g.eyebrow, titulo: g.titulo })
}
