import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CampaignService } from '@/services/CampaignService'

// Disparado por cron externo (VPS, cada ~30 min) — mismo patrón que carrito-abandonado.
// curl -H "Authorization: Bearer $CRON_SECRET" https://mw-micelium.vercel.app/api/cron/resena-post-entrega

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stores = await prisma.store.findMany({ where: { is_active: true } })
  const results = []
  for (const store of stores) {
    const service = new CampaignService(store)
    results.push({ store: store.nombre, ...(await service.pollReviewRequests()) })
  }

  return NextResponse.json({ results })
}
