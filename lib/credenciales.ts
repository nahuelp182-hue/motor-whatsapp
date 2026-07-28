// De dónde salen los tokens de WhatsApp y Tiendanube de una tienda.
//
// Hoy los mismos dos secretos viven en DOS lugares:
//
//   - Variables de entorno de Vercel (WHATSAPP_TOKEN, TN_ACCESS_TOKEN): las usan una docena
//     de rutas —el webhook de WhatsApp, /api/lead, /api/track, las analíticas—.
//   - Columnas de la tabla Store (whatsapp_api_token, tiendanube_access_token): las usa
//     CampaignService, o sea el carrito abandonado, las instrucciones de transferencia y el
//     pedido de reseña.
//
// Eso trae dos problemas, y el segundo es peor que el primero:
//
//  1. La copia de la base está EN CLARO. Los env vars de Vercel están cifrados y con control
//     de acceso; una fila de Postgres no. Un dump de la base entrega el control del WABA y
//     de la tienda.
//  2. PUEDEN DESINCRONIZARSE. Los tokens de WhatsApp vencen y hay que rotarlos. El día que
//     se rota el env var y no la fila, CampaignService sigue usando el viejo y el carrito
//     abandonado deja de enviarse EN SILENCIO: los mensajes quedan en FAILED y nadie mira
//     esa columna hasta que se nota la caída de recupero.
//
// La solución acá es una sola puerta. El entorno manda cuando la tienda es la propia; la
// columna queda como respaldo y como la forma correcta el día que haya tiendas de terceros
// (ahí el env var no escala y hay que cifrar la columna, no vaciarla).
//
// Este archivo es además el lugar donde va a entrar el cifrado en reposo cuando haga falta:
// un único punto de lectura, en vez de doce llamadas sueltas a `store.whatsapp_api_token`.
import type { Store } from '@prisma/client'

/** La tienda propia, la única que tiene sus tokens en el entorno de Vercel. */
function esTiendaPropia(store: Pick<Store, 'tiendanube_store_id'>): boolean {
  const propio = process.env.TN_STORE_ID
  return !!propio && store.tiendanube_store_id === propio
}

/**
 * Token de la API de WhatsApp Cloud para esta tienda.
 *
 * Devuelve '' si no hay ninguno; quien llama ya trata el envío fallido (queda en FAILED con
 * el motivo), así que no tiene sentido lanzar y cortar el lote entero por una tienda.
 */
export function tokenWhatsApp(store: Pick<Store, 'tiendanube_store_id' | 'whatsapp_api_token'>): string {
  if (esTiendaPropia(store) && process.env.WHATSAPP_TOKEN) return process.env.WHATSAPP_TOKEN
  return store.whatsapp_api_token ?? ''
}

/** Token de la API de Tiendanube para esta tienda. Mismo criterio. */
export function tokenTiendanube(
  store: Pick<Store, 'tiendanube_store_id' | 'tiendanube_access_token'>,
): string {
  if (esTiendaPropia(store) && process.env.TN_ACCESS_TOKEN) return process.env.TN_ACCESS_TOKEN
  return store.tiendanube_access_token ?? ''
}

/**
 * Número emisor de WhatsApp (phone_number_id) para esta tienda.
 *
 * Es el TERCER dato que tenía dos fuentes de verdad, igual que los tokens de arriba:
 *
 *   - `CampaignService` lo leía de `campaign.configuracion.wa_phone_number_id` (una fila
 *     de la base, distinta por campaña).
 *   - El webhook de WhatsApp y `/api/conversaciones/responder` lo leían de
 *     `process.env.WHATSAPP_PHONE_NUMBER_ID`.
 *
 * O sea que el bot podía contestar desde un número y el carrito abandonado escribir desde
 * otro, sin que nada avisara. Peor: al rotar el número había que acordarse de los dos
 * lugares, y el que quedaba viejo fallaba en silencio con los mensajes en FAILED.
 *
 * Mismo criterio que los tokens: para la tienda propia manda el entorno; la configuración
 * de la campaña queda como respaldo y como la forma correcta el día que haya tiendas de
 * terceros (ahí cada una tiene su WABA y el env var no alcanza).
 */
export function phoneNumberIdWhatsApp(
  store: Pick<Store, 'tiendanube_store_id'>,
  desdeConfig?: string | null,
): string {
  if (esTiendaPropia(store) && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return process.env.WHATSAPP_PHONE_NUMBER_ID
  }
  return desdeConfig ?? ''
}
