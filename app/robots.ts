import type { MetadataRoute } from 'next'

// Lo público se rastrea; el panel, las APIs y el área de cliente no. El área de cliente ya sale
// `noindex` desde su metadata — esto lo refuerza en el rastreo, no solo en la indexación.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/mi-equipo', '/acceso', '/e/', '/api/', '/dashboard', '/login'],
    },
    sitemap: 'https://guias.infomicelium.com.ar/sitemap.xml',
    host: 'https://guias.infomicelium.com.ar',
  }
}
