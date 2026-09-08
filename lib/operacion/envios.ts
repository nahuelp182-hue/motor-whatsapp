// Logística: el estado real de cada envío y lo que se deriva de él.
//
// Dos mitades bien separadas a propósito:
//   - `refrescarEnvios()` habla con el mundo (Tiendanube y Andreani) y ESCRIBE. La llama
//     el cron; tarda segundos y consume cuota de API.
//   - `leerLogistica()` solo LEE de Postgres y no sale a internet. La llama la pantalla,
//     que por eso abre en menos de un segundo y no depende de que Andreani esté vivo.
//
// El panel nunca consulta Andreani en vivo: si lo hiciera, cada F5 dispararía 16 consultas
// y una caída de Andreani dejaría la pantalla en blanco en vez de mostrar el último dato
// bueno con su hora.

import { prisma } from '@/lib/prisma'
import { getEstadoAndreani, pareceTrackingAndreani, ORDEN_ENTREGADO, ORDEN_EN_SUCURSAL } from '@/lib/andreani'
import { PLAZO_PROMETIDO, UMBRAL_ENVIO } from '@/lib/supuestos'

const TN_TOKEN = process.env.TN_ACCESS_TOKEN
const TN_STORE = process.env.TN_STORE_ID ?? '1957278'
const TN_UA = 'Micelium/1.0 (nahuelp182@gmail.com)'

const DIA = 86_400_000

/** Días completos entre dos fechas. Null si falta alguna: un cero acá se leería como "llegó el mismo día". */
export function diasEntre(desde: Date | null, hasta: Date | null): number | null {
  if (!desde || !hasta) return null
  return Math.max(0, Math.round((hasta.getTime() - desde.getTime()) / DIA))
}

// ── Refresco ────────────────────────────────────────────────────────────────

type OrdenTNEnvio = {
  number?: number
  created_at?: string
  shipping_tracking_number?: string | null
  shipping_option?: string | null
  shipping_status?: string | null
  shipping_address?: { province?: string | null } | null
  products?: Array<{ name?: string }> | null
  customer?: { name?: string } | null
}

/**
 * Pedidos pagos de Tiendanube de los últimos `dias`. Se piden pagos y no todos porque un
 * pedido sin pagar no genera envío: contarlo como "sin despachar" sería inventar una demora
 * que no existe.
 */
async function pedidosTN(dias: number): Promise<OrdenTNEnvio[]> {
  if (!TN_TOKEN) return []
  const desde = new Date(Date.now() - dias * DIA).toISOString().slice(0, 10)
  const campos = 'number,created_at,shipping_tracking_number,shipping_option,shipping_status,shipping_address,products,customer'
  const todas: OrdenTNEnvio[] = []
  let page = 1
  while (page <= 10) { // tope de seguridad: 500 pedidos cubre de sobra una ventana de 45 días
    const url = `https://api.tiendanube.com/v1/${TN_STORE}/orders?payment_status=paid` +
      `&created_at_min=${desde}T00:00:00-03:00&per_page=50&page=${page}&fields=${campos}`
    const res = await fetch(url, { headers: { Authentication: `bearer ${TN_TOKEN}`, 'User-Agent': TN_UA } })
    if (!res.ok) break
    const data = (await res.json()) as OrdenTNEnvio[]
    if (!Array.isArray(data) || data.length === 0) break
    todas.push(...data)
    if (data.length < 50) break
    page++
    await new Promise(r => setTimeout(r, 150))
  }
  return todas
}

function estadoDesdeOrden(orden: number | null): string {
  if (orden === null) return 'sin_dato'
  if (orden >= ORDEN_ENTREGADO) return 'entregado'
  if (orden >= ORDEN_EN_SUCURSAL) return 'en_sucursal'
  return 'en_transito'
}

export type ResultadoRefresco = {
  ok: boolean
  vistos: number
  consultados: number
  errores: number
  ms: number
}

/**
 * Trae el estado real de los envíos abiertos y lo guarda.
 *
 * Solo consulta Andreani por lo que sigue abierto: un envío ya entregado no cambia, y
 * volver a pedirlo gasta cuota para confirmar lo que ya se sabe. `entregado_at` se sella
 * una sola vez — si se reescribiera en cada corrida, el histórico de días a destino se
 * iría corrigiendo solo hacia adelante y nunca se podría auditar.
 */
export async function refrescarEnvios(dias = 45): Promise<ResultadoRefresco> {
  const t0 = Date.now()
  const ahora = new Date()
  let consultados = 0
  let errores = 0

  const ordenes = await pedidosTN(dias)

  // 1. Alta/actualización de lo que Tiendanube sabe: qué se despachó y a dónde.
  const conTracking: Array<{ tracking: string; ref: string; prov: string | null; prod: string | null; cliente: string | null; despachado: Date | null }> = []
  for (const o of ordenes) {
    const tracking = (o.shipping_tracking_number ?? '').trim()
    if (!tracking) continue
    conTracking.push({
      tracking,
      ref: String(o.number ?? ''),
      prov: o.shipping_address?.province?.trim() || null,
      prod: o.products?.[0]?.name?.trim() || null,
      cliente: o.customer?.name?.trim() || null,
      // Se considera despachado si Tiendanube lo marca `shipped` O si ya tiene número de
      // seguimiento. Atarlo solo a `shipped` era un punto único de falla silencioso: si ese
      // campo no se completa (y en la operación real se completa a mano), `despachado_at`
      // quedaba null para siempre, Andreani nunca se consultaba —la consulta filtra por
      // despachado_at— y la pantalla entera se quedaba vacía sin que nada fallara.
      // Un número de seguimiento existe porque alguien despachó: es evidencia suficiente.
      //
      // Tiendanube no expone la FECHA de despacho: se usa la de la orden como piso.
      // Sobreestima el tiempo a destino (cuenta los días previos al despacho), así que el
      // número que sale es conservador — nunca hace parecer mejor de lo que fue.
      despachado: (o.shipping_status === 'shipped' || tracking) && o.created_at ? new Date(o.created_at) : null,
    })
  }

  for (const e of conTracking) {
    await prisma.envioSeguimiento.upsert({
      where: { tracking: e.tracking },
      create: {
        tracking: e.tracking,
        origen: 'tn',
        referencia: e.ref,
        cliente: e.cliente,
        producto: e.prod,
        provincia: e.prov,
        despachado_at: e.despachado,
        estado: e.despachado ? 'en_transito' : 'sin_despachar',
        visto_at: ahora,
      },
      update: {
        provincia: e.prov,
        producto: e.prod,
        despachado_at: e.despachado,
        visto_at: ahora,
      },
    })
  }

  // 2. Estado real de los que siguen abiertos, contra Andreani.
  const abiertos = await prisma.envioSeguimiento.findMany({
    where: { entregado_at: null, despachado_at: { not: null } },
    select: { tracking: true },
    take: 120, // tope: si alguna vez hay más, se procesan en la corrida siguiente
  })

  for (const { tracking } of abiertos) {
    // Lo que no es Andreani (Correo Argentino, retiro en sucursal) no se puede consultar.
    // Antes se salteaba con un `continue` y la fila quedaba "en tránsito" para siempre:
    // nunca llegaba a entregada, así que engrosaba los frenados y contaminaba el promedio.
    // Ahora se marca como lo que es, y la pantalla no la cuenta como demora.
    if (!pareceTrackingAndreani(tracking)) {
      await prisma.envioSeguimiento.update({
        where: { tracking },
        data: { estado: 'no_trackeable', visto_at: ahora },
      })
      continue
    }
    consultados++
    const est = await getEstadoAndreani(tracking)
    if (!est.ok) {
      errores++
      // Se guarda el error y NO se pisa el estado: la pantalla muestra el último dato
      // bueno con su hora, que es más útil que un "sin datos" que borra lo que se sabía.
      await prisma.envioSeguimiento.update({
        where: { tracking },
        data: { error: est.error ?? 'no se pudo leer', visto_at: ahora },
      })
      continue
    }
    const entregado = est.orden !== null && est.orden >= ORDEN_ENTREGADO
    await prisma.envioSeguimiento.update({
      where: { tracking },
      data: {
        estado: estadoDesdeOrden(est.orden),
        orden: est.orden,
        error: null,
        // Se sella una sola vez, el día que se lo ve entregado. Es una aproximación de la
        // fecha real de entrega con la precisión de la cadencia del cron, y está declarada.
        entregado_at: entregado ? ahora : null,
        visto_at: ahora,
      },
    })
    await new Promise(r => setTimeout(r, 120)) // Andreani no publica límite: se va despacio a propósito
  }

  return { ok: errores === 0, vistos: conTracking.length, consultados, errores, ms: Date.now() - t0 }
}

// ── Lectura ─────────────────────────────────────────────────────────────────

export type FilaEnvio = {
  tracking: string
  referencia: string
  origen: string
  destino: string | null
  producto: string | null
  estado: string
  dias: number | null
  accion: 'Reclamar' | 'Avisar' | 'Despachar' | null
  error: string | null
}

export type Logistica = {
  corte: string | null
  historicoDesde: string | null
  kpis: {
    frenados: number
    enTransito: number
    sinDespachar: number
    promedioDias: number | null
    entregadosMedidos: number
  }
  abiertos: FilaEnvio[]
  cumplimiento: { dentro: number; total: number; pct: number | null }
  porProvincia: Array<{ provincia: string; dias: number; entregas: number }>
  porSemana: Array<{ semana: string; dias: number; entregas: number }>
}

/**
 * Qué hacer con este envío. Sale del umbral y no del estado que informa el correo: un
 * envío de 8 días es reclamo aunque Andreani lo siga dando por "en camino".
 */
export function accionDe(estado: string, dias: number | null): FilaEnvio['accion'] {
  if (estado === 'sin_despachar') return 'Despachar'
  // De un envío que no se puede consultar no se sabe si llegó: pedir "reclamar" sobre algo
  // que quizá se entregó hace una semana es hacer perder el tiempo, y el que reclama sin
  // datos deja de mirar la columna.
  if (estado === 'no_trackeable') return null
  if (dias === null) return null
  if (dias >= UMBRAL_ENVIO.reclamo) return 'Reclamar'
  if (dias >= UMBRAL_ENVIO.alerta) return 'Avisar'
  return null
}

/**
 * Todo lo que la pantalla de Logística necesita, en una sola lectura de Postgres.
 *
 * Los agregados históricos (provincia, semana, cumplimiento) pueden venir vacíos y eso no
 * es un error: significa que todavía no hay entregas registradas desde que la tabla
 * existe. `historicoDesde` deja que la pantalla lo diga con esas palabras en vez de
 * mostrar un promedio calculado sobre dos envíos.
 */
export async function leerLogistica(dias = 21): Promise<Logistica> {
  const ahora = new Date()
  const desde = new Date(ahora.getTime() - dias * DIA)

  const [todos, primero, apicolaPendiente] = await Promise.all([
    prisma.envioSeguimiento.findMany({
      // Los abiertos también se acotan a la ventana. Sin esto, un envío por un correo que
      // no se puede consultar nunca llega a "entregado" y se queda en la lista para
      // siempre: al año la pantalla sería una pila de fantasmas tapando lo de esta semana.
      where: {
        OR: [
          { entregado_at: null, despachado_at: { gte: desde } },
          { entregado_at: null, despachado_at: null, creado_at: { gte: desde } },
          { entregado_at: { gte: desde } },
        ],
      },
      orderBy: { despachado_at: 'asc' },
    }),
    prisma.envioSeguimiento.findFirst({ orderBy: { creado_at: 'asc' }, select: { creado_at: true } }),
    // Del apícola solo se sabe si el fabricante despachó o no: el traslado lo hace
    // MercadoLibre y no tenemos su trazabilidad. Entra lo pendiente, que es accionable,
    // y no se inventa un "en tránsito" que nadie puede verificar.
    prisma.envioApicola.findMany({
      where: { despachado: false, fecha_compra: { gte: desde } },
      orderBy: { fecha_compra: 'asc' },
    }),
  ])

  const abiertosRaw = todos.filter(e => !e.entregado_at)
  const entregados = todos.filter(e => e.entregado_at && e.despachado_at)

  const abiertos: FilaEnvio[] = abiertosRaw
    .map(e => {
      const d = diasEntre(e.despachado_at, ahora)
      return {
        tracking: e.tracking,
        referencia: e.referencia,
        origen: e.origen,
        destino: e.provincia,
        producto: e.producto,
        estado: e.estado,
        dias: d,
        accion: accionDe(e.estado, d),
        error: e.error,
      }
    })
    .concat(
      apicolaPendiente.map(e => ({
        tracking: e.shipment_id,
        referencia: String(e.interno),
        origen: 'ml',
        destino: null, // ML no expone el domicilio en lo que el VPS empuja
        producto: e.items,
        estado: 'sin_despachar',
        dias: diasEntre(e.fecha_compra, ahora),
        accion: 'Despachar' as const,
        error: null,
      })),
    )
    // Por días en tránsito y no por fecha de despacho: el que más lleva esperando es el
    // que está más cerca de convertirse en reclamo.
    .sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1))

  const duraciones = entregados
    .map(e => diasEntre(e.despachado_at, e.entregado_at))
    .filter((d): d is number => d !== null)

  const promedio = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

  // Cumplimiento: dentro de la ventana prometida, no "menos de X". Una entrega en 1 día
  // tampoco es lo prometido, pero no se cuenta como incumplimiento: nadie reclama por eso.
  const dentro = duraciones.filter(d => d <= PLAZO_PROMETIDO.max).length

  const porProvinciaMapa = new Map<string, number[]>()
  for (const e of entregados) {
    const d = diasEntre(e.despachado_at, e.entregado_at)
    if (d === null || !e.provincia) continue
    const xs = porProvinciaMapa.get(e.provincia) ?? []
    xs.push(d)
    porProvinciaMapa.set(e.provincia, xs)
  }

  const porSemanaMapa = new Map<string, number[]>()
  for (const e of entregados) {
    const d = diasEntre(e.despachado_at, e.entregado_at)
    if (d === null || !e.entregado_at) continue
    const lunes = new Date(e.entregado_at)
    lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7)) // semana ISO: arranca el lunes
    const clave = lunes.toISOString().slice(0, 10)
    const xs = porSemanaMapa.get(clave) ?? []
    xs.push(d)
    porSemanaMapa.set(clave, xs)
  }

  return {
    corte: todos.length ? new Date(Math.max(...todos.map(e => e.visto_at.getTime()))).toISOString() : null,
    historicoDesde: primero?.creado_at.toISOString() ?? null,
    kpis: {
      // Frenado = despachado, en manos del correo y sin llegar. Un pedido que todavía no
      // salió no está frenado: está sin despachar, que se arregla de otra forma y se cuenta
      // aparte. Mezclarlos hacía que el KPI dijera "reclamar a Andreani" por algo que ni se
      // le entregó. Los no trackeables tampoco entran: no se sabe si llegaron.
      frenados: abiertos.filter(
        e => e.dias !== null && e.dias >= UMBRAL_ENVIO.reclamo
          && e.estado !== 'sin_despachar' && e.estado !== 'no_trackeable',
      ).length,
      enTransito: abiertosRaw.filter(e => e.estado === 'en_transito' || e.estado === 'en_sucursal').length,
      // Sobre `abiertos` y no sobre `abiertosRaw`: los apícolas pendientes también están
      // pagados y sin despachar, y son la mitad del problema que este número tiene que mostrar.
      sinDespachar: abiertos.filter(e => e.estado === 'sin_despachar').length,
      promedioDias: promedio(duraciones),
      entregadosMedidos: duraciones.length,
    },
    abiertos,
    cumplimiento: {
      dentro,
      total: duraciones.length,
      pct: duraciones.length ? (dentro / duraciones.length) * 100 : null,
    },
    porProvincia: [...porProvinciaMapa.entries()]
      .map(([provincia, xs]) => ({ provincia, dias: promedio(xs)!, entregas: xs.length }))
      .sort((a, b) => b.dias - a.dias),
    porSemana: [...porSemanaMapa.entries()]
      .map(([semana, xs]) => ({ semana, dias: promedio(xs)!, entregas: xs.length }))
      .sort((a, b) => a.semana.localeCompare(b.semana))
      .slice(-4),
  }
}
