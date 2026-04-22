import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CampaignService } from '@/services/CampaignService'

// Vercel Cron: llamar cada 5 minutos
// vercel.json → { "crons": [{ "path": "/api/cron/send-pending", "schedule": "*/5 * * * *" }] }

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // Mensajes recovery pendientes cuya hora ya pasó
  const pending = await prisma.messageLog.findMany({
    where: {
      estado: 'PENDING',
      tipo_evento: 'checkout/abandoned',
      scheduled_for: { lte: now },
    },
    include: { store: true, customer: true, campaign: true } as const,
    take: 50,
  })

  const results = await Promise.allSettled(
    pending.map(async (log) => {
      // El mensaje y teléfono están serializados en error_details
      const payload = JSON.parse(log.error_details ?? '{}') as { message: string; phone: string }
      if (!payload.message || !payload.phone) return

      const config = log.campaign.configuracion as { wa_phone_number_id: string }
      const service = new CampaignService(log.store)

      await service.dispatchMessage({
        phone: payload.phone,
        message: payload.message,
        waPhoneNumberId: config.wa_phone_number_id,
        customerId: log.customer_id,
        campaignId: log.campaign_id,
        tipoEvento: 'checkout/abandoned',
      })

      // Marcar el log original como procesado
      await prisma.messageLog.update({
        where: { id: log.id },
        data: { estado: 'SENT', error_details: null },
      })
    })
  )

  const sent = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length

  return NextResponse.json({ processed: pending.length, sent, failed })
}
