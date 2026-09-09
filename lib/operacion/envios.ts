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
import { PISO_ABIERTOS_DIAS } from '@/lib/operacion/rango'
import { getEstadoAndreani, pareceTrackingAndreani, ORDEN_ENTREGADO, ORDEN_EN_SUCURSAL } from '@/lib/andreani'
import { PLAZO_PROMETIDO, UMBRAL_ENVIO, PLAZO_MANUAL_DIAS } from '@/lib/supuestos'

const TN_TOKEN = process.env.TN_ACCESS_TOKEN
const TN_STORE = process.env.TN_STORE_ID ?? '1957278'
const TN_UA = 'Micelium/1.0 (nahuelp182@gmail.com)'

const DIA = 86_400_000

/** Días completos entre dos fechas. Null si falta alguna: un cero acá se leería como "llegó el mismo día". */
/**
 * Fecha de Andreani a Date. Vienen sin zona ("2026-08-06T16:03:33") y son hora argentina:
 * interpretarlas como UTC correría todo tres horas, que en un promedio de días no se nota
 * pero sí puede mover un envío de un día al anterior.
 */
export function fechaAndreani(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(/[Zz]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s}-03:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

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

    // Las fechas salen del timeline de Andreani, no del reloj de esta corrida.
    //
    // `ahora` como fecha de entrega solo es válido si el cron viene corriendo desde antes de
    // que el paquete llegara. En un backfill es directamente falso: el 08/09/2026 los 28
    // envíos ya entregados quedaron sellados con el mismo milisegundo, y el promedio a
    // destino saltó a 26,8 días midiendo "hace cuánto se despachó". Andreani informa la
    // fecha real; solo había que leerla.
    //
    // Se cae a `ahora` únicamente si Andreani no la trae: ahí sigue siendo la mejor
    // aproximación disponible, con la precisión de la cadencia del cron.
    const fechaEntrega = entregado ? (fechaAndreani(est.fechaUltimoEvento) ?? ahora) : null
    const fechaIngreso = fechaAndreani(est.fechaIngreso)
    await prisma.envioSeguimiento.update({
      where: { tracking },
      data: {
        estado: estadoDesdeOrden(est.orden),
        orden: est.orden,
        error: null,
        // Se sella una sola vez, el día que se lo ve entregado. Es una aproximación de la
        // fecha real de entrega con la precisión de la cadencia del cron, y está declarada.
        entregado_at: fechaEntrega,
        // Solo se escribe si Andreani la trajo: un null pisaría una fecha buena leída antes.
        ...(fechaIngreso ? { ingresado_at: fechaIngreso } : {}),
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
  /**
   * Si al comprador le llegó el material post-venta, y desde cuándo.
   *
   *   ok         — hay acuse de envío del manual (`enviado_at`)
   *   pendiente  — todavía no, pero es temprano: el manual sale con el despacho + 24 h
   *   faltante   — pasó el plazo y sigue sin acuse. Este es el que hay que mirar.
   *   sin_material — el producto no tiene manual escrito (HALO). No es una falla del envío:
   *                  es contenido que falta producir, y se marca aparte para que no se
   *                  cuente como incumplimiento ni desaparezca en un "ok".
   *   na         — el envío es apícola (MercadoLibre): no lleva material propio.
   */
  manual: EstadoManual
  /** Cuándo se mandó el manual. Null si todavía no. */
  manualAt: string | null
}

export type EstadoManual = 'ok' | 'pendiente' | 'faltante' | 'sin_material' | 'na'

/**
 * Qué productos llevan manual, mirados por su NOMBRE.
 *
 * El panel no guarda el SKU del pedido — `EnvioSeguimiento.producto` es el nombre del primer
 * producto de la orden — así que la clasificación se hace por nombre. Es un espejo del dict
 * `MANUALES` de `envio_manuales_sku.py` (VPS), que es quien decide de verdad.
 *
 * Tener el criterio duplicado es deuda conocida y acotada: mientras el panel no reciba el
 * SKU, la alternativa es peor. Lo que NO se puede hacer es dejarlo implícito — si el panel
 * no supiera qué lleva manual, marcaría "faltante" todo accesorio suelto (Booster, Kit de
 * Recipientes) para siempre, y un indicador que grita sin motivo se deja de mirar.
 *
 * Al agregar un producto con manual al VPS, sumarlo también acá.
 *
 * Límite conocido: `producto` es el PRIMER ítem de la orden, así que un pedido de
 * "Kit de Recipientes + INC101" se clasifica por el kit y cae en `na` hasta que llega el
 * acuse (ahí pasa a `ok`). Falla hacia el lado seguro — deja de reportar algo que sí tiene
 * manual, en vez de inventar un faltante — pero significa que un equipo comprado junto a un
 * accesorio no está cubierto por el control. Se arregla el día que el push mande el SKU.
 */
const PRODUCTOS_CON_MANUAL = [/inc101|incubadora/i, /pc400|tableta/i]

/**
 * Productos de hardware que todavía no tienen material escrito. Espejo de
 * `SKU_SIN_MATERIAL` (VPS). Se muestran aparte y no como faltante: se arreglan escribiendo
 * el manual, no reenviando un mail.
 */
const PRODUCTOS_SIN_MATERIAL = [/halo/i]


export type Logistica = {
  corte: string | null
  historicoDesde: string | null
  kpis: {
    frenados: number
    enTransito: number
    sinDespachar: number
    /** Compra a entrega, punta a punta. Es lo que vive el cliente. */
    promedioDias: number | null
    /**
     * Las dos mitades del total, que se arreglan de forma distinta y por eso van separadas:
     * `promedioDespacho` es de la compra al ingreso a Andreani (armado y despacho, manda
     * Micelium) y `promedioCorreo` del ingreso a la entrega (manda el correo). Un promedio
     * total alto sin este corte no dice a quién reclamarle.
     */
    promedioDespacho: number | null
    promedioCorreo: number | null
    entregadosMedidos: number
    /**
     * Compradores despachados hace más de `PLAZO_MANUAL_DIAS` y sin acuse de manual.
     *
     * Es el control de que nadie se quede sin material: mientras sea 0, todo comprador con
     * manual disponible lo recibió. No incluye los `sin_material` (HALO), que se cuentan
     * aparte porque se arreglan produciendo contenido, no reenviando un mail.
     */
    sinManual: number
    /** Despachados cuyo producto todavía no tiene manual escrito. */
    sinMaterial: number
  }
  abiertos: FilaEnvio[]
  /**
   * Los compradores sin manual, incluidos los YA ENTREGADOS.
   *
   * Va aparte de `abiertos` a propósito: un envío entregado sale de la cola de logística,
   * pero si nunca recibió el manual el problema sigue vivo — es justamente el caso que se
   * escapó (el paquete llegó, el material no). Si esta lista viviera dentro de `abiertos`,
   * cerrarse el envío borraría la evidencia.
   */
  sinManual: FilaEnvio[]
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
 * En qué estado está el material post-venta de un envío.
 *
 * Se deriva del acuse real y del reloj: no hay ninguna lista de pendientes que alguien tenga
 * que mantener, porque una lista así se desactualiza en silencio y vuelve a dejar
 * compradores afuera — que es exactamente el problema que este indicador existe para evitar.
 */
export function estadoManual(
  origen: string,
  producto: string | null,
  despachadoAt: Date | null,
  enviadoAt: Date | null,
  ahora: Date,
): EstadoManual {
  // Los apícolas los despacha el fabricante y no llevan material propio: marcarlos
  // "faltante" sería inventar una deuda que no existe y tapar los casos reales.
  if (origen !== 'tn') return 'na'
  if (enviadoAt) return 'ok'
  if (producto && PRODUCTOS_SIN_MATERIAL.some(re => re.test(producto))) return 'sin_material'
  // Un accesorio suelto (Booster, Kit de Recipientes) no lleva manual propio: el material va
  // con el equipo. Sin este corte, cada accesorio vendido solo quedaría "faltante" para
  // siempre — falso positivo permanente, que es la forma más rápida de que el indicador
  // deje de mirarse. Un producto desconocido cae acá y NO se reporta: el panel avisa de lo
  // que sabe que falla, no de lo que no conoce.
  if (!producto || !PRODUCTOS_CON_MANUAL.some(re => re.test(producto))) return 'na'
  // Sin despacho todavía no corresponde: el manual sale con el envío. El caso de retiro en
  // punto (que nunca marca despacho) lo rescata el script del VPS a los 3 días del pago;
  // acá se ve igual, porque al llegar el acuse pasa a `ok` sin haber pasado por despacho.
  const dias = diasEntre(despachadoAt, ahora)
  if (dias === null || dias < PLAZO_MANUAL_DIAS) return 'pendiente'
  return 'faltante'
}

/**
 * Todo lo que la pantalla de Logística necesita, en una sola lectura de Postgres.
 *
 * Los agregados históricos (provincia, semana, cumplimiento) pueden venir vacíos y eso no
 * es un error: significa que todavía no hay entregas registradas desde que la tabla
 * existe. `historicoDesde` deja que la pantalla lo diga con esas palabras en vez de
 * mostrar un promedio calculado sobre dos envíos.
 */
export async function leerLogistica(dias = PISO_ABIERTOS_DIAS, hasta?: Date): Promise<Logistica> {
  const ahora = new Date()
  // `hasta` es el tope superior del rango manual. Sin él, un rango que terminaba en el
  // pasado (ej. "01/07 al 31/07") calculaba igual `desde = ahora - dias` y traía entregas
  // hasta HOY: el filtro cambiaba el ancho de la ventana pero no dónde termina, así que
  // elegir fechas manuales no movía un solo número en pantalla.
  const techo = hasta ?? ahora
  // Dos ventanas: el histórico usa la del filtro; los abiertos, la más ancha de las dos.
  // Acotar los abiertos sigue siendo necesario (un envío que nunca llega a "entregado" se
  // quedaría en la lista para siempre y al año la pantalla sería una pila de fantasmas),
  // pero el piso garantiza que achicar el filtro no oculte nada accionable.
  const desde = new Date(techo.getTime() - dias * DIA)
  const desdeAbiertos = new Date(ahora.getTime() - Math.max(dias, PISO_ABIERTOS_DIAS) * DIA)

  const [todos, primero, apicolaPendiente, manuales] = await Promise.all([
    prisma.envioSeguimiento.findMany({
      where: {
        OR: [
          { entregado_at: null, despachado_at: { gte: desdeAbiertos } },
          { entregado_at: null, despachado_at: null, creado_at: { gte: desdeAbiertos } },
          // Los entregados sí usan la ventana del filtro: son historia, y es exactamente lo
          // que el rango tiene que poder recortar. El techo evita que un rango manual del
          // pasado siga trayendo entregas de después de `hasta`.
          { entregado_at: { gte: desde, lte: techo } },
        ],
      },
      orderBy: { despachado_at: 'asc' },
    }),
    prisma.envioSeguimiento.findFirst({ orderBy: { creado_at: 'asc' }, select: { creado_at: true } }),
    // Del apícola solo se sabe si el fabricante despachó o no: el traslado lo hace
    // MercadoLibre y no tenemos su trazabilidad. Entra lo pendiente, que es accionable,
    // y no se inventa un "en tránsito" que nadie puede verificar.
    prisma.envioApicola.findMany({
      // Pendientes de despacho: también son cola de trabajo, así que van con el piso.
      where: { despachado: false, fecha_compra: { gte: desdeAbiertos } },
      orderBy: { fecha_compra: 'asc' },
    }),
    // Todos los acuses de manual, sin ventana: la tabla es chica (una fila por pedido) y
    // recortarla por fecha haría que un envío viejo pareciera "sin manual" solo porque su
    // acuse quedó fuera del rango. El filtro recorta qué envíos se miran, nunca la evidencia
    // de que el manual se mandó.
    prisma.entregaManual.findMany({ select: { referencia: true, enviado_at: true } }),
  ])

  // Un pedido puede tener dos equipos y por lo tanto dos acuses: vale el primero, que es
  // cuando el comprador efectivamente recibió material.
  const manualPorRef = new Map<string, Date>()
  for (const m of manuales) {
    const previo = manualPorRef.get(m.referencia)
    if (!previo || m.enviado_at < previo) manualPorRef.set(m.referencia, m.enviado_at)
  }

  const abiertosRaw = todos.filter(e => !e.entregado_at)
  const entregados = todos.filter(e => e.entregado_at && e.despachado_at)

  const abiertos: FilaEnvio[] = abiertosRaw
    .map(e => {
      const d = diasEntre(e.despachado_at, ahora)
      const manualAt = manualPorRef.get(e.referencia) ?? null
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
        manual: estadoManual(e.origen, e.producto, e.despachado_at, manualAt, ahora),
        manualAt: manualAt?.toISOString() ?? null,
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
        manual: 'na' as const,
        manualAt: null,
      })),
    )
    // Por días en tránsito y no por fecha de despacho: el que más lleva esperando es el
    // que está más cerca de convertirse en reclamo.
    .sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1))

  // Cobertura de manual sobre TODOS los envíos propios de la ventana, entregados incluidos.
  // Se recorre `todos` y no `abiertos` porque el caso que motivó el indicador es justamente
  // el que ya se cerró: el paquete llegó y el material nunca salió, así que mirar solo la
  // cola de abiertos lo dejaría fuera otra vez.
  const filasManual: FilaEnvio[] = todos
    .filter(e => e.origen === 'tn')
    .map(e => {
      const manualAt = manualPorRef.get(e.referencia) ?? null
      // Para un envío ya entregado el reloj se corta en la entrega, no en `ahora`: lo que se
      // evalúa es si el manual salió a tiempo, no cuánto hace que existe el pedido.
      const manual = estadoManual(e.origen, e.producto, e.despachado_at, manualAt, ahora)
      return {
        tracking: e.tracking,
        referencia: e.referencia,
        origen: e.origen,
        destino: e.provincia,
        producto: e.producto,
        estado: e.entregado_at ? 'entregado' : e.estado,
        dias: diasEntre(e.despachado_at, e.entregado_at ?? ahora),
        accion: null,
        error: e.error,
        manual,
        manualAt: manualAt?.toISOString() ?? null,
      }
    })

  // Solo lo accionable: `faltante` se arregla reenviando el mail, `sin_material` produciendo
  // el contenido. Los dos van a la lista porque los dos dejan a un comprador sin nada, pero
  // el KPI los cuenta separados para no mezclar dos trabajos distintos.
  const sinManualFilas = filasManual
    .filter(e => e.manual === 'faltante' || e.manual === 'sin_material')
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
      promedioDespacho: promedio(
        entregados.map(e => diasEntre(e.despachado_at, e.ingresado_at)).filter((d): d is number => d !== null),
      ),
      promedioCorreo: promedio(
        entregados.map(e => diasEntre(e.ingresado_at, e.entregado_at)).filter((d): d is number => d !== null),
      ),
      entregadosMedidos: duraciones.length,
      sinManual: sinManualFilas.filter(e => e.manual === 'faltante').length,
      sinMaterial: sinManualFilas.filter(e => e.manual === 'sin_material').length,
    },
    abiertos,
    sinManual: sinManualFilas,
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
