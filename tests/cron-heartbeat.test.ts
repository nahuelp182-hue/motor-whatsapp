// Los tests van sobre `derivarEstado`, que es donde vive toda la decisión. La escritura y
// la lectura de la base son mecánica; lo que se puede razonar mal —y lo que ya se razonó
// mal una vez— es cuándo un job cuenta como caído.
//
// El caso que motivó todo esto: `CronHeartbeat` estuvo vacía desde el 27/07 hasta el
// 31/07 y nadie se enteró. "Nunca reportó" tiene que ser un estado explícito y ruidoso,
// no un vacío que se confunde con silencio sano. De ahí el primer test.
import { describe, it, expect } from 'vitest'
import {
  derivarEstado,
  horasDesde,
  noLlegoACorrer,
  CATALOGO,
  CODIGOS_NO_ARRANCO,
} from '@/lib/cron-heartbeat'

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

// El segundo agujero, del 31/07/2026: una tarea de Windows que no arrancaba porque la PC
// dormía se reportaba igual con ok=true "para no pintarla de rojo". Como el estado se
// deriva de la FRESCURA del último reporte, cada intento fallido le renovaba el reloj y la
// dejaba verde para siempre. micelium_ig_reels_semanal estuvo 5 días parado sin que el
// panel lo marcara. Verde por no haber corrido es peor que rojo por haber fallado.
describe('no_arranco no cuenta como corrida', () => {
  it('reconoce los códigos del Programador que significan "no llegó a arrancar"', () => {
    expect(noLlegoACorrer(-2147020576)).toBe(true) // 0x800710E0, PC suspendida
    expect(noLlegoACorrer(267011)).toBe(true) // 0x00041303, nunca corrió
    expect(noLlegoACorrer(267045)).toBe(true) // 0x00041325, todavía en cola
  })

  it('no confunde un exit code real con un "no arrancó"', () => {
    // En POSIX van de 0 a 255: ningún job puede colisionar con estos códigos.
    for (const code of [0, 1, 2, 127, 255]) expect(noLlegoACorrer(code), String(code)).toBe(false)
    expect(noLlegoACorrer(undefined)).toBe(false)
    expect(noLlegoACorrer(null)).toBe(false)
  })

  it('ningún código de "no arrancó" cabe en el rango de un exit code POSIX', () => {
    // Si alguien agrega uno entre 0 y 255, el guardia del ingest empezaría a descartar
    // corridas reales en silencio. Es el único modo en que esta lista puede hacer daño.
    for (const code of CODIGOS_NO_ARRANCO) {
      expect(code < 0 || code > 255, `${code} colisiona con un exit code real`).toBe(true)
    }
  })

  it('sin corridas guardadas, un job de Windows termina en "atrasado" — la ausencia es la señal', () => {
    // Este es el comportamiento que el arreglo compra: al no guardar los intentos fallidos,
    // el margen del catálogo se agota y el panel lo marca solo.
    const semanal = CATALOGO.micelium_ig_reels_semanal
    const vencido = haceHoras(semanal.maxHoras + 1)
    expect(derivarEstado('micelium_ig_reels_semanal', { inicio: vencido, ok: true }, AHORA))
      .toBe('atrasado')
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
