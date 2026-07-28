import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CampaignService } from '@/services/CampaignService'
import { chequearCron } from '@/lib/cron-auth'
import { marcarHeartbeat } from '@/lib/cron-heartbeat'

// Disparado por cron externo (VPS, cada ~30 min) — mismo patrón que carrito-abandonado.
// curl -H "Authorization: Bearer $CRON_SECRET" https://mw-micelium.vercel.app/api/cron/resena-post-entrega

export async function GET(req: NextRequest) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth

  try {
    const stores = await prisma.store.findMany({ where: { is_active: true } })
    const results = []
    for (const store of stores) {
      const service = new CampaignService(store)
      results.push({ store: store.nombre, ...(await service.pollReviewRequests()) })
    }

    await marcarHeartbeat('resena-post-entrega', true)
    return NextResponse.json({ results })
  } catch (e) {
    await marcarHeartbeat('resena-post-entrega', false, String(e).slice(0, 300))
    throw e
  }
}
