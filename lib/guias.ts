// Contenido de la capa pública de guías.
//
// Por qué contenido tipado y no markdown suelto: la medición mostró que el problema del
// manual en PDF no era el formato del archivo, era que toda la información pesaba lo mismo.
// Un bloque `vital` no se puede confundir con un párrafo, y el índice puede ordenar por
// importancia sin que nadie se acuerde de hacerlo a mano.
//
// Todo bloque marcado con `verificar: true` sale renderizado con una marca visible: son
// datos técnicos que tiene que confirmar Nahuel antes de publicar. Inventar una temperatura
// o una potencia sería peor que no tener la página.

export type Bloque =
  | { tipo: 'parrafo'; texto: string }
  | { tipo: 'vital'; numero: number; titulo: string; texto: string }
  | { tipo: 'pasos'; items: string[] }
  | { tipo: 'aviso'; tono: 'cuidado' | 'dato'; texto: string }
  | { tipo: 'faq'; items: Array<{ p: string; r: string }> }
  | { tipo: 'datos'; filas: Array<{ clave: string; valor: string; verificar?: boolean }> }

export type Seccion = { id: string; titulo: string; bloques: Bloque[] }

export type Guia = {
  slug: string
  titulo: string
  /** Bajada editorial: lo primero que se lee, tiene que valer por sí solo. */
  resumen: string
  /** Volanta corta que ubica la página dentro del recorrido. */
  eyebrow: string
  intencion: 'informacional' | 'comercial'
  actualizado: string
  /** Cuántos mensajes reales de WhatsApp resuelve esta página (de la medición 21/07/2026). */
  mensajesQueResuelve: number
  secciones: Seccion[]
  relacionadas?: string[]
}

// ─────────────────────────────────────────────────────────────────────────────

const insumos: Guia = {
  slug: 'donde-conseguir-insumos',
  titulo: 'Qué necesitás además del equipo',
  eyebrow: 'Antes de empezar',
  resumen:
    'La incubadora controla el ambiente. El material de cultivo lo conseguís aparte, y esa ' +
    'separación es a propósito. Acá está qué hace falta, por qué no lo vendemos y qué mirar ' +
    'para elegir bien.',
  intencion: 'informacional',
  actualizado: '2026-07-21',
  mensajesQueResuelve: 26,
  secciones: [
    {
      id: 'que-vendemos',
      titulo: 'Qué vendemos y qué no',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Diseñamos y fabricamos equipos: la incubadora sostiene la temperatura y la humedad ' +
            'estables el tiempo que dura el cultivo. Eso es lo que hacemos y es lo único que ' +
            'vendemos.',
        },
        {
          tipo: 'parrafo',
          texto:
            'No vendemos material de cultivo. No es una limitación: es una decisión. El material ' +
            'vivo viaja mal, pierde calidad en el camino y su estado depende de cómo se conserve ' +
            'cada día. Prefiramos hacernos responsables de lo que sí podemos controlar de punta a ' +
            'punta.',
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'Si alguien te vende el equipo y el material juntos, preguntá quién se hace cargo ' +
            'cuando el cultivo falla. Separar las dos cosas hace que cada parte se pueda revisar.',
        },
      ],
    },
    {
      id: 'las-tres-patas',
      titulo: 'Las tres patas de un cultivo que sale bien',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Un cultivo se sostiene sobre tres cosas, y si falta una no hay forma de compensarla ' +
            'con las otras dos. Vale la pena tenerlo claro antes de comprar nada.',
        },
        {
          tipo: 'pasos',
          items: [
            'Material de calidad. Lo conseguís vos, y es lo que más varía entre un resultado y otro.',
            'Ambiente estable. Es lo que resuelve el equipo: temperatura y humedad sin sobresaltos.',
            'Conocimiento. Saber qué mirar y cuándo. Está en estas guías y no se cobra aparte.',
          ],
        },
      ],
    },
    {
      id: 'como-elegir',
      titulo: 'Cómo elegir el material',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'No recomendamos proveedores puntuales, porque la calidad de cada uno cambia con el ' +
            'tiempo y no podemos garantizar algo que no controlamos. Lo que sí podemos darte es ' +
            'qué preguntar antes de comprar.',
        },
        {
          tipo: 'faq',
          items: [
            {
              p: '¿De cuándo es el material?',
              r: 'Es material vivo. Cuanto más reciente, mejor arranca. Un proveedor serio te dice la fecha sin que se la pidas dos veces.',
            },
            {
              p: '¿Cómo viajó y cómo se conservó?',
              r: 'El calor en tránsito arruina material que salió perfecto. Preguntá cómo lo despachan, sobre todo en verano.',
            },
            {
              p: '¿Qué especie es, exactamente?',
              r: 'Cada especie tiene su propia ventana de temperatura. Sin saber cuál es, no hay forma de configurar bien el equipo.',
            },
          ],
        },
      ],
    },
  ],
  relacionadas: ['los-dos-vitales'],
}

const vitales: Guia = {
  slug: 'los-dos-vitales',
  titulo: 'Las dos cosas que definen el resultado',
  eyebrow: 'Lo esencial',
  resumen:
    'De todo lo que se puede hacer bien o mal, dos cosas explican casi todos los cultivos que ' +
    'fracasan. Si te ocupás de estas dos, el resto es cuestión de esperar.',
  intencion: 'informacional',
  actualizado: '2026-07-21',
  mensajesQueResuelve: 97,
  secciones: [
    {
      id: 'los-dos',
      titulo: 'Los dos vitales',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Las guías largas tienen un problema: todo parece igual de importante. No lo es. ' +
            'Estas dos cosas concentran la mayoría de los cultivos que se pierden.',
        },
        {
          tipo: 'vital',
          numero: 1,
          titulo: 'Sanidad',
          texto:
            'Todo lo que toca el cultivo tiene que estar limpio, incluidas tus manos y el aire ' +
            'del ambiente donde trabajás. La contaminación no avisa: aparece cuando ya no se ' +
            'puede revertir. Es el momento donde más se gana siendo obsesivo.',
        },
        {
          tipo: 'vital',
          numero: 2,
          titulo: 'La ventana de temperatura de tu especie',
          texto:
            'Cada especie tiene un rango donde avanza bien. Fuera de ese rango no se muere de ' +
            'golpe: se frena, y ahí es cuando otra cosa le gana el lugar. Averiguá el rango de tu ' +
            'especie antes de arrancar y configurá el equipo una sola vez.',
        },
      ],
    },
    {
      id: 'los-tiempos',
      titulo: 'Los tiempos: la regla de 2 a 3 semanas',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Cada etapa lleva entre dos y tres semanas. Es la regla más útil que te podemos dar, ' +
            'porque convierte la ansiedad en un dato: si pasaron diez días y no ves cambios, no ' +
            'pasa nada. Si pasaron cuatro semanas y sigue igual, algo hay que revisar.',
        },
        {
          tipo: 'aviso',
          tono: 'cuidado',
          texto:
            'El diagnóstico es binario: va bien o va mal. No hay término medio ni cultivo que ' +
            '"esté raro pero zafa". Si dudás, escribinos con los días que pasaron desde que ' +
            'armaste, la temperatura que marca el equipo y en qué zona del país estás. Con esos ' +
            'tres datos se resuelve casi siempre.',
        },
      ],
    },
  ],
  relacionadas: ['donde-conseguir-insumos'],
}

const equipo: Guia = {
  slug: 'como-funciona-la-incubadora',
  titulo: 'Cómo funciona la incubadora',
  eyebrow: 'El equipo',
  resumen:
    'Qué hace el equipo mientras vos no estás mirando, qué decisiones toma solo y qué queda ' +
    'de tu lado.',
  intencion: 'comercial',
  actualizado: '2026-07-21',
  mensajesQueResuelve: 153,
  secciones: [
    {
      id: 'que-hace',
      titulo: 'Qué resuelve',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Un cultivo necesita condiciones parejas durante semanas. El problema no es lograrlas ' +
            'un rato: es sostenerlas de noche, cuando baja la temperatura, y en los días en que ' +
            'no estás en casa. Eso es exactamente lo que hace el equipo.',
        },
        {
          tipo: 'parrafo',
          texto:
            'Vos configurás el rango una vez. A partir de ahí mantiene la temperatura, sostiene ' +
            'la humedad y renueva el aire, sin que tengas que revisarlo todos los días.',
        },
      ],
    },
    {
      id: 'ficha',
      titulo: 'Ficha técnica del INC101',
      bloques: [
        {
          tipo: 'datos',
          filas: [
            { clave: 'Medidas exteriores', valor: '40 cm alto × 36 cm ancho × 26 cm profundidad' },
            {
              clave: 'Capacidad interior',
              valor: 'Área útil de cultivo 35 × 25 × 30 cm (≈ 26 litros)',
            },
            {
              clave: 'Cuánto entra',
              valor: '15 frascos, o 4 recipientes tipo bandeja de 1,5 litros (dos columnas de dos)',
            },
            { clave: 'Consumo eléctrico', valor: '20 a 30 W (el máximo, en clima muy frío)' },
            { clave: 'Rango de temperatura', valor: 'Mantiene entre 10 °C y 30 °C' },
            { clave: 'Humedad', valor: 'Booster de humedad regulable (paso a paso en el manual)' },
            { clave: 'Renovación de aire', valor: 'Renovación pasiva por aire caliente' },
            {
              clave: 'Garantía',
              valor: '12 meses de fábrica, y después servicio técnico oficial y repuestos de por vida',
            },
          ],
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'La garantía es de un año, pero el equipo no deja de tener soporte cuando se vence: ' +
            'seguimos con repuestos y servicio técnico oficial mientras lo tengas. Es la ' +
            'diferencia entre comprarle a una fábrica y comprarle a un revendedor.',
        },
      ],
    },
    {
      id: 'preguntas',
      titulo: 'Lo que más nos preguntan',
      bloques: [
        {
          tipo: 'faq',
          items: [
            {
              p: '¿Anda con energía solar?',
              r: 'Sí. Consume entre 20 y 30 W, así que es de los equipos que un sistema solar hogareño puede sostener sin problema, incluso funcionando las 24 horas.',
            },
            {
              p: '¿Enfría o solo calienta?',
              r: 'El INC101 solo calienta: sostiene la temperatura por encima de la del ambiente, hasta 30 °C. No refrigera. Si estás en una zona donde en verano se pasa de 30 °C de forma sostenida, escribinos antes de comprar y lo hablamos con tu caso.',
            },
            {
              p: '¿Viene con material para empezar?',
              r: 'No. El equipo controla el ambiente; el material de cultivo lo conseguís aparte. Está explicado en «Qué necesitás además del equipo».',
            },
          ],
        },
      ],
    },
  ],
  relacionadas: ['donde-conseguir-insumos', 'los-dos-vitales'],
}

const cultivar: Guia = {
  slug: 'que-se-puede-cultivar',
  titulo: 'Qué se puede cultivar',
  eyebrow: 'Qué esperar',
  resumen:
    'Qué especies andan bien en el equipo, cuáles son las más fáciles para arrancar y qué ' +
    'rinde cada una. Una idea realista antes de empezar.',
  intencion: 'informacional',
  actualizado: '2026-07-21',
  mensajesQueResuelve: 36,
  secciones: [
    {
      id: 'especies',
      titulo: 'Las especies que recomendamos',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'El equipo sirve para cultivar hongos comestibles y funcionales. Estas son las que ' +
            'mejor resultado dan y con las que más acompañamiento tenemos:',
        },
        {
          tipo: 'pasos',
          items: [
            'Gírgolas: las más fáciles y las más perdonadoras. Si es tu primera vez, empezá por acá.',
            'Melena de león: un poco más exigente, muy buscada por su uso funcional.',
            'Reishi: la más lenta, para quien ya tomó la mano.',
          ],
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'Cada especie tiene su propia ventana de temperatura. El equipo la sostiene, pero el ' +
            'rango se lo tenés que indicar vos según lo que cultives. Está en la guía «Las dos ' +
            'cosas que definen el resultado».',
        },
      ],
    },
    {
      id: 'rinde',
      titulo: '¿Cuánto rinde y cuánto tarda?',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Depende de la especie y del material con el que arranques, pero la regla de los ' +
            'tiempos es pareja: cada etapa lleva entre dos y tres semanas. Del armado a la ' +
            'cosecha, contá varias semanas, no días.',
        },
        {
          tipo: 'faq',
          items: [
            {
              p: '¿Sirve si nunca cultivé nada?',
              r: 'Sí. La mayoría de nuestros clientes arrancó sin experiencia. Empezando por gírgolas y siguiendo las guías, se llega. Lo importante son las dos cosas de siempre: sanidad y temperatura.',
            },
            {
              p: '¿Puedo cultivar todo el año?',
              r: 'Sí, esa es la idea del equipo: mantiene las condiciones aunque afuera cambie el clima. En verano, si tu zona pasa de 30 °C sostenidos, escribinos antes (el INC101 calienta, no refrigera).',
            },
          ],
        },
      ],
    },
  ],
  relacionadas: ['los-dos-vitales', 'donde-conseguir-insumos'],
}

const problemas: Guia = {
  slug: 'solucion-de-problemas',
  titulo: 'Cuando algo va mal',
  eyebrow: 'Diagnóstico',
  resumen:
    'Los tres problemas más comunes y qué hacer con cada uno: contaminación, el equipo que no ' +
    'levanta temperatura y la condensación. Diagnóstico directo, sin vueltas.',
  intencion: 'informacional',
  actualizado: '2026-07-21',
  mensajesQueResuelve: 40,
  secciones: [
    {
      id: 'contaminacion',
      titulo: 'Se contaminó',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Si aparece moho verde, negro o rosado, o un olor feo, el cultivo está contaminado. ' +
            'Es la causa número uno de los cultivos que se pierden, y es honesto decirlo: cuando ' +
            'la contaminación se ve, ya no se revierte. Ese cultivo se descarta.',
        },
        {
          tipo: 'aviso',
          tono: 'cuidado',
          texto:
            'Lo que importa no es salvar ese intento, es entender por qué pasó para que no se ' +
            'repita. Casi siempre es sanidad (algo entró sin estar limpio) o temperatura fuera de ' +
            'rango demasiado tiempo. Si te pasó, escribinos con los días desde el armado, la ' +
            'temperatura del equipo y tu zona, y lo vemos con tu caso.',
        },
      ],
    },
    {
      id: 'no-calienta',
      titulo: 'El equipo no levanta temperatura',
      bloques: [
        {
          tipo: 'pasos',
          items: [
            'Confirmá que esté bien enchufado y encendido, y que la temperatura objetivo esté por encima de la del ambiente.',
            'Verificá que la sonda de temperatura esté colocada donde indica el manual: si mide mal, regula mal.',
            'Dale tiempo: levantar temperatura no es instantáneo, sobre todo en un día frío.',
          ],
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'Si hiciste todo esto y sigue sin calentar, puede ser una falla del equipo. Escribinos: ' +
            'tenés 12 meses de garantía de fábrica y después servicio técnico oficial y repuestos ' +
            'de por vida.',
        },
      ],
    },
    {
      id: 'condensacion',
      titulo: 'Se junta mucha agua (condensación)',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Algo de condensación es normal en el proceso. Se vuelve un problema cuando es tanta ' +
            'que gotea sobre el cultivo y favorece la contaminación. Suele pasar más en zonas frías ' +
            'o húmedas, donde la diferencia de temperatura con el ambiente es mayor.',
        },
        {
          tipo: 'faq',
          items: [
            {
              p: '¿Cómo la manejo?',
              r: 'PENDIENTE: Nahuel, indicá el procedimiento concreto (ventilación, posición de recipientes, ajuste del booster) para no dar un consejo genérico. Está en el manual pero conviene resumir los 2-3 pasos clave acá.',
            },
          ],
        },
      ],
    },
  ],
  relacionadas: ['los-dos-vitales'],
}

const comprar: Guia = {
  slug: 'como-comprar',
  titulo: 'Cómo comprar',
  eyebrow: 'Tu compra',
  resumen:
    'Medios de pago, cuotas y la diferencia por transferencia. El precio actualizado siempre ' +
    'está en la tienda.',
  intencion: 'comercial',
  actualizado: '2026-07-21',
  mensajesQueResuelve: 78,
  secciones: [
    {
      id: 'donde',
      titulo: 'Dónde se compra',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'La compra es en nuestra tienda oficial, infomicelium.com.ar. Ahí está siempre el ' +
            'precio vigente y el stock real; por eso no ponemos el número acá, para que no te ' +
            'encuentres con un valor viejo.',
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'Comprás directo a la fábrica. No somos revendedores: el equipo lo diseñamos y lo ' +
            'hacemos nosotros, y por eso el soporte y los repuestos salen de la misma mano.',
        },
      ],
    },
    {
      id: 'pagos',
      titulo: 'Formas de pago',
      bloques: [
        {
          tipo: 'faq',
          items: [
            {
              p: '¿Con qué puedo pagar?',
              r: 'Con Mercado Pago (tarjeta de crédito, débito o dinero en cuenta) y por transferencia bancaria.',
            },
            {
              p: '¿Hay cuotas?',
              r: 'PENDIENTE: Nahuel, confirmá cuántas cuotas y si son sin interés, para responderlo con precisión (aparece mucho: «no me da la opción de 6 cuotas»).',
            },
            {
              p: '¿Conviene pagar por transferencia?',
              r: 'PENDIENTE: confirmar el porcentaje de descuento por transferencia para poder decirlo con el número exacto.',
            },
          ],
        },
      ],
    },
  ],
  relacionadas: ['envios-y-seguimiento', 'como-funciona-la-incubadora'],
}

const envios: Guia = {
  slug: 'envios-y-seguimiento',
  titulo: 'Envíos y seguimiento',
  eyebrow: 'Tu envío',
  resumen:
    'Cómo despachamos, a dónde llegamos y cómo seguir tu pedido. Y qué hacer si el seguimiento ' +
    'no se mueve.',
  intencion: 'informacional',
  actualizado: '2026-07-21',
  mensajesQueResuelve: 57,
  secciones: [
    {
      id: 'como',
      titulo: 'Cómo y a dónde enviamos',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Enviamos a todo el país por Andreani. Apenas despachamos tu pedido te llega el número ' +
            'de seguimiento para que veas dónde está en cada momento.',
        },
        {
          tipo: 'faq',
          items: [
            {
              p: '¿Cuánto tarda en llegar?',
              r: 'PENDIENTE: Nahuel, indicá el rango de días hábiles típico (varía por zona) para no prometer algo que no se cumpla.',
            },
            {
              p: '¿Cuánto cuesta el envío?',
              r: 'PENDIENTE: confirmar si es gratis, con cargo, o según zona; el costo exacto figura en la tienda al finalizar la compra.',
            },
          ],
        },
      ],
    },
    {
      id: 'seguimiento',
      titulo: 'Si el seguimiento no se mueve',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'A veces el estado de Andreani queda unos días sin actualizarse aunque el paquete esté ' +
            'en camino. No es lo ideal, pero pasa y en general se destraba solo.',
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'Si ya pasaron varios días sin movimiento, escribinos con tu número de pedido o de ' +
            'seguimiento y hacemos el reclamo por vos. No tenés que quedarte esperando sin ' +
            'respuesta.',
        },
      ],
    },
  ],
  relacionadas: ['como-comprar'],
}

const sobre: Guia = {
  slug: 'sobre-micelium',
  titulo: 'Quiénes somos',
  eyebrow: 'Micelium',
  resumen:
    'Somos una fábrica argentina de equipos de cultivo. Qué significa eso para vos, antes y ' +
    'después de comprar.',
  intencion: 'informacional',
  actualizado: '2026-07-21',
  mensajesQueResuelve: 5,
  secciones: [
    {
      id: 'quienes',
      titulo: 'Una fábrica, no una reventa',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Diseñamos y fabricamos nosotros mismos las incubadoras. No revendemos un producto de ' +
            'otro: cada equipo sale de nuestro trabajo, y eso cambia todo lo que viene después de ' +
            'la compra.',
        },
        {
          tipo: 'pasos',
          items: [
            'El soporte lo da quien hizo el equipo, no un intermediario que no lo conoce.',
            'Los repuestos existen y van a seguir existiendo: garantía de 12 meses y servicio técnico oficial de por vida.',
            'El acompañamiento del cultivo es parte de la compra, no un extra que se cobra aparte.',
          ],
        },
      ],
    },
    {
      id: 'confianza',
      titulo: 'Por qué lo contamos así',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Sabemos que comprar algo así por internet da un poco de vértigo. Por eso preferimos ' +
            'ser claros de entrada: qué hace el equipo, qué necesitás además, qué pasa si algo ' +
            'sale mal. Toda esta información es pública justamente para que decidas con datos, no ' +
            'con promesas.',
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'Cualquier duda, el asistente responde al instante y, si hace falta, te pasa con una ' +
            'persona del equipo.',
        },
      ],
    },
  ],
  relacionadas: ['como-funciona-la-incubadora', 'como-comprar'],
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Orden deliberado: de "conocer" a "operar". Sirve al visitante frío (funciona → qué cultivar
 * → qué necesita → comprar → envío) y al comprador (vitales, problemas). Lo esencial primero.
 */
export const GUIAS: Guia[] = [
  vitales,
  equipo,
  cultivar,
  insumos,
  comprar,
  envios,
  problemas,
  sobre,
]

export function getGuia(slug: string): Guia | undefined {
  return GUIAS.find(g => g.slug === slug)
}

/**
 * Serializa todas las guías a texto plano para dárselas de contexto al asistente. Se cachea
 * en el prompt (cache_control), así que este texto viaja una vez y las siguientes respuestas
 * salen ~10x más baratas. A esta escala (3 guías) no hace falta base vectorial: entra entero.
 */
export function guiasParaPrompt(): string {
  const partes: string[] = []
  for (const g of GUIAS) {
    partes.push(`\n═══ GUÍA: ${g.titulo} (URL: /guia/${g.slug}) ═══`)
    partes.push(g.resumen)
    for (const s of g.secciones) {
      partes.push(`\n## ${s.titulo}`)
      for (const b of s.bloques) {
        switch (b.tipo) {
          case 'parrafo':
            partes.push(b.texto)
            break
          case 'vital':
            partes.push(`VITAL ${b.numero} — ${b.titulo}: ${b.texto}`)
            break
          case 'pasos':
            partes.push(b.items.map((t, i) => `${i + 1}. ${t}`).join('\n'))
            break
          case 'aviso':
            partes.push(`(${b.tono === 'cuidado' ? 'IMPORTANTE' : 'Nota'}) ${b.texto}`)
            break
          case 'faq':
            partes.push(
              b.items
                .map(it => {
                  // Las respuestas marcadas PENDIENTE son notas internas para Nahuel, no
                  // contenido: el asistente NO debe leerlas ni repetirlas. Se le indica derivar.
                  const r = it.r.startsWith('PENDIENTE')
                    ? '(dato aún no confirmado — si preguntan esto, derivá al equipo por WhatsApp, no inventes)'
                    : it.r
                  return `P: ${it.p}\nR: ${r}`
                })
                .join('\n'),
            )
            break
          case 'datos':
            partes.push(b.filas.map(f => `${f.clave}: ${f.verificar ? '(sin confirmar)' : f.valor}`).join('\n'))
            break
        }
      }
    }
  }
  return partes.join('\n')
}

export function tienePendientes(g: Guia): boolean {
  return g.secciones.some(s =>
    s.bloques.some(
      b =>
        (b.tipo === 'datos' && b.filas.some(f => f.verificar)) ||
        (b.tipo === 'faq' && b.items.some(i => i.r.startsWith('PENDIENTE'))),
    ),
  )
}
