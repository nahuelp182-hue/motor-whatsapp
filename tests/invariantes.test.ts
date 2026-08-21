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

describe('el webhook de WhatsApp tiene techo de gasto', () => {
  // EL ERROR QUE ESTO PREVIENE
  //
  // Hasta el 01/08/2026 el webhook de WhatsApp no tenía NINGÚN tope. Dieciséis rutas del
  // proyecto usaban consumirLimite —asistente, lead, acceso, contacto, track, resena— y
  // justo la única que llama a Claude por cada mensaje ajeno, no.
  //
  // Es la ruta que recibe el tráfico de los anuncios click-to-WhatsApp: el gasto lo dispara
  // un tercero, no nosotros. Un número que insiste, un auto-responder ajeno que entra en
  // loop o alguien jugando con el bot consumían la API de Anthropic sin techo, y el aviso
  // llegaba al día siguiente por el mail de resumen — después de gastado.
  //
  // El modo `rechazar` es la otra mitad y por eso se verifica aparte: con el default
  // (`permitir`), una caída de la base desactiva los dos topes en silencio, que es
  // exactamente cuando menos mirando estás.
  const RUTA_WA = join(RAIZ, 'app', 'api', 'webhooks', 'whatsapp', 'route.ts')

  it('consume cupo antes de llamar al modelo', () => {
    const codigo = codigoSinComentarios(RUTA_WA)
    expect(codigo, 'El webhook de WhatsApp tiene que consumir cupo antes de pensar')
      .toContain('consumirLimite(')
  })

  it('los topes fallan cerrados', () => {
    const codigo = codigoSinComentarios(RUTA_WA)
    // Se mira la ventana que sigue a cada llamada en vez de intentar cerrar el paréntesis
    // con una regex: los argumentos traen paréntesis propios (`${hoyISO()}`) y cualquier
    // match no-greedy corta antes de tiempo. Falló así al escribirlo.
    const trozos = codigo.split('consumirLimite(').slice(1)
    expect(trozos.length).toBeGreaterThan(0)
    const abiertas = trozos.filter((t) => !t.slice(0, 220).includes("'rechazar'"))
    expect(
      abiertas.map((t) => t.slice(0, 60).replace(/\s+/g, ' ')),
      "Los topes de esta ruta protegen plata: van en modo 'rechazar'. Ver lib/ratelimit.ts",
    ).toEqual([])
  })

  it('hay un tope por número y otro global', () => {
    const codigo = codigoSinComentarios(RUTA_WA)
    expect(codigo, 'Falta el tope por número: un solo cliente no puede consumir la cuenta')
      .toMatch(/wa:num:/)
    expect(codigo, 'Falta el tope global: muchos números chicos suman igual')
      .toMatch(/wa:global:/)
  })
})

describe('una derivación se detecta de una sola forma', () => {
  // EL ERROR QUE ESTO PREVIENE
  //
  // Al escribir el seguimiento de CTWA (01/08/2026) filtré las conversaciones ya derivadas
  // con `kind IN ('derivado', 'handoff_activo')`. El kind 'derivado' NO EXISTE: la
  // derivación se marca sobre 'pensado' con detail->>'derivar' = 'true', que es como la
  // lee ultimaDerivacion() en lib/diag.ts.
  //
  // Lo grave no es el typo: es que la query seguía siendo SQL válida y devolvía filas.
  // El filtro simplemente no excluía a nadie, nunca. Un cron que le escribe a gente que
  // ya está hablando con una persona, y ni un error en los logs. Lo encontré consultando
  // la base —había 0 filas de ese kind—, no leyendo el código.
  //
  // Un filtro que no filtra es peor que no tenerlo, porque parece que está.
  it("nadie inventa un kind 'derivado'", () => {
    const culpables = archivosFuente().filter((f) =>
      /kind\s*(?:=|IN\s*\()[^)\n]*'derivado'/.test(codigoSinComentarios(f)))
    expect(
      culpables.map((f) => f.slice(RAIZ.length + 1)),
      "La derivación se lee con kind='pensado' AND detail->>'derivar'='true'. Ver ultimaDerivacion() en lib/diag.ts",
    ).toEqual([])
  })

  // La primera versión de este test marcaba cualquier archivo que nombrara
  // 'handoff_activo' en una query, y pescó app/api/conversaciones/route.ts —que lo usa
  // para DIBUJAR el panel, no para excluir a nadie—. Un invariante con falsos positivos se
  // termina desactivando, así que queda acotado al contexto donde vive el error: excluir.
  it('quien EXCLUYE conversaciones derivadas usa la convención real', () => {
    const infractores = archivosFuente().filter((f) => {
      const c = codigoSinComentarios(f)
      const bloques = c.match(/NOT EXISTS \([\s\S]{0,400}?\)\)/g) ?? []
      return bloques.some((b) => b.includes('handoff_activo') && !b.includes("'derivar'"))
    })
    expect(
      infractores.map((f) => f.slice(RAIZ.length + 1)),
      'Excluir solo por handoff_activo deja pasar las derivaciones normales, que son la mayoría',
    ).toEqual([])
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

describe('el freno de "patina" mide repetición, no cantidad de turnos', () => {
  // EL ERROR QUE ESTO PREVIENE
  //
  // El freno original (20/08/2026) contaba respuestas "libres" seguidas con
  // contarAccionReciente(from, respuesta_libre), sin mirar su contenido. El 21/08 se vio
  // el efecto en producción: el saludo-menú y el listado de productos TAMBIÉN son
  // respuesta_libre, así que un cliente nuevo que navegaba el menú quemaba los dos créditos
  // antes de preguntar nada. Tres personas que pidieron el precio de la INC101 fueron
  // derivadas en el tercer mensaje, antes de recibirlo, y ninguna volvió a escribir.
  //
  // Ahora el freno compara el CONTENIDO (contarRespuestaRepetida) y exime al menú
  // (esRespuestaDeMenu). Lo que hay que sostener es que esas dos piezas sigan cableadas: si
  // alguien vuelve a contar turnos, el bot vuelve a cortar ventas sin un solo error visible.
  it('el freno compara el contenido de la respuesta, no cuenta acciones', () => {
    const codigo = readFileSync(join(RAIZ, 'app', 'api', 'webhooks', 'whatsapp', 'route.ts'), 'utf8')
    expect(
      codigo,
      'El freno volvió a contar turnos (contarAccionReciente) en vez de comparar contenido',
    ).not.toMatch(/contarAccionReciente\(from,\s*.respuesta_libre/)
    expect(
      codigo.includes('contarRespuestaRepetida('),
      'Falta contarRespuestaRepetida: el freno de patina quedó sin medición',
    ).toBe(true)
  })

  it('el menú y el catálogo quedan exentos del freno', () => {
    const codigo = readFileSync(join(RAIZ, 'app', 'api', 'webhooks', 'whatsapp', 'route.ts'), 'utf8')
    expect(
      codigo.includes('esRespuestaDeMenu(respuesta)'),
      'Sin la exención del menú, el flujo de venta vuelve a derivarse solo',
    ).toBe(true)
  })
})
