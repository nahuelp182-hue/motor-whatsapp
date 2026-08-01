import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Invariantes del proyecto que no son de una función sino de la FORMA del código.
//
// Por qué existen como test y no como una nota en CLAUDE.md: una nota se lee si alguien la
// busca; esto falla en CI. Es la diferencia entre "está escrito que no se hace" y "no se
// puede hacer".
//
// Cada invariante de acá nació de un error real, no de una preferencia de estilo.

const RAIZ = join(__dirname, '..')
const CARPETAS = ['app', 'lib', 'services', 'components']

function archivosFuente(): string[] {
  const out: string[] = []
  const recorrer = (dir: string) => {
    for (const entrada of readdirSync(dir)) {
      if (entrada === 'node_modules' || entrada.startsWith('.')) continue
      const ruta = join(dir, entrada)
      if (statSync(ruta).isDirectory()) recorrer(ruta)
      else if (/\.tsx?$/.test(entrada)) out.push(ruta)
    }
  }
  for (const c of CARPETAS) recorrer(join(RAIZ, c))
  return out
}

/**
 * El código de un archivo sin sus comentarios. Los invariantes de acá buscan patrones que no
 * se deben USAR; un comentario que EXPLICA por qué no se usan no es una infracción, y sin
 * esto el propio comentario que documenta la regla la hace fallar.
 */
function codigoSinComentarios(ruta: string): string {
  return readFileSync(ruta, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '') // bloques
    .replace(/^\s*\/\/.*$/gm, '') // líneas sueltas
}

describe('un solo pool de Postgres', () => {
  // EL ERROR QUE ESTO PREVIENE
  //
  // Había SEIS `new pg.Pool` en el proyecto: dos en lib/ y cuatro copiados dentro de rutas.
  // Cada uno con max:1, así que una lambda que tocara varios módulos abría una conexión por
  // módulo y el techo del pooler de Supabase se alcanzaba con una fracción del tráfico.
  //
  // Es un error invisible: el código funciona perfecto en desarrollo y con poco tráfico.
  // Aparece como lentitud y errores de conexión intermitentes justo cuando hay carga, que
  // es cuando menos ganas hay de diagnosticarlo.
  //
  // Y es fácil de repetir: la forma natural de necesitar una consulta cruda en una ruta
  // nueva es copiar el getPool() de la ruta de al lado.
  it('nadie construye un pool fuera de lib/db.ts y lib/prisma.ts', () => {
    const permitidos = [join('lib', 'db.ts'), join('lib', 'prisma.ts')]

    const infractores = archivosFuente().filter((ruta) => {
      const relativa = ruta.slice(RAIZ.length + 1)
      if (permitidos.some((p) => relativa === p)) return false
      return /new\s+(pg\.)?Pool\s*\(/.test(readFileSync(ruta, 'utf8'))
    })

    expect(
      infractores.map((r) => r.slice(RAIZ.length + 1)),
      'Usar `getPool()` de @/lib/db en vez de construir un pool nuevo',
    ).toEqual([])
  })
})

describe('los crons se autorizan solos', () => {
  // EL ERROR QUE ESTO PREVIENE
  //
  // Tres rutas de cron usaban `if (process.env.CRON_SECRET && ...)`: si la variable faltaba,
  // quedaban PÚBLICAS. Cualquiera con la URL podía disparar los envíos de WhatsApp.
  //
  // Ahora todas pasan por chequearCron(), que falla cerrado. Este test es lo que impide que
  // una ruta nueva se olvide: es exactamente el tipo de cosa que no se nota al escribirla,
  // porque la ruta funciona igual de bien sin la línea.
  it('toda ruta bajo /api/cron llama a chequearCron', () => {
    const dirCron = join(RAIZ, 'app', 'api', 'cron')
    const rutas: string[] = []
    const recorrer = (dir: string) => {
      for (const entrada of readdirSync(dir)) {
        const ruta = join(dir, entrada)
        if (statSync(ruta).isDirectory()) recorrer(ruta)
        else if (entrada === 'route.ts') rutas.push(ruta)
      }
    }
    recorrer(dirCron)

    expect(rutas.length).toBeGreaterThan(0) // que el test no pase por no encontrar nada

    const sinChequeo = rutas.filter((r) => !readFileSync(r, 'utf8').includes('chequearCron'))

    expect(
      sinChequeo.map((r) => r.slice(RAIZ.length + 1)),
      'Toda ruta de cron tiene que empezar con: const noAuth = chequearCron(req); if (noAuth) return noAuth',
    ).toEqual([])
  })
})

describe('la cola no se lee sin tomarla', () => {
  // EL ERROR QUE ESTO PREVIENE
  //
  // El consumidor viejo hacía findMany({ estado: 'PENDING' }) y mandaba. Dos corridas
  // solapadas leían las MISMAS filas y el cliente recibía el mensaje dos veces.
  //
  // La corrección fue tomar las filas con FOR UPDATE SKIP LOCKED. Este test detecta si
  // alguien "simplifica" eso de vuelta a una lectura común — un cambio que parece inocente
  // y cuyo síntoma le llega al cliente, no a los logs.
  it('tomarLote usa FOR UPDATE SKIP LOCKED', () => {
    const fuente = readFileSync(join(RAIZ, 'lib', 'cola-envios.ts'), 'utf8')
    expect(fuente).toContain('FOR UPDATE SKIP LOCKED')
  })
})

describe('el canal de un evento vive en la columna, no en el detalle', () => {
  // EL ERROR QUE ESTO PREVIENE
  //
  // Hasta el 01/08/2026 el canal se marcaba metiendo `ch: 'wa'` adentro del JSON de detalle
  // de ig_diag, y se leía con `detail->>'ch' = 'wa'`. Dos consecuencias, las dos reales:
  //
  // 1. Solo WhatsApp ponía la marca. Instagram y Messenger quedaban indistinguibles entre sí
  //    y del WhatsApp anterior al 11/07, así que la tabla mostraba un total sano que era todo
  //    WhatsApp. El webhook de Instagram estuvo TRES SEMANAS sin recibir un mensaje y no
  //    saltó nada.
  // 2. Al mover la marca a la columna `canal`, cuatro consultas seguían filtrando por el JSON
  //    y se quedaban vacías en silencio — entre ellas el panel /conversaciones, que es donde
  //    se leen las charlas con los clientes. Una convención repartida en seis archivos se
  //    rompe en cinco cuando cambia.
  //
  // Nadie debería volver a decidir el canal leyendo o escribiendo el detalle.
  it('nadie lee el canal desde el JSON de detalle', () => {
    const culpables = archivosFuente().filter((f) => codigoSinComentarios(f).includes("->>'ch'"))
    expect(
      culpables.map((f) => f.slice(RAIZ.length + 1)),
      "El canal se filtra con `canal = 'wa'`, no con `detail->>'ch'`",
    ).toEqual([])
  })

  it('nadie escribe el canal dentro del detalle', () => {
    const culpables = archivosFuente().filter((f) => /\bch:\s*'(wa|ig|messenger|web)'/.test(codigoSinComentarios(f)))
    expect(
      culpables.map((f) => f.slice(RAIZ.length + 1)),
      'El canal va como 4º argumento de diag(kind, sender, detail, canal), no adentro de detail',
    ).toEqual([])
  })
})
