import { NextRequest, NextResponse } from 'next/server'
import { getEstadoAndreani } from '@/lib/andreani'

export const runtime = 'nodejs'

// Estado real de un envío Andreani. Lo usa el cron del VPS (recordatorio_sucursal),
// que NO puede alcanzar tracking-api.andreani.com directamente (IP de datacenter
// bloqueada). Vercel sí llega. Protegido con CRON_SECRET.
// curl -H "Authorization: Bearer $CRON_SECRET" ".../api/andreani?numero=360003034254330"
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const numero = req.nextUrl.searchParams.get('numero')
  if (!numero || !/^\d{6,}$/.test(numero)) {
    return NextResponse.json({ error: 'numero inválido' }, { status: 400 })
  }
  const estado = await getEstadoAndreani(numero)
  return NextResponse.json(estado)
}
