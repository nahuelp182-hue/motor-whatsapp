// Recordatorio del conteo de stock. Lo dispara el cron del VPS, una vez por día.
//
// El stock de incubadoras es el único dato del panel que no existe en ningún sistema: se
// cuenta mirando el estante. De él salen la cobertura, el punto de reposición, la alerta de
// quiebre y la primera pata del ciclo de efectivo en Caja — o sea que si nadie lo carga, no
// falla una tarjeta: fallan cuatro cálculos en dos pantallas.
//
// Y falla en silencio, que es lo peor: `leerProduccion` devuelve `null` prolijamente y la
// pantalla dice "sin dato" sin que nadie la esté mirando. Un dato que depende de que alguien
// se acuerde necesita algo que se acuerde por él.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { chequearCron } from '@/lib/cron-auth'
import { marcarHeartbeat } from '@/lib/cron-heartbeat'
import { notifyNahuel } from '@/lib/notify'
import { leerProduccion, CONTEO_VIEJO_DIAS } from '@/lib/operacion/produccion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PANEL = 'https://mw-micelium.vercel.app/operacion/produccion'

export async function POST(req: NextRequest) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth

  try {
    const ultimo = await prisma.conteoStock.findFirst({ orderBy: { fecha: 'desc' } })
    const dias = ultimo
      ? Math.floor((Date.now() - ultimo.fecha.getTime()) / 86_400_000)
      : null

    // Dentro de la ventana no se manda nada. Un recordatorio que llega todos los días se
    // deja de leer en una semana, y entonces tampoco sirve el día que sí importa.
    if (dias !== null && dias < CONTEO_VIEJO_DIAS) {
      await marcarHeartbeat('stock-recordatorio', true, `conteo de hace ${dias} d, sin aviso`)
      return NextResponse.json({ ok: true, aviso: false, dias })
    }

    // La cobertura entra en el aviso porque cambia qué tan urgente es: 12 unidades son
    // holgura o son una semana según a qué ritmo se estén yendo, y ese ritmo lo sabe el
    // panel, no quien lee el mail.
    const prod = await leerProduccion()
    const cobertura = prod.coberturaDias

    const cuerpo = ultimo
      ? [
          `El último conteo de stock es del ${ultimo.fecha.toLocaleDateString('es-AR')} (hace ${dias} días): ${ultimo.unidades} unidades.`,
          cobertura !== null
            ? `Al ritmo de los últimos 30 días (${prod.pedidos30} pedidos), ese stock daba para ${Math.round(cobertura)} días.`
            : 'No hubo pedidos en los últimos 30 días, así que no hay ritmo con qué calcular la cobertura.',
          '',
          'Con un conteo viejo, la cobertura y el punto de reposición se calculan sobre una foto que ya no es. Contá el estante y cargá el número:',
          PANEL,
        ].join('\n')
      : [
          'Nunca se cargó un conteo de stock de incubadoras.',
          '',
          'Sin ese número, Producción no puede calcular cobertura ni punto de reposición, y el ciclo de efectivo de Caja queda sin su primera pata. Es el único dato del panel que no existe en ningún sistema: hay que contarlo.',
          PANEL,
        ].join('\n')

    await notifyNahuel(
      ultimo ? `Stock: el conteo tiene ${dias} días` : 'Stock: nunca se cargó un conteo',
      cuerpo,
    )
    await marcarHeartbeat('stock-recordatorio', true, ultimo ? `aviso enviado (${dias} d)` : 'aviso enviado (sin conteo)')
    return NextResponse.json({ ok: true, aviso: true, dias })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'error desconocido'
    await marcarHeartbeat('stock-recordatorio', false, msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// El cron del VPS usa curl sin cuerpo, igual que con operacion-envios.
export const GET = POST
