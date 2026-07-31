// Los tests van sobre `derivarEstado`, que es donde vive toda la decisión. La escritura y
// la lectura de la base son mecánica; lo que se puede razonar mal —y lo que ya se razonó
// mal una vez— es cuándo un job cuenta como caído.
//
// El caso que motivó todo esto: `CronHeartbeat` estuvo vacía desde el 27/07 hasta el
// 31/07 y nadie se enteró. "Nunca reportó" tiene que ser un estado explícito y ruidoso,
// no un vacío que se confunde con silencio sano. De ahí el primer test.
import { describe, it, expect } from 'vitest'
import { derivarEstado, horasDesde, CATALOGO } from '@/lib/cron-heartbeat'

const AHORA = new Date('2026-07-31T12:00:00Z')
const haceHoras = (h: number) => new Date(AHORA.getTime() - h * 3_600_000)

describe('derivarEstado', () => {
  it('un job del catálogo que nunca corrió es "nunca", no "ok"', () => {
    // El agujero real: la tabla vacía se leía como "no hay nada raro".
    expect(derivarEstado('send-pending', undefined, AHORA)).toBe('nunca')
  })

  it('una corrida reciente y exitosa es "ok"', () => {
    expect(derivarEstado('send-pending', { inicio: haceHoras(0.5), ok: true }, AHORA)).toBe('ok')
  })

  it('una corrida FALLIDA reciente es "falla", no "ok"', () => {
    // Que haya corrido recién no lo vuelve sano: el orden de los chequeos importa.
    expect(derivarEstado('send-pending', { inicio: haceHoras(0.1), ok: false }, AHORA)).toBe('falla')
  })

  it('pasado el margen, es "atrasado"', () => {
    // send-pending tolera 2 h; a las 3 h perdió varias corridas seguidas.
    expect(derivarEstado('send-pending', { inicio: haceHoras(3), ok: true }, AHORA)).toBe('atrasado')
  })

  it('justo en el límite todavía es "ok" — el margen no dispara por un minuto', () => {
    expect(derivarEstado('send-pending', { inicio: haceHoras(2), ok: true }, AHORA)).toBe('ok')
  })

  it('un job diario a las 20 h sigue "ok" (el margen cubre la demora del planificador)', () => {
    // GitHub Actions y los crons demoran; 26 h de tolerancia sobre 24 evita el falso positivo.
    expect(derivarEstado('resumen-bot', { inicio: haceHoras(20), ok: true }, AHORA)).toBe('ok')
  })

  it('un job diario a las 30 h está "atrasado"', () => {
    expect(derivarEstado('resumen-bot', { inicio: haceHoras(30), ok: true }, AHORA)).toBe('atrasado')
  })

  it('un job FUERA del catálogo nunca se marca caído', () => {
    // Los de a demanda (andreani, instalar-widgets-tn) no tienen cadencia: su ausencia no
    // significa nada y no puede generar ruido.
    expect(derivarEstado('andreani', undefined, AHORA)).toBe('ok')
  })
})

describe('horasDesde', () => {
  it('devuelve null si nunca corrió (no 0, que se leería como "recién")', () => {
    expect(horasDesde(undefined, AHORA)).toBeNull()
  })

  it('mide las horas transcurridas', () => {
    expect(horasDesde({ inicio: haceHoras(5), ok: true }, AHORA)).toBeCloseTo(5)
  })
})

describe('CATALOGO', () => {
  it('todo job vigilado declara origen, margen y reseña', () => {
    // La reseña no es decorativa: es lo único que hace legible el panel. Un job sin
    // reseña es una fila que nadie sabe interpretar cuando se pone en rojo.
    for (const [slug, cfg] of Object.entries(CATALOGO)) {
      expect(cfg.origen, slug).toBeTruthy()
      expect(cfg.maxHoras, slug).toBeGreaterThan(0)
      expect(cfg.que.length, slug).toBeGreaterThan(10)
    }
  })

  it('ningún job vigilado vive en Vercel — el plan Hobby no los corre', () => {
    // Si alguien vuelve a declarar un cron en vercel.json, este test lo caza.
    for (const [slug, cfg] of Object.entries(CATALOGO)) {
      expect(cfg.origen, `${slug} no puede depender de los crons de Vercel`).not.toBe('vercel')
    }
  })
})
