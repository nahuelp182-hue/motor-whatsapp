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
  // Cronograma del cultivo: qué pasa cada día. Es lo que más pide el cliente que ya compró,
  // porque convierte la ansiedad ("¿esto va bien?") en una referencia contra la que comparar.
  | {
      tipo: 'cronograma'
      filas: Array<{ etapa: string; dias: string; que: string; ojo?: string }>
    }
  // Precio leído de Tiendanube al renderizar. Nunca se escribe a mano: se ajusta 2 veces por
  // mes y un número viejo en una guía genera un reclamo.
  | { tipo: 'precio' }

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
  /**
   * PRIVADA = solo para quien compró (requiere sesión de cliente). No se indexa, no aparece
   * en el índice público y el asistente en modo frío ni la ve. Acá va el material detallado
   * de los manuales: es parte de lo que el cliente pagó, no contenido de captación.
   */
  privada?: boolean
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
          tipo: 'pasos',
          items: [
            'Revisá la cúpula: un poco de vaho es normal, el problema son las gotas cayendo sobre el sustrato.',
            'Si hay agua en exceso, escurrí el recipiente de cultivo.',
            'Secá la base de la incubadora, que es donde se junta el agua que baja.',
            'No destapes ni rocíes para "ventilar": la ventilación es pasiva, por los orificios con cinta Micropore.',
          ],
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'Pasa más en zonas frías o húmedas, donde la diferencia con la temperatura ambiente ' +
            'es mayor. Si se repite seguido, escribinos y lo vemos con tu caso.',
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
    'El precio de hoy, los medios de pago y las opciones de envío. Todo se lee de la tienda en ' +
    'el momento, así que es lo que vas a pagar.',
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
            'La compra se hace en nuestra tienda oficial, infomicelium.com.ar. El precio que ves ' +
            'más abajo se lee de ahí en el momento, así que nunca vas a encontrar un valor viejo ' +
            'en esta página.',
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
      id: 'precio',
      titulo: 'Precio de hoy',
      bloques: [
        { tipo: 'precio' },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'Este precio se lee de la tienda en el momento, así que es el que vas a pagar. Si ves ' +
            'un valor distinto en otro lado, el que vale es el de la tienda.',
        },
      ],
    },
    {
      id: 'pagos',
      titulo: 'Formas de pago',
      bloques: [
        {
          tipo: 'datos',
          filas: [
            { clave: 'Mercado Pago', valor: 'Tarjeta de crédito, débito y efectivo (Rapipago / Pago Fácil)' },
            { clave: 'Transferencia o depósito', valor: 'Bancario, directo a nuestra cuenta' },
            { clave: 'PayPal', valor: 'Para compras desde el exterior' },
          ],
        },
        {
          tipo: 'faq',
          items: [
            {
              p: '¿En cuántas cuotas puedo pagar?',
              r: 'Las cuotas y los planes vigentes los pone Mercado Pago según tu tarjeta y el banco, y cambian seguido. Los vas a ver en pantalla al momento de pagar, antes de confirmar la compra.',
            },
            {
              p: '¿Conviene pagar por transferencia?',
              r: 'PENDIENTE: confirmar el porcentaje de descuento por transferencia para poder decirlo con el número exacto.',
            },
            {
              p: '¿Y si me arrepiento?',
              r: 'Tenés 30 días de devolución. Somos los fabricantes, así que la garantía y el soporte los damos nosotros directamente.',
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
            'Enviamos a todo el país. Podés elegir entre estas opciones al finalizar la compra, y ' +
            'apenas despachamos te llega el número de seguimiento.',
        },
        {
          tipo: 'datos',
          filas: [
            { clave: 'Andreani', valor: 'A domicilio o a sucursal' },
            { clave: 'Correo Argentino', valor: 'A domicilio o a sucursal' },
            { clave: 'Retiro en Córdoba', valor: 'FONOPACK — Terminal de Ómnibus, Bv. Perón 380, Centro' },
          ],
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'Retiro en Córdoba: de lunes a viernes de 9 a 18 h, y sábados de 9 a 12 h.',
        },
        {
          tipo: 'faq',
          items: [
            {
              p: '¿Cuánto cuesta el envío?',
              r: 'El costo exacto depende de tu código postal y de la opción que elijas: lo ves en pantalla al finalizar la compra, antes de pagar. En varias promociones el envío va bonificado.',
            },
            {
              p: '¿Cuánto tarda en llegar?',
              r: 'PENDIENTE: Nahuel, indicá el rango de días hábiles típico (varía por zona) para no prometer algo que no se cumpla.',
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

// ═════════════════════════════════════════════════════════════════════════════
// GUÍAS PRIVADAS — solo para clientes verificados. Contenido de los manuales reales
// (MANUAL DE USUARIO INC101 2026 + GUIA DE CULTIVO INC101). Este material es parte de lo
// que el cliente pagó: no se indexa ni se muestra al público.
// ═════════════════════════════════════════════════════════════════════════════

const manualEquipo: Guia = {
  slug: 'manual-inc101',
  titulo: 'Manual de uso del INC101',
  eyebrow: 'Tu equipo · Manual',
  resumen:
    'Todo el funcionamiento del equipo, paso a paso: qué viene en la caja, cómo armarlo, ' +
    'cómo configurar la temperatura, cómo usar el booster y qué NO hacer nunca.',
  intencion: 'informacional',
  actualizado: '2026-07-22',
  mensajesQueResuelve: 97,
  privada: true,
  secciones: [
    {
      id: 'caja',
      titulo: '1. Qué hay en la caja',
      bloques: [
        { tipo: 'parrafo', texto: 'Al abrir el paquete vas a encontrar tres elementos:' },
        {
          tipo: 'pasos',
          items: [
            'Cúpula transparente (la tapa).',
            'Base de la incubadora (la parte negra con la pantalla).',
            'Booster de humedad (bolsa negra tipo sobre).',
          ],
        },
      ],
    },
    {
      id: 'montaje',
      titulo: '2. Montaje paso a paso',
      bloques: [
        { tipo: 'parrafo', texto: 'Seguí este orden para evitar errores:' },
        {
          tipo: 'pasos',
          items: [
            'Ubicación: colocá la base sobre una superficie nivelada, seca y limpia.',
            'Sonda: fijá la sonda de temperatura (leé la alerta de abajo antes de seguir).',
            'Cúpula: colocá la cúpula sobre la base, con los orificios de ventilación hacia atrás.',
            'Energía: conectá la incubadora a la red eléctrica.',
            'Configuración: establecé la temperatura que necesites.',
          ],
        },
      ],
    },
    {
      id: 'sonda',
      titulo: '3. La sonda: lo más importante de todo',
      bloques: [
        {
          tipo: 'aviso',
          tono: 'cuidado',
          texto:
            'Leé esto con atención: de acá depende la vida de tu equipo y de tu cultivo. La sonda ' +
            'de temperatura es el cerebro que le dice al equipo cuándo dejar de calentar.',
        },
        {
          tipo: 'vital',
          numero: 1,
          titulo: 'La sonda va SIEMPRE pegada a la base',
          texto:
            'Adherida a la base, dentro de la bandeja, con cinta adhesiva. Nunca colgando ni al ' +
            'aire. Si está mal colocada, el equipo no sabe qué temperatura hay: calienta sin ' +
            'parar y puede quemar el equipo o tu cultivo.',
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'Cada vez que muevas el cultivo o coloques el booster, verificá que la sonda siga en ' +
            'su lugar. Es el error más caro y el más fácil de evitar.',
        },
      ],
    },
    {
      id: 'temperatura',
      titulo: '4. Control de temperatura',
      bloques: [
        {
          tipo: 'aviso',
          tono: 'cuidado',
          texto:
            'El equipo CALIENTA y mantiene la temperatura, pero NO ENFRÍA. Si en tu casa hay ' +
            '28 °C, la incubadora no puede bajar de esa temperatura.',
        },
        { tipo: 'parrafo', texto: 'Cómo configurarla, desde el menú F1:' },
        {
          tipo: 'pasos',
          items: [
            'Mantené presionado el botón SET unos segundos, hasta que aparezca «F1».',
            'Presioná SET otra vez y usá las flechas ▲ ▼ para elegir la temperatura.',
            'Para guardar, presioná el botón de encendido.',
            'Dejá F2, F3 y F4 como vienen de fábrica: no hace falta tocarlos.',
          ],
        },
      ],
    },
    {
      id: 'booster',
      titulo: '5. Uso del booster de humedad',
      bloques: [
        {
          tipo: 'aviso',
          tono: 'cuidado',
          texto:
            'El booster se usa SOLO en la etapa de fructificación. Durante la incubación ' +
            '(colonización) NO se usa.',
        },
        {
          tipo: 'pasos',
          items: [
            'Preparación del agua: en un recipiente con agua, agregá 3 gotas de lavandina por cada litro. El cloro sanitiza el booster y previene contaminaciones.',
            'Sumergí el booster en esa agua durante 15 a 20 minutos.',
            'Escurrí apretando suavemente, hasta que deje de chorrear.',
            'Colocá el booster sobre la base negra, y tu cultivo encima del booster.',
          ],
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'Al colocar el booster, controlá de nuevo que la sonda haya quedado en su lugar.',
        },
        {
          tipo: 'faq',
          items: [
            {
              p: '¿Cada cuánto lo rehidrato?',
              r: 'Cada 6 o 7 días, para sostener la humedad en el rango de fructificación.',
            },
            {
              p: '¿Puedo abrirlo o esterilizarlo con calor?',
              r: 'No. Nunca abras la bolsa del booster, y bajo ningún concepto lo pongas en microondas ni en horno: lo destruís.',
            },
            {
              p: '¿Cómo lo guardo cuando termino el cultivo?',
              r: 'Dejalo secar al sol antes de guardarlo. Si lo guardás húmedo, atrae contaminantes para el próximo uso.',
            },
          ],
        },
      ],
    },
    {
      id: 'ventilacion',
      titulo: '6. Ventilación',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Los orificios (que van hacia atrás) se cubren con cinta Micropore. La ventilación ' +
            'del cultivo es pasiva: no hace falta destapar ni abrir el recipiente.',
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'Mantenimiento: cambiá la cinta solo si después de varios meses la ves cargada de ' +
            'polvo o pelusa.',
        },
      ],
    },
    {
      id: 'extras',
      titulo: '7. Modo deshidratador y limpieza',
      bloques: [
        {
          tipo: 'parrafo',
          texto: 'El equipo también seca tus setas. Para usarlo como deshidratador:',
        },
        {
          tipo: 'pasos',
          items: [
            'Pegá bien la sonda a la base con cinta.',
            'Cubrí la bandeja con servilletas de papel.',
            'Colocá las setas encima.',
            'Configurá la temperatura a 40 °C.',
          ],
        },
        {
          tipo: 'faq',
          items: [
            { p: 'Limpieza del equipo', r: 'Desconectá SIEMPRE antes de limpiar. Usá un trapo apenas húmedo. Nunca viertas agua directamente sobre la base negra.' },
            { p: 'Limpieza de la cúpula', r: 'Se puede limpiar con alcohol o detergente suave, y secar con papel.' },
          ],
        },
      ],
    },
  ],
  relacionadas: ['cultivo-paso-a-paso', 'solucion-de-problemas'],
}

const cultivoDetallado: Guia = {
  slug: 'cultivo-paso-a-paso',
  titulo: 'Cultivo paso a paso',
  eyebrow: 'Tu equipo · Cultivo',
  resumen:
    'El proceso completo con tiempos, temperaturas y cantidades exactas: preparación, montaje, ' +
    'colonización, fructificación y cómo sacarle hasta tres cosechas al mismo sustrato.',
  intencion: 'informacional',
  actualizado: '2026-07-22',
  mensajesQueResuelve: 40,
  privada: true,
  secciones: [
    {
      id: 'antes',
      titulo: '1. Antes de empezar',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'El cultivo tiene tres etapas: colonización (el micelio cubre el sustrato), ' +
            'fructificación (aparecen los hongos) y cosecha, que se puede repetir varias veces ' +
            'con el mismo sustrato.',
        },
        {
          tipo: 'parrafo',
          texto:
            'Elegí un lugar limpio, tranquilo y sin corrientes de aire, con una superficie lisa ' +
            'y fácil de limpiar (una mesa de cocina sirve).',
        },
        {
          tipo: 'pasos',
          items: [
            'Materiales: frascos de sustrato y micelio, cuchara, tenedor, servilletas de papel y guantes descartables.',
            'Desinfectantes: alcohol al 70 % y solución de lavandina al 10 % (1 parte de lavandina, 9 de agua).',
            'Un recipiente amplio para mezclar (bandeja o tupper grande) y un atomizador de agua.',
          ],
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'Si todavía no vas a usar el kit, guardá los frascos de micelio y sustrato en la ' +
            'heladera, entre 3 y 5 °C, y no los abras hasta el momento de armar.',
        },
      ],
    },
    {
      id: 'higiene',
      titulo: '2. Higiene: donde se gana o se pierde',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'El cultivo es muy sensible a la contaminación, y casi todos los que fracasan ' +
            'fracasan acá. El orden importa:',
        },
        {
          tipo: 'pasos',
          items: [
            'Lavate las manos con jabón antibacterial y poné guantes descartables.',
            'Limpiá utensilios y superficies con solución de lavandina al 10 %.',
            'Después rociá alcohol al 70 % sobre las áreas y utensilios: elimina esporas que la lavandina no alcanza.',
            'Dejá actuar los desinfectantes al menos 5 minutos antes de empezar.',
          ],
        },
      ],
    },
    {
      id: 'colonizacion',
      titulo: '3. Colonización',
      bloques: [
        {
          tipo: 'datos',
          filas: [
            { clave: 'Temperatura', valor: '27 a 28 °C' },
            { clave: 'Luz', valor: 'Oscuridad total' },
            { clave: 'Duración', valor: '7 a 15 días (puede estirarse según condiciones)' },
            { clave: 'Booster', valor: 'NO se usa en esta etapa' },
          ],
        },
        {
          tipo: 'parrafo',
          texto:
            'Colocá el recipiente en la incubadora y no lo muevas. El micelio va cubriendo el ' +
            'sustrato de blanco, de a poco y de forma pareja.',
        },
        {
          tipo: 'aviso',
          tono: 'cuidado',
          texto:
            'Señales de que algo va mal: manchas verdes, negras o rosadas, o mal olor. Eso es ' +
            'contaminación y ese cultivo no se recupera. Retiralo, limpiá bien el área y ' +
            'escribinos para revisar qué pasó antes del próximo intento.',
        },
      ],
    },
    {
      id: 'fructificacion',
      titulo: '4. Fructificación',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Cuando el sustrato está completamente colonizado (blanco y denso), se pasa a la ' +
            'etapa donde aparecen los hongos. Arranca con un shock térmico.',
        },
        {
          tipo: 'pasos',
          items: [
            'Shock térmico: llevá el recipiente cerrado a la heladera, entre 3 y 5 °C, durante 24 horas. Simula el cambio de estación y despierta la fructificación.',
            'Hidratá el booster y colocalo sobre la base, con el cultivo encima.',
            'Colocá el recipiente bajo la cúpula, sin tapa.',
            'Ajustá la temperatura y dejá que el equipo trabaje.',
          ],
        },
        {
          tipo: 'datos',
          filas: [
            { clave: 'Temperatura', valor: '20 a 27 °C — ideal 24 °C' },
            { clave: 'Humedad', valor: '80 a 90 % (la sostiene el booster)' },
            { clave: 'Luz', valor: '12 h de luz indirecta y 12 h de oscuridad (no necesita ser exacto)' },
            { clave: 'Ventilación', valor: 'Pasiva, por los orificios con Micropore' },
            { clave: 'Rehidratar booster', valor: 'Cada 6 a 7 días' },
          ],
        },
        {
          tipo: 'aviso',
          tono: 'cuidado',
          texto:
            'No pases de 27 °C: por encima de esa temperatura la formación de setas se inhibe. Y ' +
            'no rocíes agua ni destapes el recipiente para ventilar — el equipo ya lo resuelve solo.',
        },
        {
          tipo: 'faq',
          items: [
            {
              p: '¿Cuándo aparecen los primeros hongos?',
              r: 'Entre los días 10 y 15 de esta etapa aparecen los pines (puntitos blancos) y después los primordios (setas bebé). No manipules el cultivo mientras tanto.',
            },
            {
              p: 'Se junta mucha agua en la cúpula, ¿está mal?',
              r: 'Algo de condensación es normal. Si ves gotas en exceso sobre el sustrato, escurrí el recipiente y secá la base de la incubadora, que retiene agua.',
            },
            {
              p: '¿Cuándo cosecho?',
              r: 'Cuando el sombrero se abre y el velo se despega. Cosechá una por una, girando suavemente desde la base. No uses cuchillo: dañás el micelio que todavía tiene que darte más cosechas.',
            },
          ],
        },
      ],
    },
    {
      id: 'cronograma',
      titulo: '5. Cronograma: qué esperar cada día',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Esta es la referencia para saber si vas bien. Si tu cultivo está dentro de estos ' +
            'rangos, andá tranquilo aunque parezca que no pasa nada.',
        },
        {
          tipo: 'cronograma',
          filas: [
            {
              etapa: 'Armado',
              dias: 'Día 1',
              que: 'Mezclás sustrato y micelio con todo desinfectado.',
              ojo: 'Anotá la fecha y sacá una foto. Te va a servir para comparar.',
            },
            {
              etapa: 'Colonización',
              dias: 'Días 2 a 20',
              que: 'El recipiente va a la incubadora a 27-28 °C, en oscuridad. No lo muevas.',
              ojo: 'Foto cada 5 días. El blanco avanza parejo.',
            },
            {
              etapa: 'Shock térmico',
              dias: 'Día 21',
              que: 'Recipiente cerrado a la heladera (3-5 °C) por 24 horas.',
              ojo: 'Es lo que activa la fructificación.',
            },
            {
              etapa: 'Fructificación',
              dias: 'Días 22 a 35',
              que: 'Vuelve a la incubadora con el booster hidratado, 24 °C y 80-90 % de humedad.',
              ojo: 'Los pines aparecen entre el día 10 y 15 de esta etapa.',
            },
            {
              etapa: 'Primera cosecha',
              dias: 'Días 35 a 40',
              que: 'Cosechás cuando el sombrero abre y el velo se despega.',
              ojo: 'De a una, girando desde la base.',
            },
            {
              etapa: 'Siguientes cosechas',
              dias: 'Días 41 a 50',
              que: 'Rehidratás el sustrato y repetís el shock térmico.',
              ojo: 'Un cultivo sano da hasta 3 cosechas.',
            },
          ],
        },
      ],
    },
    {
      id: 'flushes',
      titulo: '6. Cómo sacar más cosechas del mismo sustrato',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Después de la primera cosecha, el micelio sigue vivo y puede darte hasta tres ' +
            'oleadas. La clave es rehidratarlo bien.',
        },
        {
          tipo: 'pasos',
          items: [
            'Preparación: herví agua y dejala enfriar. Agregá 1 ml de agua oxigenada por cada litro.',
            'Volcá esa mezcla sobre el sustrato hasta que el pan flote completamente.',
            'Tapá el recipiente y llevalo a la heladera (3-5 °C) por 24 horas.',
            'Sacalo, eliminá el exceso de agua y escurrí unos minutos hasta que deje de gotear.',
            'Volvé a las condiciones de fructificación: 24 °C, booster hidratado, luz 12/12.',
          ],
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'Se puede repetir para cada oleada. En general un cultivo saludable rinde hasta 3 ' +
            'cosechas; después el sustrato se agota y conviene arrancar uno nuevo.',
        },
      ],
    },
  ],
  relacionadas: ['manual-inc101', 'solucion-de-problemas'],
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
  // Privadas (solo clientes verificados), al final: no se listan en el índice público.
  manualEquipo,
  cultivoDetallado,
]

/** Las que ve cualquiera: índice público, sitemap, asistente en modo frío. */
export const GUIAS_PUBLICAS = GUIAS.filter(g => !g.privada)

/** Las del cliente: material de los manuales, detrás de sesión. */
export const GUIAS_PRIVADAS = GUIAS.filter(g => g.privada)

export function getGuia(slug: string): Guia | undefined {
  return GUIAS.find(g => g.slug === slug)
}

/**
 * Serializa todas las guías a texto plano para dárselas de contexto al asistente. Se cachea
 * en el prompt (cache_control), así que este texto viaja una vez y las siguientes respuestas
 * salen ~10x más baratas. A esta escala (3 guías) no hace falta base vectorial: entra entero.
 */
export function guiasParaPrompt(incluirPrivadas = false): string {
  const partes: string[] = []
  // En modo frío el asistente NO recibe el material de los manuales: es contenido del cliente.
  for (const g of incluirPrivadas ? GUIAS : GUIAS_PUBLICAS) {
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
          case 'cronograma':
            partes.push(
              b.filas.map(f => `${f.etapa} (${f.dias}): ${f.que}${f.ojo ? ` — ${f.ojo}` : ''}`).join('\n'),
            )
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
