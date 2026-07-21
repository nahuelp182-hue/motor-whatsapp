import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CampaignService } from '@/services/CampaignService'
import { chequearCron } from '@/lib/cron-auth'

// Disparado por cron externo (VPS, cada ~30 min) — Vercel Hobby no permite crons
// más frecuentes que 1/día. Ver [[project_motor_whatsapp]] / carrito abandonado.
// curl -H "Authorization: Bearer $CRON_SECRET" https://mw-micelium.vercel.app/api/cron/carrito-abandonado

export async function GET(req: NextRequest) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth

  const stores = await prisma.store.findMany({ where: { is_active: true } })
  const results = []
  for (const store of stores) {
    const service = new CampaignService(store)
    results.push({ store: store.nombre, ...(await service.pollAbandonedCarts()) })
  }

  return NextResponse.json({ results })
}
