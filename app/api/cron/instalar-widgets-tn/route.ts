import { NextResponse } from 'next/server'
import { chequearCron } from '@/lib/cron-auth'

// Instala (o revisa) el motor de widgets en el storefront de Tiendanube.
//
// Corre acá y no desde una máquina porque el token de Tiendanube está marcado como
// sensible en Vercel: no se puede leer de vuelta, solo usarlo desde el servidor.
//
// Usa el recurso Scripts de la API, no el campo de códigos externos del panel de
// Tiendanube. Los códigos externos escapan las etiquetas <script> —de ahí el truco del
// <img onerror> en los scripts viejos—; con Scripts la etiqueta la pone Tiendanube y no
// hace falta ningún rodeo.
//
//   GET  → muestra qué hay instalado
//   POST → instala si falta (no duplica)

const TN_TOKEN = process.env.TN_ACCESS_TOKEN ?? ''
const TN_STORE = process.env.TN_STORE_ID ?? ''
const TN_UA = 'MiceliumApp (nahuelp182@gmail.com)'

const SRC = 'https://guias.infomicelium.com.ar/mic.js'

function cabeceras() {
  return {
    Authentication: `bearer ${TN_TOKEN}`,
    'User-Agent': TN_UA,
    'Content-Type': 'application/json',
  }
}

type Script = { id: number; src: string; event?: string; where?: string }

async function listar(): Promise<Script[] | { error: string; status: number }> {
  const r = await fetch(`https://api.tiendanube.com/v1/${TN_STORE}/scripts`, {
    headers: cabeceras(),
  })
  if (!r.ok) return { error: await r.text(), status: r.status }
  return (await r.json()) as Script[]
}

export async function GET(req: Request) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth
  if (!TN_TOKEN || !TN_STORE) {
    return NextResponse.json({ error: 'faltan credenciales de Tiendanube' }, { status: 500 })
  }
  return NextResponse.json({ scripts: await listar() })
}

export async function POST(req: Request) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth
  if (!TN_TOKEN || !TN_STORE) {
    return NextResponse.json({ error: 'faltan credenciales de Tiendanube' }, { status: 500 })
  }

  const actuales = await listar()
  if (!Array.isArray(actuales)) return NextResponse.json(actuales, { status: 502 })

  // Idempotente: correrlo dos veces no deja dos copias del motor en la tienda, que además
  // de cargar todo por duplicado dibujaría cada widget dos veces.
  const ya = actuales.find(s => s.src === SRC)
  if (ya) return NextResponse.json({ ok: true, yaEstaba: true, script: ya })

  const r = await fetch(`https://api.tiendanube.com/v1/${TN_STORE}/scripts`, {
    method: 'POST',
    headers: cabeceras(),
    // `where: 'store'` es todo el storefront, no el checkout: el checkout de Tiendanube no
    // admite scripts de terceros y además ahí ya no hay nada que convencer.
    body: JSON.stringify({ src: SRC, event: 'onload', where: 'store' }),
  })

  const cuerpo = await r.text()
  if (!r.ok) return NextResponse.json({ error: cuerpo, status: r.status }, { status: 502 })
  return NextResponse.json({ ok: true, creado: JSON.parse(cuerpo) })
}
