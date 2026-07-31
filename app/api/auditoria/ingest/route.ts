// Recibe los chequeos que hizo el VPS y completa la auditoría con los que solo esta app
// puede ver (el estado de las 46 automatizaciones, que vive en JobRun).
//
// Ver lib/auditoria.ts para por qué la auditoría se arma entre dos máquinas.
import { NextRequest, NextResponse } from 'next/server'
import { chequearCron } from '@/lib/cron-auth'
import {
  checksDeAutomatizaciones,
  guardarAuditoria,
  purgarAuditorias,
  type CheckEntrada,
  type EstadoCheck,
} from '@/lib/auditoria'
import { purgarJobRuns } from '@/lib/cron-heartbeat'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ESTADOS: EstadoCheck[] = ['ok', 'warn', 'fail']
const GRUPOS = ['automatizaciones', 'credenciales', 'negocio', 'infra']

function sanear(crudo: unknown): CheckEntrada | null {
  if (!crudo || typeof crudo !== 'object') return null
  const c = crudo as Record<string, unknown>
  const clave = String(c.clave ?? '').trim().slice(0, 60)
  const titulo = String(c.titulo ?? '').trim().slice(0, 200)
  if (!clave || !titulo) return null

  const estadoCrudo = String(c.estado ?? '')
  // Un estado que no se reconoce NO se degrada a 'ok': un chequeo cuyo resultado no se
  // entiende es exactamente el que hay que mirar, no el que hay que dar por bueno.
  const estado = (ESTADOS as string[]).includes(estadoCrudo) ? (estadoCrudo as EstadoCheck) : 'warn'
  const grupoCrudo = String(c.grupo ?? '')
  const grupo = GRUPOS.includes(grupoCrudo) ? grupoCrudo : 'infra'

  const txt = (v: unknown) => (typeof v === 'string' && v.length ? v : null)
  return { clave, grupo, titulo, estado, valor: txt(c.valor), umbral: txt(c.umbral), hint: txt(c.hint) }
}

export async function POST(req: NextRequest) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const delVps = Array.isArray(body.checks)
    ? body.checks.map(sanear).filter((c): c is CheckEntrada => c !== null)
    : []

  if (!delVps.length) {
    return NextResponse.json({ error: 'sin chequeos válidos' }, { status: 400 })
  }

  // Si esto falla, se guarda igual lo que mandó el VPS. Una auditoría parcial sirve; una
  // que se pierde entera por un error al leer una tabla, no.
  let deJobs: CheckEntrada[] = []
  try {
    deJobs = await checksDeAutomatizaciones()
  } catch (e) {
    deJobs = [{
      clave: 'jobs_estado',
      grupo: 'automatizaciones',
      titulo: 'Estado de las automatizaciones',
      estado: 'warn',
      valor: 'no se pudo calcular',
      hint: String(e).slice(0, 300),
    }]
  }

  const origen = body.origen === 'manual' ? 'manual' : 'programada'
  const duracion = typeof body.duracion_ms === 'number' ? Math.round(body.duracion_ms) : undefined
  const checks = [...deJobs, ...delVps]
  const id = await guardarAuditoria(origen, checks, duracion)

  // La poda va acá y no en un cron propio: un cron más es una cosa más que puede dejar de
  // correr en silencio. La auditoría corre todos los días por definición.
  let podadas = 0
  try {
    podadas = (await purgarJobRuns()) + (await purgarAuditorias())
  } catch (e) {
    console.error('[auditoria] poda falló:', e)
  }

  const fail = checks.filter((c) => c.estado === 'fail').length
  const warn = checks.filter((c) => c.estado === 'warn').length
  return NextResponse.json({ ok: true, id, total: checks.length, fail, warn, podadas })
}
