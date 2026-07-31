// Estado de las automatizaciones y gasto de IA, para la solapa Sistema.
//
// Va detrás de la sesión del dashboard: el middleware NO lista /api/sistema entre las
// abiertas, así que llega acá solo con sesión válida. Es información sensible —dice qué
// está caído y cuánto se gasta— y no tiene por qué ser pública.
import { NextRequest, NextResponse } from 'next/server'
import { estadoDeJobs, gastoIA } from '@/lib/sistema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const dias = Math.min(Math.max(Number(req.nextUrl.searchParams.get('dias') ?? 30), 1), 90)

  // En paralelo: son dos consultas independientes y esta ruta la pide una pantalla que el
  // usuario está mirando.
  const [jobs, gasto] = await Promise.all([estadoDeJobs(), gastoIA(dias)])

  const resumen = {
    total: jobs.length,
    ok: jobs.filter((j) => j.estado === 'ok').length,
    falla: jobs.filter((j) => j.estado === 'falla').length,
    atrasado: jobs.filter((j) => j.estado === 'atrasado').length,
    nunca: jobs.filter((j) => j.estado === 'nunca').length,
  }

  return NextResponse.json({ jobs, resumen, gasto })
}
