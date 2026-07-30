// Dead-man's switch del sistema de ventas apícola.
//
// Corre en Vercel (infra separada del VPS). Si el proceso del VPS dejó de latir,
// avisa a Nahuel. Sin esto, un cron muerto o un VPS caído se ven igual que un día
// sin ventas: silencio. Y una venta que no se despacha a tiempo pega en la
// reputación de Mercado Libre.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { chequearCron } from '@/lib/cron-auth'
import { notifyNahuel } from '@/lib/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// El VPS late cada 5 min. 25 min = 5 ciclos perdidos: ya no es un hipo de red.
const TOLERANCIA_MIN = 25
// No repetir la alerta más de una vez cada 3 h mientras siga caído.
const REALERTA_HORAS = 3

export async function GET(req: Request) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth

  const esperados = ['ventas_apicola']
  const ahora = Date.now()
  const informe: Array<Record<string, unknown>> = []

  for (const nombre of esperados) {
    const hb = await prisma.heartbeat.findUnique({ where: { nombre } })

    // Nunca latió: o recién se instala, o nunca funcionó. Avisar igual.
    const ultimoMs = hb ? ahora - hb.ts.getTime() : Infinity
    const minutos = hb ? Math.round(ultimoMs / 60000) : -1
    const caido = ultimoMs > TOLERANCIA_MIN * 60_000

    informe.push({ nombre, minutos, caido })
    if (!caido) continue

    const yaAlertado =
      hb?.alertado && ahora - hb.alertado.getTime() < REALERTA_HORAS * 3600_000
    if (yaAlertado) continue

    const detalle = hb
      ? `El último latido fue hace ${minutos} min (tolerancia: ${TOLERANCIA_MIN} min).`
      : 'Nunca registró un latido.'

    await notifyNahuel(
      `🔴 ${nombre}: el sistema de despacho dejó de responder`,
      `${detalle}\n\n` +
        'Mientras esté caído NO se detectan ventas nuevas, no se manda la etiqueta ' +
        'al tío y no corren los recordatorios de despacho. Las ventas que entren ' +
        'ahora quedan sin avisar.\n\n' +
        'Qué revisar en el VPS (ssh root@100.117.45.81):\n' +
        '  systemctl status cron\n' +
        '  tail -30 /root/.claude/ventas_apicola_err.log\n' +
        '  cd /root/.claude && python3 ml_ventas_apicola.py --estado',
    )

    // Marca que ya avisó, para no repetir la alerta cada 15 min mientras siga caído.
    await prisma.heartbeat.upsert({
      where: { nombre },
      update: { alertado: new Date() },
      create: { nombre, ts: new Date(0), alertado: new Date() },
    })
  }

  return NextResponse.json({ ok: true, informe })
}
