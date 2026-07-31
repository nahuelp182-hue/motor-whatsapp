// Consulta el estado de entrega REAL de un mensaje de WhatsApp.
//
// La Cloud API devuelve un wamid con HTTP 200 aunque el mensaje después no se
// entregue (típico: error 131047, mensaje libre fuera de la ventana de 24 h).
// El único lugar donde aparece la verdad es el webhook `statuses`. El VPS
// pregunta acá antes de dar una venta por avisada.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { chequearCron } from '@/lib/cron-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth

  const { searchParams } = new URL(req.url)
  const wamids = (searchParams.get('wamid') || '')
    .split(',')
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 50)

  if (!wamids.length) {
    return NextResponse.json({ error: 'falta wamid' }, { status: 400 })
  }

  const filas = await prisma.waStatus.findMany({ where: { wamid: { in: wamids } } })
  const porId = new Map(filas.map((f) => [f.wamid, f]))

  // `null` = todavía no llegó ningún status para ese wamid. NO es lo mismo que
  // "falló": el webhook puede tardar unos segundos. Quien pregunta decide el plazo.
  const estados = wamids.map((w) => {
    const f = porId.get(w)
    return f
      ? {
          wamid: w,
          estado: f.estado,
          entregado: f.estado === 'delivered' || f.estado === 'read',
          error_code: f.error_code,
          error_desc: f.error_desc,
          ts: f.ts.toISOString(),
        }
      : { wamid: w, estado: null, entregado: false }
  })

  return NextResponse.json({ ok: true, estados })
}
