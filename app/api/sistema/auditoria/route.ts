// El botón "Auditar ahora" del panel, y la lectura del historial.
//
// POR QUÉ EL NAVEGADOR NO LLAMA AL VPS DIRECTO
//
// El endpoint del VPS pide un token. Si el botón lo llamara desde el navegador, ese token
// tendría que viajar al cliente — o sea, quedaría a la vista de cualquiera que abra las
// herramientas de desarrollo. Acá el pedido pasa por el servidor: esta ruta ya está detrás
// de la sesión del dashboard (lo garantiza el middleware, que NO la incluye en las
// abiertas), y el token vive en las variables de Vercel.
//
// Los RESULTADOS no vuelven por esta puerta. El script del VPS los manda por su cuenta a
// /api/auditoria/ingest. Devolverlos también acá sería una segunda fuente de la misma
// verdad, con la garantía de que algún día dirían cosas distintas.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VPS = 'https://vps.infomicelium.com.ar/auditar'

/** Historial: la última corrida con sus chequeos, y el resumen de las anteriores. */
export async function GET() {
  const ultima = await prisma.auditoriaRun.findFirst({
    orderBy: { ts: 'desc' },
    include: { checks: { orderBy: [{ estado: 'asc' }, { grupo: 'asc' }] } },
  })

  const historial = await prisma.auditoriaRun.findMany({
    orderBy: { ts: 'desc' },
    take: 30,
    select: { id: true, ts: true, origen: true, total: true, ok: true, warn: true, fail: true },
  })

  // Diff contra la corrida anterior: "esto empeoró desde ayer" es lo que se quiere saber
  // cuando algo se rompió y no se sabe cuándo. Sin esto hay que comparar dos pantallas a ojo.
  let empeoraron: string[] = []
  let mejoraron: string[] = []
  if (ultima && historial.length > 1) {
    const previa = await prisma.auditoriaRun.findUnique({
      where: { id: historial[1].id },
      include: { checks: true },
    })
    if (previa) {
      const antes = new Map(previa.checks.map((c) => [c.clave, c.estado]))
      const peso = { ok: 0, warn: 1, fail: 2 } as Record<string, number>
      for (const c of ultima.checks) {
        const a = antes.get(c.clave)
        if (!a || a === c.estado) continue
        if (peso[c.estado] > peso[a]) empeoraron.push(c.titulo)
        else mejoraron.push(c.titulo)
      }
    }
  }

  return NextResponse.json({ ultima, historial, empeoraron, mejoraron })
}

/** Dispara una auditoría en el VPS. Los resultados llegan por /api/auditoria/ingest. */
export async function POST(req: NextRequest) {
  const token = process.env.AUDIT_VPS_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: 'Falta AUDIT_VPS_TOKEN en el entorno' },
      { status: 503 },
    )
  }

  try {
    // 200 s de techo: el VPS corta solo a los 180 s. Si esta espera fuera más corta que la
    // del otro lado, un usuario vería "falló" mientras la auditoría termina bien y guarda.
    const r = await fetch(VPS, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(200_000),
    })
    const cuerpo = await r.json().catch(() => ({}))

    if (r.status === 429 || r.status === 409) {
      // No es un error: es el freno haciendo su trabajo. Se distingue para que el panel
      // muestre "esperá un momento" y no "falló la auditoría".
      return NextResponse.json({ ocupado: true, ...cuerpo }, { status: 200 })
    }
    if (!r.ok) {
      return NextResponse.json({ error: 'El VPS no pudo auditar', detalle: cuerpo }, { status: 502 })
    }
    return NextResponse.json({ ok: true, ...cuerpo })
  } catch (e) {
    return NextResponse.json(
      { error: 'No se pudo hablar con el VPS', detalle: String(e).slice(0, 200) },
      { status: 502 },
    )
  }
}
