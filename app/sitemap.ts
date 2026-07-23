import type { MetadataRoute } from 'next'
import { GUIAS_PUBLICAS } from '@/lib/guias'

// Mapa para Google y para los crawlers de IA (GEO). Solo lo público e indexable: las guías,
// el índice, el asistente y contacto. Nada del área privada (/mi-equipo, /acceso) ni del panel.
const BASE = 'https://guias.infomicelium.com.ar'

export default function sitemap(): MetadataRoute.Sitemap {
  const guias: MetadataRoute.Sitemap = GUIAS_PUBLICAS.map(g => ({
    url: `${BASE}/guia/${g.slug}`,
    lastModified: new Date(g.actualizado),
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  return [
    { url: `${BASE}/guia`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    ...guias,
    { url: `${BASE}/guia/asistente`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/contacto`, changeFrequency: 'yearly', priority: 0.4 },
  ]
}
