// Verificación de acceso al área privada del cliente.
//
// El cliente entra con su NÚMERO DE PEDIDO + un segundo factor (los últimos 4 dígitos de su
// teléfono, o su DNI). Reglas de seguridad, todas deliberadas:
//
//  - Nunca se revela si un número de pedido existe: el mismo resultado para "no existe" y
//    para "existe pero el factor no coincide". Así no se puede enumerar pedidos.
//  - El segundo factor es obligatorio: el número de pedido solo no alcanza (son cortos y
//    secuenciales, se adivinan).
//  - Se devuelve el MÍNIMO de datos necesarios (nombre de pila, qué equipo, nº). No teléfono,
//    no DNI, no dirección: esos no se persisten en ningún lado.
//  - El estado de envío se consulta aparte y en vivo; si Tiendanube cae, el resto del área
//    privada sigue funcionando con lo que quedó firmado en la cookie.
const TN_STORE_ID = process.env.TN_STORE_ID ?? '1957278'
const TN_TOKEN = process.env.TN_ACCESS_TOKEN ?? ''
const TN_BASE = 'https://api.tiendanube.com/v1'
const UA = 'MiceliumApp (nahuelp182@gmail.com)'

export type EquipoId = 'inc101' | 'pc400' | 'otro'

/** Lo que se guarda, firmado, en la cookie de cliente. Mínimo indispensable. */
export type ClienteVerificado = {
  numero: number
  nombre: string // solo nombre de pila
  equipos: EquipoId[]
}

const soloDigitos = (s: string): string => (s || '').replace(/\D/g, '')

function nombreDePila(completo: string): string {
  const p = (completo || '').trim().split(/\s+/)[0] ?? ''
  return p.slice(0, 40)
}

function equiposDe(prods: Array<{ name?: unknown }>): EquipoId[] {
  const set = new Set<EquipoId>()
  for (const p of prods) {
    const n = String(p?.name ?? '').toLowerCase()
    if (/inc101|incubadora/.test(n)) set.add('inc101')
    else if (/pc400|pc300|pc101|tableta|manta/.test(n)) set.add('pc400')
    else set.add('otro')
  }
  return [...set]
}

type OrdenTN = {
  number: number
  status?: string
  payment_status?: string
  contact_phone?: string
  contact_identification?: string
  contact_name?: string
  products?: Array<{ name?: unknown }>
}

/** ¿El segundo factor coincide con esta orden? Acepta últimos 4 del teléfono o el DNI. */
function factorCoincide(o: OrdenTN, factor: string): boolean {
  const f = soloDigitos(factor)
  if (f.length < 4) return false
  const tel = soloDigitos(o.contact_phone ?? '')
  const dni = soloDigitos(o.contact_identification ?? '')
  if (tel.length >= 4 && tel.slice(-4) === f.slice(-4)) return true
  if (dni && (dni === f || dni.slice(-4) === f.slice(-4))) return true
  return false
}

/**
 * Devuelve los datos del cliente si el pedido existe, está pagado y el factor coincide.
 * En cualquier otro caso devuelve null — sin distinguir el motivo hacia afuera.
 */
export async function verificarAcceso(
  nroOrden: string,
  factor: string,
): Promise<ClienteVerificado | null> {
  const num = Number(soloDigitos(nroOrden))
  if (!TN_TOKEN || !Number.isFinite(num) || num <= 0) return null

  try {
    const campos = 'number,status,payment_status,contact_phone,contact_identification,contact_name,products'
    const res = await fetch(
      `${TN_BASE}/${TN_STORE_ID}/orders?status=any&per_page=5&q=${num}&fields=${campos}`,
      { headers: { Authentication: `bearer ${TN_TOKEN}`, 'User-Agent': UA } },
    )
    if (!res.ok) return null
    const ordenes = (await res.json()) as OrdenTN[]
    const o = Array.isArray(ordenes) ? ordenes.find(x => Number(x.number) === num) : undefined
    if (!o) return null
    if (o.status === 'cancelled') return null
    if (o.payment_status !== 'paid') return null // pendiente de pago: aún no hay nada que mostrar
    if (!factorCoincide(o, factor)) return null

    return {
      numero: o.number,
      nombre: nombreDePila(o.contact_name ?? ''),
      equipos: equiposDe(o.products ?? []),
    }
  } catch {
    return null
  }
}

export type EstadoEnvio = {
  tracking: string | null
  correo: string | null
  esAndreani: boolean
  despachado: boolean
  pickup: boolean
}

/** Estado de envío en vivo. Se llama aparte: si falla, el área privada se degrada, no se cae. */
export async function estadoEnvio(numero: number): Promise<EstadoEnvio | null> {
  if (!TN_TOKEN) return null
  try {
    const campos = 'number,shipping_tracking_number,shipping_option,shipping_pickup_type,shipping_status'
    const res = await fetch(
      `${TN_BASE}/${TN_STORE_ID}/orders?status=any&per_page=5&q=${numero}&fields=${campos}`,
      { headers: { Authentication: `bearer ${TN_TOKEN}`, 'User-Agent': UA } },
    )
    if (!res.ok) return null
    const ordenes = (await res.json()) as Array<
      OrdenTN & { shipping_tracking_number?: string; shipping_option?: string; shipping_pickup_type?: string; shipping_status?: string }
    >
    const o = Array.isArray(ordenes) ? ordenes.find(x => Number(x.number) === numero) : undefined
    if (!o) return null
    const correo = o.shipping_option ?? ''
    return {
      tracking: o.shipping_tracking_number || null,
      correo: correo || null,
      esAndreani: /andreani/i.test(correo),
      despachado: o.shipping_status === 'shipped',
      pickup: o.shipping_pickup_type === 'pickup',
    }
  } catch {
    return null
  }
}
