// Los tres mails que recibe quien descargó la guía y todavía no compró.
//
// Hasta ahora ese circuito terminaba en el PDF: la persona levantaba la mano, recibía la
// guía y no volvía a saber de Micelium nunca más. Lo único que se hacía con ella era
// subirla a Meta como audiencia. Esta secuencia cubre ese hueco.
//
// La regla que los ordena: los tres tienen que servir aunque la persona no compre nunca.
// Se ganan la apertura enseñando algo concreto, no recordando que existe una tienda. El
// producto aparece una sola vez, en el tercero, y como consecuencia de lo que ya se contó
// en los dos anteriores — no como interrupción.
//
// Comparten plantilla, paleta y firma con los mails de cliente, así quien después compra
// no siente que cambió de empresa.
import { fuerte, p, plantilla } from './mails-cliente'

const TIENDA_URL = process.env.TIENDA_URL ?? 'https://infomicelium.com.ar'
const GUIAS_URL = process.env.PUBLIC_BASE_URL ?? 'https://guias.infomicelium.com.ar'

/** El mes en curso, para que el consejo estacional no suene enlatado. */
function mesActual(): string {
  return new Date().toLocaleDateString('es-AR', { month: 'long', timeZone: 'America/Argentina/Cordoba' })
}

/** Sur = casi todo el país; el calendario de cultivo se mueve con la temperatura, no con el mes. */
function esInvierno(): boolean {
  const m = Number(
    new Date().toLocaleDateString('en-US', { month: 'numeric', timeZone: 'America/Argentina/Cordoba' }),
  )
  return m >= 5 && m <= 9
}

/**
 * Día +2 — La contaminación.
 * Es la causa número uno de que el primer cultivo se pierda, y la que más rápido se
 * corrige. Da resultado inmediato: quien aplica esto tiene una experiencia mejor con o
 * sin equipo, y eso es lo que hace que abra el segundo mail.
 */
export function mailLead1(): { subject: string; html: string } {
  return {
    subject: 'Lo que arruina el primer cultivo (y no es la falta de experiencia)',
    html: plantilla(
      'Casi nunca es el micelio: es lo que había en el aire',
      p(
        'Cuando un primer cultivo se pierde, la explicación que la mayoría se da es que le faltó experiencia. Casi nunca es eso.',
      ) +
        p(
          `Lo que pasa es más simple: ${fuerte(
            'el sustrato compite',
          )}. Los mohos verdes y las bacterias crecen mucho más rápido que el micelio, así que si entran en los primeros días, ganan ellos. No hay técnica que lo revierta después.`,
        ) +
        p(
          `Las tres cosas que más lo evitan, en orden de impacto: ${fuerte(
            'manos y superficie desinfectadas',
          )} antes de abrir nada; ${fuerte(
            'aire quieto',
          )} mientras el recipiente está abierto —nada de ventiladores ni ventanas—; y abrir ${fuerte(
            'lo mínimo indispensable',
          )}, una sola vez, con todo lo que vas a usar ya preparado al lado.`,
        ) +
        p(
          'Si en tu guía saltaste directo a la parte de la siembra, volvé a la etapa anterior. Es la que define el resultado.',
        ),
      { texto: 'Ver la guía completa', url: `${GUIAS_URL}/guia/solucion-de-problemas` },
    ),
  }
}

/**
 * Día +6 — Qué conviene cultivar según la época.
 * Responde la pregunta que aparece sola después de leer la guía ("¿y con qué arranco?") y
 * mete por primera vez, sin nombrarla, la idea de que la temperatura manda.
 */
export function mailLead2(): { subject: string; html: string } {
  const invierno = esInvierno()
  return {
    subject: `Con qué conviene arrancar en ${mesActual()}`,
    html: plantilla(
      'No todas las variedades perdonan lo mismo',
      p(
        'Para una primera vez, la variedad importa menos por el sabor que por el margen de error que te deja.',
      ) +
        p(
          `${fuerte(
            'Gírgolas',
          )}: son las más rápidas y las que más aguantan. Colonizan en dos o tres semanas y toleran un rango de temperatura ancho. Es con lo que conviene empezar, sin excepción.`,
        ) +
        p(
          `${fuerte(
            'Melena de león',
          )}: un escalón más arriba. Más lenta y bastante más exigente con la humedad, pero es la que más engancha a quien ya tuvo una cosecha.`,
        ) +
        p(
          `${fuerte(
            'Reishi',
          )}: la más paciente de todas. Meses, no semanas. Vale la pena cuando ya tenés el proceso aceitado.`,
        ) +
        p(
          invierno
            ? `Ahora, en ${mesActual()}, el freno no es la variedad: es el frío. Abajo de 18 °C el micelio no se detiene, pero se vuelve tan lento que le da tiempo a la contaminación a ganarle. Si estás arrancando en esta época, lo primero a resolver es dónde vas a conseguir una temperatura pareja — no cuál variedad elegís.`
            : `En ${mesActual()} el problema es el opuesto: el calor. Arriba de 30 °C el micelio se estresa y la contaminación se acelera. Un lugar fresco y estable rinde más que el mejor sustrato.`,
        ),
      { texto: 'Ver qué se puede cultivar', url: `${GUIAS_URL}/guia/que-se-puede-cultivar` },
    ),
  }
}

/**
 * Día +12 — El puente.
 * Único mail donde aparece el equipo, y aparece como conclusión de los dos anteriores: si
 * la contaminación y la temperatura son lo que define el resultado, entonces sostener el
 * clima es el problema real. Se nombra el precio con transferencia porque es el dato que
 * la persona igual va a ir a buscar, y esconderlo solo agrega un paso.
 */
export function mailLead3(): { subject: string; html: string } {
  return {
    subject: 'Por qué el mismo sustrato da resultados distintos',
    html: plantilla(
      'La variable que casi nadie controla',
      p(
        'Dos personas siembran el mismo día, con el mismo sustrato y la misma variedad. Una cosecha a las cinco semanas y la otra no cosecha nunca. La diferencia rara vez está en lo que hicieron: está en las horas en las que no estaban mirando.',
      ) +
        p(
          `El micelio no responde a la temperatura promedio del día, responde a ${fuerte(
            'la estabilidad',
          )}. Un cuarto que hace 26 °C a la tarde y 12 °C a las cinco de la mañana no da un promedio de 19: da un cultivo frenado que se recupera y se vuelve a frenar todos los días. Ahí es donde se pierde la carrera contra la contaminación.`,
        ) +
        p(
          'Por eso, mientras el clima lo pone la casa, el resultado depende de la época del año y de la suerte. Es la razón por la que tanta gente logra un buen primer cultivo en otoño y después no repite el resultado nunca más.',
        ) +
        p(
          `Micelium® fabrica en Argentina un equipo que se ocupa de eso: sostiene temperatura y humedad parejas todo el ciclo, sin que tengas que estar encima. ${fuerte(
            'Es un electrodoméstico, no un laboratorio',
          )} — se enchufa, se configura una vez y trabaja solo.`,
        ) +
        p(
          'Si hasta acá te sirvió lo que te mandamos, en la ficha está todo: qué incluye, cuánto consume, cómo se usa y qué dicen los que ya cosecharon con él.',
        ),
      { texto: 'Ver la incubadora', url: `${TIENDA_URL}/productos/pack-oferta-incubadora-automatica-inc101/` },
    ),
  }
}
