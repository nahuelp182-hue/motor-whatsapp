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

// `ebook` no es un equipo, pero entra por la misma puerta: quien compró solo material
// digital también es cliente y también tiene un lugar a dónde volver. Antes caía en `otro`
// y el portal le mostraba el manual de una incubadora que nunca compró.
export type EquipoId = 'inc101' | 'pc400' | 'ebook' | 'otro'

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

export function equiposDe(prods: Array<{ name?: unknown }>): EquipoId[] {
  const set = new Set<EquipoId>()
  for (const p of prods) {
    const n = String(p?.name ?? '').toLowerCase()
    // El orden importa: "ebook incubadora" es material digital, no un equipo. Lo digital se
    // evalúa primero para que un título que nombra al equipo no lo clasifique como hardware.
    if (/ebook|e-book|libro|guía digital|guia digital|pdf|descargable/.test(n)) set.add('ebook')
    else if (/inc101|incubadora/.test(n)) set.add('inc101')
    else if (/pc400|pc300|pc101|tableta|manta/.test(n)) set.add('pc400')
    else set.add('otro')
  }
  return [...set]
}

/** ¿Compró algún equipo físico? Define qué cara del portal ve. */
export function tieneHardware(equipos: string[]): boolean {
  return equipos.some(e => e === 'inc101' || e === 'pc400' || e === 'otro')
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

/**
 * Busca la compra más reciente asociada a un email. Es la puerta de menor fricción: el
 * cliente no tiene que buscar el número de pedido en un mail viejo, solo escribir su
 * dirección. Como el acceso se entrega POR ESE MISMO EMAIL, saber que existe no habilita
 * nada: hay que tener la casilla.
 *
 * Devuelve la última compra pagada, que es la que corresponde mostrar.
 */
export async function buscarPorEmail(email: string): Promise<ClienteVerificado | null> {
  const limpio = (email || '').trim().toLowerCase()
  if (!TN_TOKEN || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(limpio)) return null

  try {
    const campos = 'number,status,payment_status,contact_name,products,paid_at'
    const res = await fetch(
      `${TN_BASE}/${TN_STORE_ID}/orders?status=any&per_page=50&q=${encodeURIComponent(limpio)}&fields=${campos}`,
      { headers: { Authentication: `bearer ${TN_TOKEN}`, 'User-Agent': UA } },
    )
    if (!res.ok) return null
    const ordenes = (await res.json()) as Array<OrdenTN & { paid_at?: string }>
    if (!Array.isArray(ordenes)) return null

    // La búsqueda `q` de Tiendanube es amplia (matchea parcial en varios campos), así que
    // el resultado se filtra a órdenes pagadas y se toma la más reciente.
    const validas = ordenes
      .filter(o => o.status !== 'cancelled' && o.payment_status === 'paid')
      .sort((a, b) => new Date(b.paid_at ?? 0).getTime() - new Date(a.paid_at ?? 0).getTime())

    const o = validas[0]
    if (!o) return null

    return {
      numero: o.number,
      nombre: nombreDePila(o.contact_name ?? ''),
      equipos: equiposDe(o.products ?? []),
    }
  } catch {
    return null
  }
}

/** Una compra vista por el cron de acompañamiento: lo mínimo para decidir qué mail toca. */
export type CompraSeguimiento = {
  numero: number
  nombre: string
  email: string
  equipos: EquipoId[]
  /** Fecha desde la que se cuenta el ciclo: la entrega si la hay, si no el pago. */
  referencia: Date
  entregado: boolean
}

/**
 * Órdenes pagadas de los últimos ~70 días, con lo necesario para el acompañamiento del
 * cultivo. 70 días cubre el ciclo completo (entrega + 50 días de cultivo) con margen.
 */
export async function comprasParaSeguimiento(): Promise<CompraSeguimiento[]> {
  if (!TN_TOKEN) return []
  const desde = new Date(Date.now() - 70 * 86_400_000).toISOString()

  try {
    const campos =
      'number,status,payment_status,contact_name,contact_email,products,paid_at,shipping_status,shipped_at,updated_at'
    const res = await fetch(
      `${TN_BASE}/${TN_STORE_ID}/orders?status=any&payment_status=paid&created_at_min=${desde}&per_page=200&fields=${campos}`,
      { headers: { Authentication: `bearer ${TN_TOKEN}`, 'User-Agent': UA } },
    )
    if (!res.ok) return []
    const ordenes = (await res.json()) as Array<
      OrdenTN & {
        contact_email?: string
        paid_at?: string
        shipped_at?: string
        updated_at?: string
        shipping_status?: string
      }
    >
    if (!Array.isArray(ordenes)) return []

    const out: CompraSeguimiento[] = []
    for (const o of ordenes) {
      if (o.status === 'cancelled' || o.payment_status !== 'paid') continue
      const email = String(o.contact_email ?? '').trim()
      if (!email) continue

      const entregado = o.shipping_status === 'delivered'
      // El material digital no se despacha: el ciclo arranca con el pago.
      const equipos = equiposDe(o.products ?? [])
      const base = entregado
        ? (o.shipped_at ?? o.updated_at ?? o.paid_at)
        : o.paid_at
      if (!base) continue

      out.push({
        numero: o.number,
        nombre: nombreDePila(o.contact_name ?? ''),
        email,
        equipos,
        referencia: new Date(base),
        entregado,
      })
    }
    return out
  } catch {
    return []
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
