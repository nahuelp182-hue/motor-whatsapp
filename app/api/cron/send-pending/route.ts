import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CampaignService } from '@/services/CampaignService'
import { chequearCron } from '@/lib/cron-auth'
import { marcarHeartbeat } from '@/lib/cron-heartbeat'
import { phoneNumberIdWhatsApp } from '@/lib/credenciales'
import {
  tomarLote,
  marcarEnviado,
  marcarFallido,
  leerPayload,
  MAX_INTENTOS,
} from '@/lib/cola-envios'
import { log, traceId } from '@/lib/log'

// Consumidor de la cola de mensajes salientes (recupero de carrito abandonado).
//
// La lógica de la cola —a quién le toca, cuándo se reintenta, cuándo se da por perdido—
// vive en lib/cola-envios.ts para que se pueda probar sin base ni servidor. Acá queda solo
// el trabajo de la ruta: autorizar, procesar el lote, reportar.
//
// OJO: este comentario decía "cada 5 minutos", pero vercel.json declara "0 8 * * *" (una
// vez al día). No se resolvió cuál de los dos es la intención real —requiere una decisión
// de negocio, no una corrección de código— así que queda anotado acá y en
// PLAN_ARQUITECTURA.md en vez de "arreglarlo" adivinando.

export async function GET(req: NextRequest) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth

  const trace = traceId(req)

  // Toma atómica: marca las filas como tomadas y las devuelve en la misma sentencia. Dos
  // corridas simultáneas se reparten el trabajo en vez de duplicarlo.
  const lote = await tomarLote()

  let enviados = 0
  let reintentan = 0
  let agotados = 0
  let sinPayload = 0

  // En serie y no en paralelo: son envíos a la API de WhatsApp, que tiene su propio límite
  // de tasa. Cincuenta requests simultáneos son la forma más rápida de comerse un 429 y
  // convertir un lote entero en reintentos.
  for (const trabajo of lote) {
    const payload = leerPayload(trabajo)

    // Sin payload no hay nada que enviar y no lo va a haber en el próximo intento: la fila
    // se cierra como fallida en vez de ocupar la cola para siempre.
    if (!payload) {
      sinPayload++
      log.warn('fila de cola sin payload: se cierra', {
        ambito: 'cola',
        trace_id: trace,
        store_id: trabajo.store_id,
        message_log_id: trabajo.id,
      })
      await prisma.messageLog.update({
        where: { id: trabajo.id },
        data: { estado: 'FAILED', bloqueado_hasta: null, error_details: 'sin payload' },
      })
      continue
    }

    try {
      const store = await prisma.store.findUnique({ where: { id: trabajo.store_id } })
      if (!store) throw new Error(`store ${trabajo.store_id} no existe`)

      const campaign = await prisma.campaign.findUnique({ where: { id: trabajo.campaign_id } })
      const config = (campaign?.configuracion ?? {}) as { wa_phone_number_id?: string }

      const service = new CampaignService(store)
      await service.dispatchMessage({
        phone: payload.phone,
        message: payload.message,
        waPhoneNumberId: phoneNumberIdWhatsApp(store, config.wa_phone_number_id),
        customerId: trabajo.customer_id,
        campaignId: trabajo.campaign_id,
        tipoEvento: 'checkout/abandoned',
      })

      await marcarEnviado(trabajo.id)
      enviados++
    } catch (e) {
      const r = await marcarFallido(trabajo.id, trabajo.intentos, String(e))
      if (r === 'agotado') agotados++
      else reintentan++

      // `agotado` es el que importa: significa que a ese cliente NO le va a llegar el
      // mensaje nunca. Va como error; un reintento pendiente es solo un aviso.
      log[r === 'agotado' ? 'error' : 'warn'](
        r === 'agotado' ? 'mensaje agotado: no se reintenta más' : 'envío falló, se reintenta',
        {
          ambito: 'cola',
          trace_id: trace,
          store_id: trabajo.store_id,
          message_log_id: trabajo.id,
          intentos: trabajo.intentos,
        },
        e,
      )
    }
  }

  await marcarHeartbeat('send-pending', agotados === 0, agotados ? `${agotados} agotados` : undefined)

  log.info('corrida de cola terminada', {
    ambito: 'cola',
    trace_id: trace,
    tomados: lote.length,
    enviados,
    reintentan,
    agotados,
    sinPayload,
  })

  return NextResponse.json({
    tomados: lote.length,
    enviados,
    reintentan,
    agotados,
    sinPayload,
    maxIntentos: MAX_INTENTOS,
  })
}
