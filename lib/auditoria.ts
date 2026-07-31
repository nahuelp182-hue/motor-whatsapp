// Ensamblado de una auditoría del sistema.
//
// LA AUDITORÍA SE ARMA ENTRE DOS MÁQUINAS, A PROPÓSITO
//
// El VPS chequea lo que solo se puede ver estando adentro: disco, memoria, frescura de sus
// archivos de estado, y si cada credencial sigue viva. Esta app agrega lo que solo ella
// puede ver: el estado de las 46 automatizaciones, que vive en `JobRun`.
//
// Podrían haber ido en dos pantallas separadas. Van juntas porque la pregunta que se hace
// alguien al abrir el panel es una sola —"¿está todo bien?"— y repartirla en dos lugares
// obliga a acordarse de mirar el segundo.
import { prisma } from '@/lib/prisma'
import { CATALOGO, derivarEstado, horasDesde, ultimasCorridas } from '@/lib/cron-heartbeat'

export type EstadoCheck = 'ok' | 'warn' | 'fail'

export type CheckEntrada = {
  clave: string
  grupo: string
  titulo: string
  estado: EstadoCheck
  valor?: string | null
  umbral?: string | null
  hint?: string | null
}

/**
 * Chequeos derivados del estado de las automatizaciones.
 *
 * No los puede hacer el VPS: `JobRun` vive en esta base, y además incluye jobs que no
 * corren en el VPS (GitHub Actions, Windows). Un job en falla se reporta como un chequeo
 * propio, con su reseña, para que el que lee sepa qué se rompió sin buscar en otro lado.
 */
export async function checksDeAutomatizaciones(): Promise<CheckEntrada[]> {
  const ultimas = await ultimasCorridas()
  const ahora = new Date()

  const fallas: string[] = []
  const atrasados: string[] = []
  const nunca: string[] = []

  for (const slug of Object.keys(CATALOGO)) {
    const u = ultimas.get(slug)
    switch (derivarEstado(slug, u, ahora)) {
      case 'falla': fallas.push(slug); break
      case 'atrasado': atrasados.push(slug); break
      case 'nunca': nunca.push(slug); break
    }
  }

  const total = Object.keys(CATALOGO).length
  const checks: CheckEntrada[] = [
    {
      clave: 'jobs_en_falla',
      grupo: 'automatizaciones',
      titulo: 'Automatizaciones que fallaron en su última corrida',
      estado: fallas.length ? 'fail' : 'ok',
      valor: fallas.length ? fallas.join(', ') : 'ninguna',
      umbral: '0',
      hint: fallas.length
        ? `Ver el detalle del error en el panel, o en el VPS: tail -50 /root/.claude/<job>.log`
        : null,
    },
    {
      clave: 'jobs_atrasados',
      grupo: 'automatizaciones',
      titulo: 'Automatizaciones que dejaron de dispararse',
      estado: atrasados.length ? 'fail' : 'ok',
      valor: atrasados.length ? atrasados.join(', ') : 'ninguna',
      umbral: 'dentro de su cadencia + margen',
      hint: atrasados.length
        ? 'Revisar que sigan en el crontab: ssh al VPS y `crontab -l | grep <slug>`'
        : null,
    },
    {
      // Separado de "atrasado" porque significa otra cosa: no es que dejó de correr, es que
      // NUNCA se lo vio. Suele ser un job mal configurado o un slug que no coincide, no una
      // caída. Confundirlos manda a buscar el problema al lugar equivocado.
      clave: 'jobs_sin_reportar',
      grupo: 'automatizaciones',
      titulo: 'Automatizaciones que nunca reportaron',
      estado: nunca.length ? 'warn' : 'ok',
      valor: nunca.length ? `${nunca.length} de ${total}: ${nunca.slice(0, 6).join(', ')}` : 'ninguna',
      umbral: '0',
      hint: nunca.length
        ? 'Puede ser un slug del catálogo que no coincide con el que reporta el VPS, o un job que todavía no llegó a su primera corrida'
        : null,
    },
  ]

  // Los jobs lentos no rompen nada hoy, pero un job que tarda cada vez más suele ser el
  // aviso previo de uno que va a empezar a fallar por timeout.
  const lentos = await prisma.$queryRaw<Array<{ slug: string; ultima: number; media: number }>>`
    WITH stats AS (
      SELECT slug, avg(duracion_ms) AS media, count(*) AS n
        FROM "JobRun"
       WHERE duracion_ms IS NOT NULL AND inicio > now() - interval '14 days'
       GROUP BY slug HAVING count(*) >= 5
    ),
    reciente AS (
      SELECT DISTINCT ON (slug) slug, duracion_ms AS ultima
        FROM "JobRun" WHERE duracion_ms IS NOT NULL ORDER BY slug, inicio DESC
    )
    SELECT r.slug, r.ultima::int AS ultima, s.media::int AS media
      FROM reciente r JOIN stats s ON s.slug = r.slug
     WHERE r.ultima > s.media * 3 AND r.ultima > 10000`

  checks.push({
    clave: 'jobs_lentos',
    grupo: 'automatizaciones',
    titulo: 'Automatizaciones que tardaron mucho más que de costumbre',
    estado: lentos.length ? 'warn' : 'ok',
    valor: lentos.length
      ? lentos.map((l) => `${l.slug} ${Math.round(l.ultima / 1000)}s (normal ${Math.round(l.media / 1000)}s)`).join('; ')
      : 'ninguna',
    umbral: '3× su promedio de 14 días',
    hint: lentos.length ? 'Todavía no falla, pero suele anticipar un timeout' : null,
  })

  return checks
}

/** Guarda una corrida completa con sus chequeos. Devuelve el id. */
export async function guardarAuditoria(
  origen: 'manual' | 'programada',
  checks: CheckEntrada[],
  duracionMs?: number,
): Promise<string> {
  const cuenta = (e: EstadoCheck) => checks.filter((c) => c.estado === e).length
  const run = await prisma.auditoriaRun.create({
    data: {
      origen,
      duracion_ms: duracionMs ?? null,
      total: checks.length,
      ok: cuenta('ok'),
      warn: cuenta('warn'),
      fail: cuenta('fail'),
      checks: {
        create: checks.map((c) => ({
          clave: c.clave,
          grupo: c.grupo,
          titulo: c.titulo,
          estado: c.estado,
          valor: c.valor?.slice(0, 1000) ?? null,
          umbral: c.umbral?.slice(0, 200) ?? null,
          hint: c.hint?.slice(0, 500) ?? null,
        })),
      },
    },
  })
  return run.id
}

/**
 * Poda el historial de auditorías. Los chequeos se van solos por el ON DELETE CASCADE.
 * 90 días, igual que JobRun: alcanza para ver una tendencia sin guardar para siempre.
 */
export async function purgarAuditorias(dias = 90): Promise<number> {
  const corte = new Date(Date.now() - dias * 86_400_000)
  const r = await prisma.auditoriaRun.deleteMany({ where: { ts: { lt: corte } } })
  return r.count
}
