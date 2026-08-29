// Los tests van sobre `derivarEstado`, que es donde vive toda la decisión. La escritura y
// la lectura de la base son mecánica; lo que se puede razonar mal —y lo que ya se razonó
// mal una vez— es cuándo un job cuenta como caído.
//
// El caso que motivó todo esto: `CronHeartbeat` estuvo vacía desde el 27/07 hasta el
// 31/07 y nadie se enteró. "Nunca reportó" tiene que ser un estado explícito y ruidoso,
// no un vacío que se confunde con silencio sano. De ahí el primer test.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  derivarEstado,
  enCurso,
  horasDesde,
  sinResultado,
  CATALOGO,
  CODIGOS_NO_ARRANCO,
  CODIGOS_SIN_RESULTADO,
  CODIGO_EN_CURSO,
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

// Los dos agujeros del 31/07/2026, que son el mismo error visto de los dos lados: tratar
// como CORRIDA algo que no es el resultado de un trabajo terminado.
//
//  1. Guardarlo como éxito. Una tarea que no arrancaba porque la PC dormía se reportaba
//     con ok=true "para no pintarla de rojo". Como el estado se deriva de la FRESCURA del
//     último reporte, cada intento fallido le renovaba el reloj y la dejaba verde para
//     siempre: micelium_ig_reels_semanal estuvo 5 días parado sin que el panel lo marcara.
//  2. Guardarlo como falla. 0x00041301 ("se está ejecutando ahora") solo dice que el
//     muestreo cayó en el medio de la corrida. Se guardaba como rojo, y condenaba al
//     propio heartbeat, que se muestrea a sí mismo mientras corre y lo devuelve siempre.
describe('lo que no es una corrida terminada no se guarda', () => {
  it('reconoce los códigos de "no llegó a arrancar"', () => {
    expect(sinResultado(-2147020576)).toBe(true) // 0x800710E0, PC suspendida
    expect(sinResultado(267011)).toBe(true) // 0x00041303, nunca corrió
    expect(sinResultado(267045)).toBe(true) // 0x00041325, todavía en cola
  })

  it('reconoce "se está ejecutando ahora" — no es una falla, es un resultado que falta', () => {
    // El agujero espejo. Sin esto el heartbeat se reporta en rojo a sí mismo, siempre.
    expect(sinResultado(267009)).toBe(true) // 0x00041301
  })

  it('no confunde un exit code real con un código sin resultado', () => {
    // En POSIX van de 0 a 255: ningún job puede colisionar con estos códigos.
    for (const code of [0, 1, 2, 127, 255]) expect(sinResultado(code), String(code)).toBe(false)
    expect(sinResultado(undefined)).toBe(false)
    expect(sinResultado(null)).toBe(false)
  })

  it('ningún código sin resultado cabe en el rango de un exit code POSIX', () => {
    // Si alguien agrega uno entre 0 y 255, el guardia del ingest empezaría a descartar
    // corridas reales en silencio. Es el único modo en que esta lista puede hacer daño.
    for (const code of CODIGOS_SIN_RESULTADO) {
      expect(code < 0 || code > 255, `${code} colisiona con un exit code real`).toBe(true)
    }
  })

  it('sin corridas guardadas, un job de Windows termina en "atrasado" — la ausencia es la señal', () => {
    // Este es el comportamiento que el arreglo compra: al no guardar lo que no terminó, el
    // margen del catálogo se agota y el panel lo marca solo.
    const semanal = CATALOGO.micelium_ig_reels_semanal
    const vencido = haceHoras(semanal.maxHoras + 1)
    expect(derivarEstado('micelium_ig_reels_semanal', { inicio: vencido, ok: true }, AHORA))
      .toBe('atrasado')
  })
})

// El tercer capítulo (01/08/2026). Callarse ante 0x00041301 evitaba el rojo falso, pero
// dejaba al panel sin poder decir nada: un job que arrancó hace un minuto se veía igual de
// mudo que uno abandonado. Ahora se muestra 'corriendo', y estos tests fijan los tres
// límites que impiden que "corriendo" se convierta en la próxima mentira tranquilizadora.
describe('estado "corriendo"', () => {
  it('un job sano que está corriendo se muestra "corriendo", no "ok"', () => {
    expect(derivarEstado('send-pending', { inicio: haceHoras(0.5), ok: true }, AHORA, true))
      .toBe('corriendo')
  })

  it('un job que nunca reportó pero está corriendo NO es "nunca"', () => {
    // Es justo el caso que motivó el cambio: arrancó, todavía no hay resultado.
    expect(derivarEstado('send-pending', undefined, AHORA, true)).toBe('corriendo')
  })

  it('"corriendo" NO tapa una falla anterior', () => {
    // Que haya vuelto a arrancar no borra que la última vez terminó mal. El rojo se apaga
    // cuando llega un resultado bueno, no cuando el job hace otro intento.
    expect(derivarEstado('send-pending', { inicio: haceHoras(0.1), ok: false }, AHORA, true))
      .toBe('falla')
  })

  it('"corriendo" tapa "atrasado" — se está poniendo al día, no hay nada que avisar', () => {
    expect(derivarEstado('send-pending', { inicio: haceHoras(30), ok: true }, AHORA, true))
      .toBe('corriendo')
  })

  it('sin la marca, nada cambia respecto de antes', () => {
    // El parámetro es opcional y su ausencia tiene que dar exactamente el estado viejo.
    expect(derivarEstado('send-pending', { inicio: haceHoras(0.5), ok: true }, AHORA))
      .toBe('ok')
    expect(derivarEstado('send-pending', undefined, AHORA)).toBe('nunca')
  })

  it('solo 0x00041301 cuenta como "en curso"', () => {
    expect(enCurso(CODIGO_EN_CURSO)).toBe(true)
    for (const code of CODIGOS_NO_ARRANCO) expect(enCurso(code), String(code)).toBe(false)
    for (const code of [0, 1, 255]) expect(enCurso(code), String(code)).toBe(false)
    expect(enCurso(undefined)).toBe(false)
    expect(enCurso(null)).toBe(false)
  })

  it('"en curso" sigue siendo un código sin resultado: no se guarda como corrida', () => {
    // La separación en dos listas no puede haber sacado a 267009 del guardia del ingest.
    expect(sinResultado(CODIGO_EN_CURSO)).toBe(true)
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

  it('todo job del crontab del VPS está vigilado', () => {
    // EL AGUJERO QUE CIERRA ESTE TEST
    //
    // `agenda_precios_ml` falló seis días seguidos sin que nada avisara. No fue una falla
    // del reporte: `run_job.sh` mandaba el exit≠0 puntualmente a /api/jobs/ingest. El
    // problema es que un slug que el CATALOGO no conoce no lo vigila nadie — se guarda la
    // corrida y ahí muere. Un job puede estar reportando perfectamente y ser invisible.
    //
    // Se descubrió a mano el 22/08/2026, auditando precios de ML por otro motivo. Sin este
    // test, el próximo job que alguien agregue al crontab y olvide acá repite el caso.
    //
    // El fixture es una foto del crontab: el test no puede hacer SSH. Si se agrega un job
    // al VPS hay que regenerarlo (el comando está en la cabecera del archivo), y eso es a
    // propósito — obliga a pasar por acá.
    const crudo = readFileSync(
      join(__dirname, 'fixtures', 'crontab-vps-slugs.txt'),
      'utf-8',
    )
    const delVps = crudo
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))

    expect(delVps.length, 'el fixture quedó vacío: se rompió la captura').toBeGreaterThan(20)

    const sinVigilar = delVps.filter((slug) => !CATALOGO[slug])
    expect(
      sinVigilar,
      `estos jobs corren en el VPS pero no están en CATALOGO, así que pueden fallar en ` +
        `silencio: ${sinVigilar.join(', ')}`,
    ).toEqual([])
  })
})
