// Recibe el reporte de una corrida de automatización desde afuera de Vercel.
//
// POR QUÉ EXISTE
//
// Los crons de Vercel se auto-reportan llamando a `marcarHeartbeat()` dentro de su propia
// ruta. Los 36 jobs del VPS y las 6 tareas de Windows no pueden: son procesos de sistema
// operativo que no comparten proceso con la app. Este endpoint es su única puerta.
//
// Del otro lado está `run_job.sh` (VPS) y `heartbeat.ps1` (Windows). Envuelven al comando
// real, miden, y mandan el resultado acá. Ninguno de los 36 scripts se modificó: se cambió
// una vez la línea del crontab, no treinta y seis programas.
//
// EL EXIT CODE ES LA VERDAD, NO EL LOG
//
// Antes de esto, lo único disponible era la fecha de modificación del .log de cada job. Eso
// dice que el proceso escribió algo, no que haya terminado bien: un script que explota
// igual deja su excepción en el log y actualiza el mtime. El exit code no se puede fingir.
import { NextRequest, NextResponse } from 'next/server'
import { chequearCron } from '@/lib/cron-auth'
import { marcarHeartbeat, type Origen } from '@/lib/cron-heartbeat'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ORIGENES: Origen[] = ['vps', 'windows', 'github', 'vercel']

export async function POST(req: NextRequest) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const slug = String(body.slug ?? '').trim().slice(0, 80)
  if (!slug) return NextResponse.json({ error: 'falta slug' }, { status: 400 })

  const origenCrudo = String(body.origen ?? 'vps')
  const origen = (ORIGENES as string[]).includes(origenCrudo) ? (origenCrudo as Origen) : 'vps'

  const exitCode = body.exit_code === undefined || body.exit_code === null
    ? undefined
    : Number(body.exit_code)

  // Reglas, en orden:
  //
  //  1. Un `ok` booleano EXPLÍCITO manda sobre el exit code. Existe para el caso de las
  //     tareas de Windows que no llegaron a correr porque la PC estaba suspendida
  //     (0x800710E0): traen un código distinto de cero pero no son una falla, y contarlas
  //     como tal pinta de rojo permanente una PC de escritorio que simplemente se apaga.
  //     Un rojo que está siempre encendido deja de querer decir algo.
  //  2. Si no hay `ok` explícito, manda el exit code.
  //  3. Si no hay ninguno de los dos, es falla. Un reporte sin código —un job matado por
  //     el OOM killer, por ejemplo— no puede contarse como éxito silenciosamente.
  const ok = typeof body.ok === 'boolean'
    ? body.ok
    : exitCode !== undefined && exitCode === 0

  const duracionMs = body.duracion_ms === undefined || body.duracion_ms === null
    ? undefined
    : Math.max(0, Math.round(Number(body.duracion_ms)))

  await marcarHeartbeat(
    slug,
    ok,
    typeof body.detalle === 'string' ? body.detalle : undefined,
    { origen, exitCode, duracionMs },
  )

  return NextResponse.json({ ok: true, slug, registrado: ok })
}
