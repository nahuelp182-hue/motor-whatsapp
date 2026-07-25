// Catálogo de Tiendanube para el panel.
//
// Existe para que elegir un producto en un widget sea un desplegable y no escribir un id a
// mano. Un id tipeado mal no falla de forma visible: el widget queda ofreciendo un producto
// que no existe y nadie se entera hasta que alguien intenta comprarlo.

const TN_TOKEN = process.env.TN_ACCESS_TOKEN ?? ''
const TN_STORE = process.env.TN_STORE_ID ?? ''
const TN_UA = 'MiceliumApp (nahuelp182@gmail.com)'

export type ProductoTN = {
  id: string
  nombre: string
  precio: number
  imagen: string | null
  /** Ruta de la ficha en el storefront, para poder acotar un widget a un producto. */
  ruta: string | null
}

type Cache = { al: number; datos: ProductoTN[] }
let cache: Cache | null = null
const VIGENCIA = 10 * 60 * 1000

function nombre(p: { name?: unknown }): string {
  const n = p.name
  if (typeof n === 'string') return n
  if (n && typeof n === 'object') {
    const v = Object.values(n as Record<string, unknown>).find(x => typeof x === 'string')
    if (typeof v === 'string') return v
  }
  return 'Sin nombre'
}

/** Productos publicados, para los desplegables del panel. Cacheado 10 minutos. */
export async function productosTN(): Promise<ProductoTN[]> {
  if (!TN_TOKEN || !TN_STORE) return []
  if (cache && Date.now() - cache.al < VIGENCIA) return cache.datos

  try {
    const r = await fetch(
      `https://api.tiendanube.com/v1/${TN_STORE}/products?published=true&per_page=200&fields=id,name,handle,variants,images`,
      { headers: { Authentication: `bearer ${TN_TOKEN}`, 'User-Agent': TN_UA } },
    )
    if (!r.ok) return cache?.datos ?? []

    const crudos = (await r.json()) as Array<{
      id: number
      name?: unknown
      handle?: unknown
      variants?: Array<{ price?: string | null }>
      images?: Array<{ src?: string }>
    }>

    const datos = crudos.map(p => ({
      id: String(p.id),
      nombre: nombre(p),
      precio: Number(p.variants?.[0]?.price ?? 0) || 0,
      imagen: p.images?.[0]?.src ?? null,
      // `handle` viene por idioma, igual que `name`: se reusa el mismo desarmador.
      ruta: (() => {
        const h = nombre({ name: p.handle })
        return h && h !== 'Sin nombre' ? `/productos/${h}` : null
      })(),
    }))

    cache = { al: Date.now(), datos }
    return datos
  } catch {
    // Si Tiendanube no responde, se sirve lo último bueno: el panel sigue usable y los
    // widgets ya guardados no se tocan.
    return cache?.datos ?? []
  }
}
