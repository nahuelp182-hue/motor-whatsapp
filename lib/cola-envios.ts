// La cola de mensajes salientes.
//
// Vive acá y no dentro de la ruta del cron porque la lógica que importa —a quién le toca,
// cuándo se reintenta, cuándo se da por perdido— tiene que poder probarse sin levantar un
// servidor ni una base.
//
// EL PROBLEMA QUE RESUELVE
//
// El consumidor anterior hacía `findMany({ estado: 'PENDING', take: 50 })` y mandaba. Sin
// `ORDER BY`, sin marca de "esta fila ya la agarró alguien" y sin contador de intentos.
// Consecuencias reales, no teóricas:
//
//   - Dos corridas solapadas (el cron del VPS y un reintento de Vercel, por ejemplo)
//     tomaban las MISMAS filas y el cliente recibía el mensaje dos veces.
//   - Un mensaje que falla siempre —plantilla desaprobada, número inválido— se reintentaba
//     en cada corrida, para siempre, contra la API de Meta.
//   - Sin orden, con más de 50 pendientes había filas que no salían nunca.
import { prisma } from '@/lib/prisma'

/** Cuántas filas toma una corrida. */
export const LOTE = 50

/**
 * Tope de intentos antes de dar el mensaje por perdido.
 *
 * Cinco y no más: los fallos de la API de WhatsApp que se arreglan solos (un 500 puntual,
 * un rate limit) se resuelven en el primer o segundo reintento. Lo que falla cinco veces
 * seguidas está roto de una forma que un reintento no arregla —plantilla no aprobada,
 * número dado de baja— y seguir intentando solo suma ruido a la cuenta de Meta.
 */
export const MAX_INTENTOS = 5

/** Cuánto queda tomada una fila mientras se la procesa. Si el proceso muere, se libera sola. */
export const MINUTOS_BLOQUEO = 5

export type TrabajoCola = {
  id: string
  store_id: string
  customer_id: string
  campaign_id: string
  intentos: number
  payload: { message?: string; phone?: string } | null
  error_details: string | null
}

/**
 * Backoff exponencial: 2, 4, 8, 16 minutos. No es agresivo a propósito — estos mensajes
 * tienen valor comercial decreciente (un carrito abandonado hace tres horas ya no se
 * recupera), así que esperar horas entre intentos no sirve de nada.
 */
export function esperaTrasFallo(intentos: number): number {
  return Math.min(2 ** Math.max(1, intentos), 16)
}

/**
 * Toma hasta `LOTE` filas y las marca como tomadas, en UNA sola sentencia atómica.
 *
 * `FOR UPDATE SKIP LOCKED` es la pieza clave: la corrida que llega segunda no espera ni
 * toma las mismas filas — las saltea y agarra las siguientes. Es la diferencia entre dos
 * corridas que se reparten el trabajo y dos corridas que mandan todo por duplicado.
 *
 * El `ORDER BY scheduled_for ASC` garantiza que con backlog salgan primero los más viejos,
 * en vez de quedar filas rezagadas para siempre.
 */
export async function tomarLote(ahora = new Date()): Promise<TrabajoCola[]> {
  const bloqueoHasta = new Date(ahora.getTime() + MINUTOS_BLOQUEO * 60_000)

  return prisma.$queryRaw<TrabajoCola[]>`
    UPDATE "MessageLog" m
       SET "bloqueado_hasta" = ${bloqueoHasta},
           "intentos" = m."intentos" + 1
     WHERE m."id" IN (
       SELECT s."id" FROM "MessageLog" s
        WHERE s."estado" = 'PENDING'
          AND s."tipo_evento" = 'checkout/abandoned'
          AND s."scheduled_for" <= ${ahora}
          AND s."intentos" < ${MAX_INTENTOS}
          AND (s."bloqueado_hasta" IS NULL OR s."bloqueado_hasta" < ${ahora})
        ORDER BY s."scheduled_for" ASC
        LIMIT ${LOTE}
        FOR UPDATE SKIP LOCKED
     )
    RETURNING m."id", m."store_id", m."customer_id", m."campaign_id",
              m."intentos", m."payload", m."error_details"
  `
}

/** El envío salió bien: la fila deja de ser trabajo pendiente. */
export async function marcarEnviado(id: string): Promise<void> {
  await prisma.messageLog.update({
    where: { id },
    data: { estado: 'SENT', bloqueado_hasta: null, error_details: null },
  })
}

/**
 * El envío falló. Si quedan intentos, se libera con backoff para la próxima corrida; si se
 * agotaron, queda FAILED y visible en el panel.
 *
 * Que un mensaje agotado quede en FAILED y no en PENDING es deliberado: PENDING significa
 * "esto todavía va a salir", y un mensaje que ya no se va a intentar no puede seguir
 * diciendo eso. Si no, la cola miente sobre su propio tamaño.
 */
export async function marcarFallido(
  id: string,
  intentos: number,
  motivo: string,
  ahora = new Date(),
): Promise<'reintenta' | 'agotado'> {
  const agotado = intentos >= MAX_INTENTOS
  const espera = esperaTrasFallo(intentos)

  await prisma.messageLog.update({
    where: { id },
    data: {
      estado: agotado ? 'FAILED' : 'PENDING',
      bloqueado_hasta: agotado ? null : new Date(ahora.getTime() + espera * 60_000),
      error_details: motivo.slice(0, 500),
    },
  })
  return agotado ? 'agotado' : 'reintenta'
}

/**
 * Lee el payload de una fila, tolerando las dos formas.
 *
 * Las filas viejas lo tienen serializado en `error_details` (así se guardaba antes de la
 * migración 20260727150000). La migración hace el backfill, pero esta función acepta las
 * dos igual: si el backfill se saltea una fila por cualquier motivo, el mensaje sale igual
 * en vez de perderse en silencio.
 */
export function leerPayload(t: Pick<TrabajoCola, 'payload' | 'error_details'>): {
  message: string
  phone: string
} | null {
  const crudo = t.payload ?? parsearJson(t.error_details)
  if (!crudo) return null
  const message = typeof crudo.message === 'string' ? crudo.message : ''
  const phone = typeof crudo.phone === 'string' ? crudo.phone : ''
  if (!message || !phone) return null
  return { message, phone }
}

/**
 * Estado de la cola, para el mail diario.
 *
 * Sin esto la cola muerta es invisible: `/api/metrics` cuenta los fallidos pero el
 * dashboard no los dibuja en ninguna parte, así que un mensaje agotado no se entera nadie.
 * Va al resumen diario porque es el lugar que efectivamente se lee.
 */
export async function resumenCola(): Promise<{
  pendientes: number
  agotados24h: number
  masViejoHoras: number | null
}> {
  const hace24h = new Date(Date.now() - 24 * 3_600_000)

  const [pendientes, agotados24h, masViejo] = await Promise.all([
    prisma.messageLog.count({
      where: { estado: 'PENDING', tipo_evento: 'checkout/abandoned' },
    }),
    prisma.messageLog.count({
      where: {
        estado: 'FAILED',
        tipo_evento: 'checkout/abandoned',
        createdAt: { gte: hace24h },
      },
    }),
    prisma.messageLog.findFirst({
      where: { estado: 'PENDING', tipo_evento: 'checkout/abandoned' },
      orderBy: { scheduled_for: 'asc' },
      select: { scheduled_for: true },
    }),
  ])

  const masViejoHoras = masViejo?.scheduled_for
    ? Math.round((Date.now() - masViejo.scheduled_for.getTime()) / 3_600_000)
    : null

  return { pendientes, agotados24h, masViejoHoras }
}

function parsearJson(texto: string | null): { message?: string; phone?: string } | null {
  if (!texto || texto.trim()[0] !== '{') return null
  try {
    return JSON.parse(texto) as { message?: string; phone?: string }
  } catch {
    return null
  }
}
