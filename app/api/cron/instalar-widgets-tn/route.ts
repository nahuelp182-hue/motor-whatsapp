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
  // Este recurso NO devuelve un array pelado como el resto de la API: viene envuelto en
  // { result, total }. Se normaliza acá para que quien llame no tenga que saberlo.
  const j = (await r.json()) as Script[] | { result?: Script[] }
  return Array.isArray(j) ? j : (j.result ?? [])
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

  // Tiendanube NO deja publicar una URL cualquiera desde la API: el script tiene que estar
  // declarado antes en el Portal de Partners, y acá solo se lo asocia a la tienda por su
  // id. Es una defensa razonable de su lado —si no, cualquier app con token podría inyectar
  // el código que quisiera en el storefront— pero implica un paso manual una sola vez.
  const body = (await req.json().catch(() => ({}))) as { script_id?: string }
  const scriptId = String(body.script_id ?? process.env.TN_SCRIPT_ID ?? '')
  if (!scriptId) {
    return NextResponse.json(
      {
        error: 'falta script_id',
        comoObtenerlo:
          `Registrá ${SRC} como script de la app en el Portal de Partners de Tiendanube y ` +
          'volvé a llamar acá con { "script_id": "..." }, o cargalo como TN_SCRIPT_ID. ' +
          'La alternativa sin Portal es pegar el bootstrap en Configuración → Códigos externos.',
      },
      { status: 400 },
    )
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
    body: JSON.stringify({ script_id: scriptId, event: 'onload', where: 'store' }),
  })

  const cuerpo = await r.text()
  if (!r.ok) return NextResponse.json({ error: cuerpo, status: r.status }, { status: 502 })
  return NextResponse.json({ ok: true, creado: JSON.parse(cuerpo) })
}
