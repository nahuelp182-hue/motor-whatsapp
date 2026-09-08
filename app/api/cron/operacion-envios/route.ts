// Refresco del histórico de envíos. Lo dispara el cron del VPS.
//
// Es el único punto que consulta Tiendanube y Andreani para Logística: la pantalla lee de
// Postgres. Cada corrida guarda un día más de historia que después no se puede
// reconstruir — Andreani solo informa el presente — así que si esto deja de correr, no se
// rompe la pantalla: se pierden los datos de esos días para siempre. Por eso marca
// heartbeat y entra al catálogo con tolerancia de 4 h.
import { NextRequest, NextResponse } from 'next/server'
import { chequearCron } from '@/lib/cron-auth'
import { marcarHeartbeat } from '@/lib/cron-heartbeat'
import { refrescarEnvios } from '@/lib/operacion/envios'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // consulta Andreani envío por envío, con pausa entre uno y otro

export async function POST(req: NextRequest) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth

  const dias = Number(req.nextUrl.searchParams.get('dias') ?? 45)
  try {
    const r = await refrescarEnvios(Number.isFinite(dias) ? dias : 45)
    await marcarHeartbeat('operacion-envios', r.ok, `${r.vistos} envíos · ${r.consultados} consultados · ${r.errores} con error`, {
      duracionMs: r.ms,
    })
    return NextResponse.json(r)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error desconocido'
    await marcarHeartbeat('operacion-envios', false, msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// El cron del VPS usa curl sin cuerpo; GET es el mismo trabajo para no obligarlo a -X POST.
export const GET = POST
