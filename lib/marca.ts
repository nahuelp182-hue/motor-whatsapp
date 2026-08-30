// Identidad de la instancia. El mismo repo se despliega en varios proyectos de Vercel
// (mw-micelium, osamayor, ...): el código es uno solo, lo que cambia es la marca y qué
// secciones del panel tienen sentido para esa tienda.
//
// La elección se hace con NEXT_PUBLIC_MARCA. Es `NEXT_PUBLIC_` a propósito: el nav y el
// resto de la interfaz corren en el cliente y necesitan leerla, así que tiene que quedar
// horneada en el bundle en tiempo de build. No es un secreto — es el nombre de la tienda.
//
// Ausente => 'micelium'. Micelium NO define la variable, con lo cual sigue viendo el panel
// completo exactamente como antes: agregar una instancia nueva no puede alterar la que ya
// está en producción.

export type ClaveMarca = 'micelium' | 'osamayor'

export interface Marca {
  clave: ClaveMarca
  /** Nombre visible en la barra lateral y en el <title>. */
  nombre: string
  /** Letra del cuadrito del logo. */
  inicial: string
  /** Bajada del login. */
  subtitulo: string
  /** Rutas del panel habilitadas. `null` = todas (Micelium). */
  secciones: readonly string[] | null
  /** A dónde va el login cuando no viene un `?from=`. */
  inicio: string
}

const MARCAS: Record<ClaveMarca, Marca> = {
  micelium: {
    clave: 'micelium',
    nombre: 'Micelium®',
    inicial: 'M',
    subtitulo: 'Panel de métricas',
    secciones: null,
    inicio: '/dashboard',
  },
  osamayor: {
    clave: 'osamayor',
    nombre: 'OSA MAYOR',
    inicial: 'O',
    subtitulo: 'Panel de la tienda',
    // Solo lo que aplica a esta tienda. El resto del panel (métricas de Meta Ads,
    // MercadoLibre, apicultura, conversaciones) es data de Micelium y no debe verse
    // ni llegarse escribiendo la URL: el middleware corta esas rutas con 404.
    secciones: ['/dashboard/widgets', '/dashboard/resenas'],
    inicio: '/dashboard/widgets',
  },
}

function normalizar(valor: string | undefined): ClaveMarca {
  const v = (valor ?? '').trim().toLowerCase()
  return v === 'osamayor' ? 'osamayor' : 'micelium'
}

// Next reemplaza `process.env.NEXT_PUBLIC_MARCA` literalmente en el bundle del cliente,
// así que la referencia tiene que estar escrita completa acá — no vale indexar env con
// una variable.
export const MARCA: Marca = MARCAS[normalizar(process.env.NEXT_PUBLIC_MARCA)]

/** ¿Esta instancia puede ver esta ruta del panel? */
export function seccionHabilitada(pathname: string): boolean {
  const { secciones } = MARCA
  if (secciones === null) return true
  return secciones.some(s => pathname === s || pathname.startsWith(s + '/'))
}
