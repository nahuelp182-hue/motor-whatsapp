// Datos comerciales leídos de Tiendanube EN VIVO.
//
// Por qué no se hardcodean: el precio se ajusta dos veces por mes (guardián de precios) y el
// stock cambia solo. Un número escrito a mano en una guía queda viejo y hace perder ventas o,
// peor, genera un reclamo. Se lee de la tienda y se cachea una hora.
const TN_STORE_ID = process.env.TN_STORE_ID ?? '1957278'
const TN_TOKEN = process.env.TN_ACCESS_TOKEN ?? ''
const UA = 'MiceliumApp (nahuelp182@gmail.com)'

/** ID del pack INC101 en Tiendanube. */
export const ID_INC101 = 105201706

export type PrecioProducto = {
  nombre: string
  lista: number | null
  promocional: number | null
  hayStock: boolean
  url: string
}

const pesos = (n: number) =>
  n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

export function formatearPesos(n: number): string {
  return pesos(n)
}

/**
 * Precio actual del producto. Devuelve null si no se puede consultar: en ese caso la página
 * muestra "mirá el precio en la tienda" en vez de un número inventado o viejo.
 */
export async function precioProducto(id = ID_INC101): Promise<PrecioProducto | null> {
  if (!TN_TOKEN) return null
  try {
    const r = await fetch(`https://api.tiendanube.com/v1/${TN_STORE_ID}/products/${id}`, {
      headers: { Authentication: `bearer ${TN_TOKEN}`, 'User-Agent': UA },
      // Se revalida con la página (ISR): no hace falta pegarle a TN en cada visita.
      next: { revalidate: 3600 },
    })
    if (!r.ok) return null
    const p = (await r.json()) as {
      name?: Record<string, string> | string
      variants?: Array<{ price?: string; promotional_price?: string | null; stock?: number | null }>
      canonical_url?: string
    }
    const v = p.variants?.[0]
    if (!v) return null
    const lista = v.price ? Number(v.price) : null
    const promo = v.promotional_price ? Number(v.promotional_price) : null
    const nombre = typeof p.name === 'string' ? p.name : (p.name?.es ?? 'Incubadora INC101')
    return {
      nombre,
      lista: Number.isFinite(lista) ? lista : null,
      promocional: Number.isFinite(promo as number) ? promo : null,
      // stock null en Tiendanube = sin control de stock (siempre disponible)
      hayStock: v.stock === null || v.stock === undefined || v.stock > 0,
      url: p.canonical_url ?? 'https://infomicelium.com.ar',
    }
  } catch {
    return null
  }
}
