import { OG_CONTENT_TYPE, OG_SIZE, ogImagen } from './_guia/og'

// OG por defecto de toda la capa pública: la que se usa si una página no define la suya.
export const alt = 'Micelium® — Guías de cultivo'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default function Image() {
  return ogImagen({ eyebrow: 'Guías de cultivo', titulo: 'Lo esencial primero. El resto, después.' })
}
