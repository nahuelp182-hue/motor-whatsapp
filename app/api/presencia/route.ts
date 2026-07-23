// Presencia en vivo. Lo llama mic.js desde el storefront de Tiendanube, así que va con CORS
// abierto igual que /api/track.
//
// Devuelve SIEMPRE el número real de visitantes presentes. El factor de corrección que
// muestra el widget se aplica del lado del navegador, con lo que está configurado en el
// panel: acá adentro no se toca el dato, para que el número crudo siga siendo auditable
// contra Clarity o GA4 cuando haya que recalibrar.
import { NextRequest, NextResponse } from 'next/server'
import { marcarYContar } from '@/lib/presencia'
import { consumirLimite, ipDe, respuesta429 } from '@/lib/ratelimit'

export const runtime = 'nodejs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function POST(req: NextRequest) {
  // Tope holgado: el navegador avisa cada 45 s, así que una pestaña normal hace ~80 pedidos
  // por hora. Esto corta a quien intente inflar el contador a fuerza de pedidos.
  const porIp = await consumirLimite(`presencia:ip:${ipDe(req)}`, 300, 60 * 60)
  if (!porIp.permitido) return respuesta429(porIp, CORS)

  let body: { pagina?: string; vid?: string; ventana?: number }
  try {
    body = JSON.parse(await req.text())
  } catch {
    return NextResponse.json({ n: 0 }, { headers: CORS })
  }

  const vid = String(body?.vid ?? '').trim()
  const pagina = String(body?.pagina ?? '').trim()
  // Sin identificador de visitante no se puede contar sin duplicar: se responde 0 y el
  // widget no se dibuja.
  if (!vid || vid.length < 8 || !pagina) {
    return NextResponse.json({ n: 0 }, { headers: CORS })
  }

  // La ventana la fija el servidor dentro de un rango sensato: si viniera libre del cliente,
  // pedir "las últimas 24 horas" convertiría el contador en otra cosa.
  const ventana = Math.min(600, Math.max(60, Number(body?.ventana) || 180))

  const n = await marcarYContar(pagina, vid, ventana)
  return NextResponse.json({ n }, { headers: CORS })
}
