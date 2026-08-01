// Latido de automatizaciones — la mitad barata del arreglo al agujero de "algo dejó de
// correr y nada lo nota". La otra mitad, el aviso, sale del cron resumen-bot.
//
// HISTORIA CORTA, PORQUE EXPLICA EL DISEÑO
//
// La primera versión guardaba una fila por job (upsert sobre `CronHeartbeat`) y respondía
// una sola pregunta: ¿corrió? El 31/07/2026 se descubrió que la tabla estaba vacía desde
// que se creó: el código que la escribía nunca se había desplegado, y el único proceso que
// podía avisarlo —resumen-bot— era uno de los crons que no corría. Un vigilante que
// depende de lo que vigila no vigila nada.
//
// De ahí las dos decisiones de esta versión:
//
//  1. `JobRun` es APPEND-ONLY. Con una fila por job no se puede saber si algo falla siempre
//     o falló una vez, desde cuándo, ni si está tardando más que antes. El upsert pisa la
//     evidencia justo cuando hace falta.
//  2. El estado se DERIVA de la cadencia declarada en CATALOGO, no de un campo guardado. Un
//     job que dejó de dispararse no escribe nada — y algo que no escribe nunca se puede
//     marcar a sí mismo como caído. La ausencia tiene que ser la señal.
import { prisma } from '@/lib/prisma'

export type Origen = 'vercel' | 'vps' | 'github' | 'windows'
export type Estado = 'ok' | 'atrasado' | 'falla' | 'nunca'

/**
 * Códigos del Programador de tareas de Windows que NO son el resultado de un trabajo
 * terminado. Vienen con signo, como los guarda `JobRun.exit_code`.
 *
 * No llegó a arrancar:
 *   -2147020576 (0x800710E0) el operador rechazó la solicitud: PC suspendida o a batería
 *        267011 (0x00041303) la tarea nunca corrió
 *        267045 (0x00041325) la tarea está en cola, todavía no arrancó
 * Arrancó pero todavía no terminó:
 *        267009 (0x00041301) la tarea se está ejecutando en este momento
 *
 * Una corrida así NO SE GUARDA, y los dos motivos son la misma idea vista de los dos lados.
 *
 * Guardarla como ÉXITO fue el primer agujero: el estado se deriva de la frescura del
 * último `JobRun`, y el Programador actualiza LastRunTime aunque la tarea no haya
 * arrancado, así que cada intento fallido le renovaba el reloj a un job que no hizo nada.
 * Una tarea cuya PC duerme siempre a su hora quedaba en verde para siempre, sin poder
 * llegar nunca a 'atrasado' (31/07/2026, micelium_ig_reels_semanal: 5 días parado, panel
 * en verde).
 *
 * Guardarla como FALLA es el agujero espejo: 0x00041301 solo dice que el muestreo cayó en
 * el medio de la corrida, no que algo saliera mal. El resultado se sabrá en la pasada
 * siguiente. Pintarlo de rojo condena al propio heartbeat, que se muestrea a sí mismo
 * mientras corre y por lo tanto reporta 0x00041301 SIEMPRE.
 *
 * Las dos veces el arreglo es el mismo, y es el principio del encabezado de este archivo:
 * si no hay resultado, no hay nada que decir, y la ausencia es la señal. El margen ancho
 * del catálogo hace el resto. `heartbeat_tareas.ps1` ya se calla del otro lado; esto es la
 * red de abajo, para que ningún reportero futuro pueda reabrirlo.
 *
 * No hay riesgo de colisión con un exit code real: en POSIX van de 0 a 255.
 */
export const CODIGOS_SIN_RESULTADO = [-2147020576, 267011, 267045, 267009] as const

/** ¿Este código es algo distinto del resultado de un trabajo terminado? */
export function sinResultado(exitCode: number | undefined | null): boolean {
  if (exitCode === undefined || exitCode === null) return false
  return (CODIGOS_SIN_RESULTADO as readonly number[]).includes(exitCode)
}

export type EntradaCatalogo = {
  origen: Origen
  /** Antigüedad máxima tolerada antes de considerarlo caído. */
  maxHoras: number
  /** Reseña de qué hace, en pocas palabras. Es lo que se lee en el panel. */
  que: string
}

/**
 * Catálogo de automatizaciones vigiladas.
 *
 * `maxHoras` no es la cadencia: es la cadencia MÁS un margen. Un job cada 30 min con
 * tolerancia de 30 min daría falsa alarma ante cualquier demora; con 2 h avisa recién
 * cuando perdió cuatro corridas seguidas, que ya no es ruido.
 *
 * Los jobs a demanda (andreani, instalar-widgets-tn) quedan afuera a propósito: no tienen
 * cadencia, así que su ausencia no significa nada.
 */
export const CATALOGO: Record<string, EntradaCatalogo> = {
  // ── Rutas de la app, disparadas por curl desde el cron del VPS ──────────────────────
  'carrito-abandonado': {
    origen: 'vps', maxHoras: 2,
    que: 'Detecta carritos abandonados con teléfono y encola el mensaje',
  },
  'resena-post-entrega': {
    origen: 'vps', maxHoras: 2,
    que: 'Pide la reseña cuando el pedido figura entregado',
  },
  'send-pending': {
    origen: 'vps', maxHoras: 2,
    que: 'Drena la cola de mensajes salientes del recupero de carrito',
  },
  radar: {
    origen: 'vps', maxHoras: 26,
    que: 'Mina sugerencias de tendencias; avisa solo si hay algo emergente',
  },
  'sync-calendario': {
    origen: 'vps', maxHoras: 26,
    que: 'Espeja las fechas comerciales al calendario Google "Ecommerce"',
  },
  'ciclo-cultivo': {
    origen: 'vps', maxHoras: 26,
    que: 'Acompaña por mail el ciclo de cultivo del cliente, día por día',
  },
  'resumen-bot': {
    origen: 'github', maxHoras: 26,
    que: 'Resumen del bot + chequeo de crons caídos + alerta de gasto de IA',
  },
  'despacho-watchdog': {
    origen: 'github', maxHoras: 3,
    que: "Dead-man's switch del despacho apícola del VPS",
  },

  // ── Scripts del VPS, envueltos por run_job.sh ───────────────────────────────────────
  // Los slugs los deriva `envolver_crontab.py` del comando, no de una lista escrita a
  // mano: una lista a mano se desincroniza el primer día que alguien agrega un job, y un
  // catálogo que miente es peor que no tenerlo. Si acá falta un slug que el VPS reporta,
  // la corrida se guarda igual pero NO se vigila — por eso el test de cobertura.

  // Ventas y clientes
  ml_autoresponder_vps: {
    origen: 'vps', maxHoras: 2,
    que: 'Contesta preguntas de MercadoLibre; lo dudoso queda en borrador',
  },
  ml_ventas_apicola: {
    origen: 'vps', maxHoras: 1,
    que: 'Venta apícola nueva → etiqueta PDF + WhatsApp al tío + mail',
  },
  ml_ventas_apicola_reporte_semana: {
    origen: 'vps', maxHoras: 200,
    que: 'Resumen semanal de ventas apícolas',
  },
  ml_ventas_apicola_reporte_mes: {
    origen: 'vps', maxHoras: 800,
    que: 'Resumen mensual de ventas apícolas',
  },
  envio_manuales_sku: {
    origen: 'vps', maxHoras: 7,
    que: 'Manda el manual del producto según SKU a quien compró',
  },
  envio_manuales_sku_reporte: {
    origen: 'vps', maxHoras: 200,
    que: 'Resumen semanal de manuales enviados',
  },
  recordatorio_sucursal: {
    origen: 'vps', maxHoras: 26,
    que: 'Avisa a quien no retiró el paquete, antes de que el correo lo devuelva',
  },
  crm_cron: {
    origen: 'vps', maxHoras: 2,
    que: 'Sincroniza el CRM (TN + WhatsApp + IG/FB) y lo espeja a Notion',
  },

  // Dinero
  precios_guardian: {
    origen: 'vps', maxHoras: 26,
    que: 'Sube precios de Tiendanube por inflación, con aviso previo para vetar',
  },
  mp_ventas_split_email: {
    origen: 'vps', maxHoras: 400,
    que: 'Corte de MercadoPago separado en apícola / incubadora / otros',
  },

  // Publicidad y atribución
  meta_capi_backfill_live: {
    origen: 'vps', maxHoras: 13,
    que: 'Reenvía a Meta las compras que el píxel no registró',
  },
  meta_organic_attribution: {
    origen: 'vps', maxHoras: 26,
    que: 'Separa cada venta pagada en Meta real vs orgánica',
  },
  meta_sync_suscriptores_push: {
    origen: 'vps', maxHoras: 26,
    que: 'Sube los emails opt-in de Tiendanube a las audiencias de Meta',
  },
  curiosos_cosido_live: {
    origen: 'vps', maxHoras: 13,
    que: 'Cose cada orden de Tiendanube con el visitante que la originó',
  },

  // Contenido
  ig_auto_proponer: {
    origen: 'vps', maxHoras: 26,
    que: 'Arma el lote de stories de mañana y lo manda por mail para vetar',
  },
  ig_auto_confirmar: {
    origen: 'vps', maxHoras: 26,
    que: 'Confirma el lote de stories leyendo los vetos del mail',
  },
  ig_auto_publicar: {
    origen: 'vps', maxHoras: 14,
    que: 'Publica la story de Instagram del turno (3 por día)',
  },
  ig_auto_reel: {
    origen: 'vps', maxHoras: 26,
    que: 'Publica el reel del día',
  },
  ig_auto_insights: {
    origen: 'vps', maxHoras: 7,
    que: 'Guarda las métricas de las stories antes de que expiren a las 24 h',
  },
  ig_moderation_email: {
    origen: 'vps', maxHoras: 200,
    que: 'Modera comentarios de Instagram; avisa solo si hubo acciones',
  },
  fb_mensajes_email: {
    origen: 'vps', maxHoras: 200,
    que: 'Lista las consultas de Messenger sin responder',
  },

  // Inteligencia y reportes
  daily_report_email: {
    origen: 'vps', maxHoras: 26,
    que: 'El reporte de las 9: Meta + Google Ads + Tiendanube + CRM',
  },
  vanguardia_diaria: {
    origen: 'vps', maxHoras: 26,
    que: 'Digest de las 7 con novedades de ecommerce e IA. Gasta Claude',
  },
  radar_saas: {
    origen: 'vps', maxHoras: 60,
    que: 'Dos casos de micro-SaaS por mail, 4 veces por semana. Gasta Claude',
  },
  reddit_radar_ingest: {
    origen: 'vps', maxHoras: 26,
    que: 'Ingesta diaria de Reddit: dolores de clientes y qué se construye',
  },
  reddit_radar_semanal: {
    origen: 'vps', maxHoras: 200,
    que: 'Destila la semana de Reddit y manda el digest. Gasta Claude',
  },
  reddit_radar_descubrir: {
    origen: 'vps', maxHoras: 800,
    que: 'Busca subreddits nuevos que valga la pena escuchar',
  },
  blog_seo_report_email: {
    origen: 'vps', maxHoras: 800,
    que: 'Scorecard mensual del blog: posiciones y cuánta gente capta',
  },
  geo_report_email: {
    origen: 'vps', maxHoras: 800,
    que: 'Cuánta gente mandan ChatGPT, Perplexity y Gemini a la web',
  },

  // Vigilantes del propio VPS
  crm_watchdog: {
    origen: 'vps', maxHoras: 3,
    que: 'Vigila el VPS: sync, Notion, DNS, reporte diario y disco',
  },
  vanguardia_watchdog: {
    origen: 'vps', maxHoras: 26,
    que: 'Avisa si la Vanguardia no salió',
  },
  backup_watchdog: {
    origen: 'vps', maxHoras: 200,
    que: 'Vigila que el backup de rescate no se quede viejo',
  },

  // ── Tareas programadas de Windows ───────────────────────────────────────────────────
  // Corren en una PC de escritorio que se apaga y se suspende, así que los márgenes son
  // MÁS ANCHOS que la cadencia real: una tarea diaria que no corrió porque la máquina
  // estaba dormida no es una falla del sistema. `heartbeat_tareas.ps1` además distingue
  // "no llegó a correr" (0x800710E0) de "corrió y falló", y solo lo segundo es rojo.
  micelium_crm_pull: {
    origen: 'windows', maxHoras: 50,
    que: 'Baja el crm.db del VPS a la PC',
  },
  miceliumbotwaalerta: {
    origen: 'windows', maxHoras: 50,
    que: 'Avisa si el bot de WhatsApp dejó de responder',
  },
  micelium_redditradar_pull: {
    origen: 'windows', maxHoras: 200,
    que: 'Baja los verbatims de Reddit y el espejo de su base',
  },
  micelium_prediccion_semanal: {
    origen: 'windows', maxHoras: 200,
    que: 'Predicción de ventas con AutoARIMA',
  },
  micelium_ig_reels_semanal: {
    origen: 'windows', maxHoras: 200,
    que: 'Renderiza los reels de Instagram de la semana',
  },
  miceliumabtestcheck: {
    origen: 'windows', maxHoras: 200,
    que: 'Revisa el A/B test activo de Meta Ads',
  },
}

/**
 * Registra que `slug` corrió. Best-effort: nunca lanza — un fallo al medir no puede
 * tumbar el trabajo que se estaba midiendo.
 */
export async function marcarHeartbeat(
  slug: string,
  ok = true,
  detalle?: string,
  extra?: { duracionMs?: number; exitCode?: number; origen?: Origen },
): Promise<void> {
  try {
    const fin = new Date()
    const duracion = extra?.duracionMs
    await prisma.jobRun.create({
      data: {
        slug,
        origen: extra?.origen ?? CATALOGO[slug]?.origen ?? 'vercel',
        inicio: duracion ? new Date(fin.getTime() - duracion) : fin,
        fin,
        duracion_ms: duracion ?? null,
        exit_code: extra?.exitCode ?? null,
        ok,
        detalle: detalle?.slice(0, 2000) ?? null,
      },
    })
  } catch (e) {
    console.error('[cron-heartbeat] no se pudo marcar:', slug, e)
  }
}

export type CronVencido = { nombre: string; horasSinCorrer: number | null; last_ok: boolean }

/** Corrida más reciente de un job, en la forma mínima que necesita `derivarEstado`. */
export type UltimaCorrida = { inicio: Date; ok: boolean } | undefined

/**
 * Estado de un job a partir de su última corrida. Función pura: toda la lógica de decisión
 * vive acá para poder probarla sin base ni reloj real.
 *
 * El orden importa. Un job que falló hace 5 minutos es 'falla', no 'ok': el hecho de que
 * corriera recién no lo vuelve sano.
 */
export function derivarEstado(
  slug: string,
  ultima: UltimaCorrida,
  ahora: Date = new Date(),
): Estado {
  const cfg = CATALOGO[slug]
  if (!cfg) return 'ok' // fuera del catálogo = a demanda, no se vigila
  if (!ultima) return 'nunca'
  if (!ultima.ok) return 'falla'
  const horas = (ahora.getTime() - ultima.inicio.getTime()) / 3_600_000
  return horas > cfg.maxHoras ? 'atrasado' : 'ok'
}

/** Horas desde la última corrida, o null si nunca corrió. */
export function horasDesde(ultima: UltimaCorrida, ahora: Date = new Date()): number | null {
  if (!ultima) return null
  return (ahora.getTime() - ultima.inicio.getTime()) / 3_600_000
}

export type CorridaResumen = { inicio: Date; ok: boolean; detalle: string | null }

/** Última corrida de cada job del catálogo. Una sola consulta, no una por job. */
export async function ultimasCorridas(): Promise<Map<string, CorridaResumen>> {
  const slugs = Object.keys(CATALOGO)
  const filas = await prisma.jobRun.findMany({
    where: { slug: { in: slugs } },
    orderBy: { inicio: 'desc' },
    select: { slug: true, inicio: true, ok: true, detalle: true },
  })
  const porSlug = new Map<string, CorridaResumen>()
  for (const f of filas) if (!porSlug.has(f.slug)) porSlug.set(f.slug, f)
  return porSlug
}

/** Los jobs del catálogo que no reportaron a tiempo, fallaron, o nunca reportaron. */
export async function chequearHeartbeats(): Promise<CronVencido[]> {
  const ultimas = await ultimasCorridas()
  const ahora = new Date()
  const vencidos: CronVencido[] = []

  for (const slug of Object.keys(CATALOGO)) {
    const u = ultimas.get(slug)
    if (derivarEstado(slug, u, ahora) === 'ok') continue
    const h = horasDesde(u, ahora)
    vencidos.push({
      nombre: slug,
      horasSinCorrer: h === null ? null : Math.round(h),
      last_ok: u?.ok ?? false,
    })
  }
  return vencidos
}

/**
 * Poda las corridas viejas. Append-only sin poda es una tabla que crece para siempre; 90
 * días alcanzan para ver una tendencia y son baratos de guardar. Se llama desde la
 * auditoría diaria, no desde un cron propio: un cron nuevo es una cosa más que puede
 * dejar de correr en silencio.
 */
export async function purgarJobRuns(dias = 90): Promise<number> {
  const corte = new Date(Date.now() - dias * 86_400_000)
  const r = await prisma.jobRun.deleteMany({ where: { inicio: { lt: corte } } })
  return r.count
}
