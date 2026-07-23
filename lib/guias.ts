// Contenido de la capa pública de guías.
//
// Por qué contenido tipado y no markdown suelto: la medición mostró que el problema del
// manual en PDF no era el formato del archivo, era que toda la información pesaba lo mismo.
// Un bloque `vital` no se puede confundir con un párrafo, y el índice puede ordenar por
// importancia sin que nadie se acuerde de hacerlo a mano.
//
// Registro editorial: cercano pero profesional. Voseo sí (es el registro rioplatense
// natural), coloquialismo no. La terminología técnica se usa —micelio, sustrato,
// colonización, fructificación, primordios— y se aclara la primera vez que aparece.
// El lector es aficionado, no ignorante: escribirle como si fuera una charla de café
// resta autoridad y es el error típico del texto generado sin criterio.
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
  // Ficha comparativa de especies. Es el bloque que más decide una compra: el visitante no
  // pregunta "cómo funciona", pregunta "qué puedo cultivar YO, donde vivo, en esta época".
  // Los rangos térmicos siguen los parámetros de Paul Stamets (Growing Gourmet and Medicinal
  // Mushrooms, 3.ª ed.), acotados a lo que el INC101 puede sostener: calienta, no refrigera.
  | {
      tipo: 'especies'
      filas: Array<{
        nombre: string
        cientifico: string
        nivel: 'inicial' | 'intermedia' | 'avanzada'
        colonizacion: string
        fructificacion: string
        ciclo: string
        nota: string
      }>
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
    'La incubadora controla el ambiente de cultivo. El material biológico —micelio y ' +
    'sustrato— se adquiere por separado, y esa separación es deliberada. Acá está qué hace ' +
    'falta, por qué no lo comercializamos y qué criterios usar para elegirlo.',
  intencion: 'informacional',
  actualizado: '2026-07-21',
  mensajesQueResuelve: 26,
  secciones: [
    {
      id: 'que-vendemos',
      titulo: 'Qué fabricamos y qué no',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Diseñamos y fabricamos equipos de cultivo. La incubadora sostiene temperatura y ' +
            'humedad estables durante todo el ciclo, que es la variable ambiental de la que ' +
            'depende el resultado. Ese es nuestro rubro y es lo único que comercializamos.',
        },
        {
          tipo: 'parrafo',
          texto:
            'No vendemos material biológico. No es una limitación operativa: es una decisión. ' +
            'El micelio es un organismo vivo, se degrada en el transporte y su viabilidad ' +
            'depende de la cadena de conservación día a día. Preferimos responder por aquello ' +
            'que podemos controlar de punta a punta.',
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'Cuando un mismo proveedor vende el equipo y el material biológico juntos, conviene ' +
            'preguntar quién responde ante un cultivo fallido. Separar ambas cosas permite ' +
            'auditar cada parte por separado.',
        },
      ],
    },
    {
      id: 'las-tres-patas',
      titulo: 'Los tres factores que determinan el resultado',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Un cultivo se sostiene sobre tres factores. No son intercambiables: la carencia de ' +
            'uno no se compensa reforzando los otros dos. Conviene tenerlos claros antes de ' +
            'realizar cualquier compra.',
        },
        {
          tipo: 'pasos',
          items: [
            'Material biológico de calidad. Se adquiere por separado y es la variable de mayor dispersión entre un resultado y otro.',
            'Ambiente estable. Es lo que resuelve el equipo: temperatura y humedad sin oscilaciones.',
            'Conocimiento del proceso. Saber qué observar y en qué momento. Está en estas guías, incluido en la compra.',
          ],
        },
      ],
    },
    {
      id: 'como-elegir',
      titulo: 'Cómo evaluar al proveedor de material',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'No recomendamos proveedores puntuales: la calidad de cada uno varía con el tiempo y ' +
            'no podemos garantizar un proceso que no controlamos. Lo que sí podemos aportar son ' +
            'los criterios técnicos para evaluarlos.',
        },
        {
          tipo: 'faq',
          items: [
            {
              p: '¿Cuál es la fecha de elaboración del material?',
              r: 'Es material vivo y su vigor decae con el tiempo de almacenamiento. Cuanto más reciente, mejor implantación inicial. Un proveedor serio informa la fecha sin que haya que insistir.',
            },
            {
              p: '¿Cómo se transporta y se conserva?',
              r: 'La exposición al calor durante el tránsito compromete material que salió en perfectas condiciones. Conviene consultar el método de despacho, especialmente en verano.',
            },
            {
              p: '¿De qué especie se trata, con precisión?',
              r: 'Cada especie tiene su propio rango óptimo de temperatura. Sin ese dato no hay forma de configurar correctamente el equipo.',
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
  titulo: 'Las dos variables que definen el resultado',
  eyebrow: 'Lo esencial',
  resumen:
    'Entre todo lo que puede hacerse bien o mal, dos variables explican la mayor parte de los ' +
    'cultivos fallidos: la asepsia y la temperatura. Controladas esas dos, el resto del ' +
    'proceso es cuestión de respetar los tiempos.',
  intencion: 'informacional',
  actualizado: '2026-07-21',
  mensajesQueResuelve: 97,
  secciones: [
    {
      id: 'los-dos',
      titulo: 'Los dos factores críticos',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Las guías extensas comparten un defecto: presentan toda la información con el mismo ' +
            'peso. No lo tiene. Estas dos variables concentran la mayoría de los cultivos que se ' +
            'pierden.',
        },
        {
          tipo: 'vital',
          numero: 1,
          titulo: 'Asepsia',
          texto:
            'Todo lo que entra en contacto con el cultivo debe estar desinfectado, incluidas las ' +
            'manos y el aire del ambiente de trabajo. La contaminación por mohos competidores no ' +
            'da señales tempranas: se hace visible cuando ya es irreversible. Es la instancia ' +
            'donde el rigor tiene mayor retorno.',
        },
        {
          tipo: 'vital',
          numero: 2,
          titulo: 'El rango térmico de la especie',
          texto:
            'Cada especie tiene un rango de temperatura en el que el micelio —la red de ' +
            'filamentos blancos que coloniza el sustrato— se desarrolla con vigor. Fuera de ese ' +
            'rango no muere de inmediato: se ralentiza, y esa demora es la que aprovechan los ' +
            'organismos competidores. Averiguá el rango de tu especie antes de iniciar y ' +
            'configurá el equipo una sola vez.',
        },
      ],
    },
    {
      id: 'los-tiempos',
      titulo: 'Los tiempos: la referencia de 2 a 3 semanas',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Cada etapa del ciclo demanda entre dos y tres semanas. Es la referencia más útil ' +
            'que podemos darte, porque convierte la incertidumbre en un parámetro verificable: ' +
            'si pasaron diez días sin cambios visibles, está dentro de lo esperado. Si pasaron ' +
            'cuatro semanas sin avance, corresponde revisar las condiciones.',
        },
        {
          tipo: 'aviso',
          tono: 'cuidado',
          texto:
            'El diagnóstico es binario: el cultivo progresa o está comprometido. No existe un ' +
            'estado intermedio recuperable. Ante la duda, escribinos indicando los días ' +
            'transcurridos desde el armado, la temperatura que registra el equipo y tu zona ' +
            'geográfica. Con esos tres datos el caso se resuelve en la mayoría de las consultas.',
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
    'Qué regula el equipo de forma autónoma, qué variables controla sin intervención y qué ' +
    'queda a cargo del usuario.',
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
            'Un cultivo requiere condiciones ambientales estables durante varias semanas. La ' +
            'dificultad no está en alcanzarlas puntualmente, sino en sostenerlas durante la ' +
            'noche, cuando cae la temperatura, y en los días de ausencia. Esa es la función del ' +
            'equipo.',
        },
        {
          tipo: 'parrafo',
          texto:
            'El rango se configura una sola vez. A partir de ahí el equipo mantiene la ' +
            'temperatura, sostiene la humedad relativa y renueva el aire, sin requerir control ' +
            'diario.',
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
              clave: 'Capacidad de carga',
              valor: '15 frascos, o 4 recipientes tipo bandeja de 1,5 litros (dos columnas de dos)',
            },
            { clave: 'Consumo eléctrico', valor: '25 W promedio por hora' },
            {
              clave: 'Temperatura de cultivo',
              valor: 'Sostiene el ambiente entre 10 °C y 30 °C, el rango útil para cultivo',
            },
            { clave: 'Temperatura máxima', valor: 'El equipo alcanza los 42 °C' },
            { clave: 'Humedad relativa', valor: 'Hasta 85 % con el booster de humedad' },
            { clave: 'Renovación de aire', valor: 'Pasiva, por convección del aire caliente' },
            {
              clave: 'Garantía',
              valor: '12 meses de fábrica, y luego servicio técnico oficial y repuestos de por vida',
            },
          ],
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'La garantía cubre 12 meses, pero el soporte no se interrumpe al vencerla: ' +
            'continuamos proveyendo repuestos y servicio técnico oficial mientras conserves el ' +
            'equipo. Es la diferencia entre comprarle al fabricante y comprarle a un revendedor.',
        },
      ],
    },
    {
      id: 'preguntas',
      titulo: 'Consultas frecuentes',
      bloques: [
        {
          tipo: 'faq',
          items: [
            {
              p: '¿Funciona con energía solar?',
              r: 'Sí. El consumo promedio es de 25 W por hora, de modo que un sistema solar hogareño lo sostiene sin inconvenientes, incluso en operación continua las 24 horas.',
            },
            {
              p: '¿Refrigera o solo calienta?',
              r: 'El INC101 es un equipo calefactor: sostiene la temperatura por encima de la ambiente, no refrigera. Si tu zona supera los 30 °C de forma sostenida en verano, escribinos antes de comprar y evaluamos tu caso.',
            },
            {
              p: '¿Cuál es la temperatura máxima?',
              r: 'El equipo alcanza 42 °C, aunque el rango de uso para cultivo es de 10 a 30 °C: por encima de ese valor el desarrollo se inhibe. Los 42 °C se aprovechan, por ejemplo, en el modo deshidratador.',
            },
            {
              p: '¿Incluye material para iniciar el cultivo?',
              r: 'No. El equipo controla el ambiente; el material biológico se adquiere por separado. El criterio está desarrollado en «Qué necesitás además del equipo».',
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
    'Nueve especies comestibles y funcionales con sus rangos térmicos, su nivel de exigencia y ' +
    'su ciclo real. Incluye qué especies de moda no son cultivables en una incubadora —y por ' +
    'qué— y qué conviene cultivar en cada estación del año en Argentina.',
  intencion: 'informacional',
  actualizado: '2026-07-22',
  mensajesQueResuelve: 36,
  secciones: [
    {
      id: 'especies',
      titulo: 'Especies recomendadas',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'El equipo está diseñado para especies comestibles y funcionales. La tabla que sigue ' +
            'reúne las que se desarrollan bien en un ambiente de 26 litros con humedad ' +
            'controlada, con el dato que efectivamente decide el resultado: el rango térmico de ' +
            'cada etapa. Los parámetros siguen los publicados por Paul Stamets en Growing ' +
            'Gourmet and Medicinal Mushrooms, contrastados con nuestra experiencia de ' +
            'acompañamiento en cultivos argentinos.',
        },
        {
          tipo: 'especies',
          filas: [
            {
              nombre: 'Gírgola común',
              cientifico: 'Pleurotus ostreatus',
              nivel: 'inicial',
              colonizacion: '24 °C',
              fructificacion: '15 a 21 °C',
              ciclo: '4 a 6 semanas',
              nota:
                'La especie de mayor tolerancia a desvíos en las condiciones y la de colonización ' +
                'más veloz. Es la indicada para un primer cultivo, y la que usamos como referencia ' +
                'en todas las guías.',
            },
            {
              nombre: 'Gírgola rosada',
              cientifico: 'Pleurotus djamor',
              nivel: 'inicial',
              colonizacion: '27 a 30 °C',
              fructificacion: '21 a 30 °C',
              ciclo: '3 a 4 semanas',
              nota:
                'La única del grupo que fructifica cómoda en pleno verano argentino: su rango ' +
                'coincide con el ambiente de diciembre a febrero. Ciclo muy corto y color rosado ' +
                'intenso. Se deteriora rápido tras la cosecha, así que se consume en el día.',
            },
            {
              nombre: 'Gírgola de verano',
              cientifico: 'Pleurotus pulmonarius',
              nivel: 'inicial',
              colonizacion: '24 a 27 °C',
              fructificacion: '18 a 24 °C',
              ciclo: '4 a 5 semanas',
              nota:
                'Rango intermedio entre la común y la rosada, lo que la vuelve la más versátil ' +
                'para media estación. Rinde bien en sustratos de paja y de aserrín.',
            },
            {
              nombre: 'Melena de león',
              cientifico: 'Hericium erinaceus',
              nivel: 'intermedia',
              colonizacion: '21 a 24 °C',
              fructificacion: '18 a 24 °C',
              ciclo: '5 a 7 semanas',
              nota:
                'La más demandada por su uso funcional (contiene hericenonas y erinacinas, ' +
                'compuestos estudiados por su acción sobre el factor de crecimiento nervioso). Es ' +
                'sensible a la acumulación de CO₂: con ventilación escasa desarrolla forma ' +
                'coraloide, ramificada, en lugar de la cascada de espinas característica. Sigue ' +
                'siendo comestible.',
            },
            {
              nombre: 'Reishi',
              cientifico: 'Ganoderma lucidum',
              nivel: 'avanzada',
              colonizacion: '24 a 30 °C',
              fructificacion: '21 a 27 °C',
              ciclo: '8 a 12 semanas',
              nota:
                'No es difícil de sostener: es lenta. Requiere ocupar el equipo durante dos o tres ' +
                'meses. Dato técnico útil: en atmósfera con CO₂ elevado —como la de una cámara ' +
                'chica— desarrolla la forma «asta de ciervo», ramificada y sin sombrero, que ' +
                'concentra los mismos triterpenos y es la presentación más valorada.',
            },
            {
              nombre: 'Cola de pavo',
              cientifico: 'Trametes versicolor',
              nivel: 'intermedia',
              colonizacion: '24 a 27 °C',
              fructificacion: '18 a 21 °C',
              ciclo: '6 a 9 semanas',
              nota:
                'La más rústica de las funcionales: tolera CO₂ elevado y desvíos de humedad sin ' +
                'perder el cultivo. Es la fuente de los polisacáridos PSK y PSP. No se consume ' +
                'como alimento sino en infusión o extracto, por su textura leñosa.',
            },
            {
              nombre: 'Oreja de Judas',
              cientifico: 'Auricularia auricula-judae',
              nivel: 'inicial',
              colonizacion: '24 a 27 °C',
              fructificacion: '21 a 27 °C',
              ciclo: '4 a 6 semanas',
              nota:
                'Muy tolerante y de rango cálido, lo que la hace buena alternativa de verano junto ' +
                'con la rosada. Es el hongo negro de la cocina asiática: se deshidrata sin perder ' +
                'calidad y se rehidrata en minutos, así que la cosecha se conserva bien.',
            },
            {
              nombre: 'Shiitake',
              cientifico: 'Lentinula edodes',
              nivel: 'avanzada',
              colonizacion: '21 a 26 °C',
              fructificacion: '12 a 18 °C',
              ciclo: '10 a 16 semanas',
              nota:
                'Exige paciencia en dos frentes: la colonización lleva de 30 a 70 días y termina ' +
                'con el pardeamiento del bloque (la corteza marrón que se forma sola), y la ' +
                'fructificación se induce por inmersión en agua fría. Su rango exige otoño o ' +
                'invierno: el equipo no puede bajar de la temperatura ambiente.',
            },
            {
              nombre: 'Cordyceps',
              cientifico: 'Cordyceps militaris',
              nivel: 'avanzada',
              colonizacion: '20 a 22 °C, en oscuridad',
              fructificacion: '18 a 22 °C, con luz',
              ciclo: '7 a 10 semanas',
              nota:
                'Es el único del listado que no es un hongo de sombrero sino un ascomiceto: crece ' +
                'sobre sustrato de arroz enriquecido, en frascos, y sus estromas anaranjados ' +
                'requieren luz para desarrollarse. Es la fuente de la cordicepina. Exige ' +
                'esterilización a presión del sustrato y una asepsia superior a la del resto.',
            },
          ],
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'La ventilación del equipo es pasiva, de modo que el CO₂ dentro de la cámara se ' +
            'mantiene por encima del ambiente. En las gírgolas eso se traduce en estipes (el ' +
            'pie del hongo) más largos y sombreros más pequeños; en reishi, en la forma de asta ' +
            'de ciervo. Es un efecto conocido y predecible, no una falla del cultivo.',
        },
      ],
    },
    {
      id: 'funcionales',
      titulo: 'Hongos funcionales y adaptógenos: qué es cultivable y qué no',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'El consumo de hongos funcionales dejó de ser un nicho: el mercado global de ' +
            'adaptógenos crece a tasas de dos dígitos anuales y reishi, melena de león y ' +
            'cordyceps concentran la mayor parte de la demanda. Esa popularidad trajo también ' +
            'confusión sobre qué se puede producir en casa, así que conviene ser precisos.',
        },
        {
          tipo: 'parrafo',
          texto:
            'De las especies asociadas al consumo funcional, cuatro se cultivan sin dificultad en ' +
            'el equipo —reishi, melena de león, cola de pavo y cordyceps— y otras no son ' +
            'viables en una incubadora, por razones biológicas que no dependen de la calidad del ' +
            'equipo:',
        },
        {
          tipo: 'faq',
          items: [
            {
              p: 'Chaga (Inonotus obliquus)',
              r: 'No es cultivable en cámara. Lo que se comercializa como chaga no es un cuerpo fructífero sino un esclerocio: una masa endurecida que el hongo forma parasitando abedules vivos durante años, en climas fríos del hemisferio norte. Fuera de ese hospedador no hay proceso que reproducir. Lo que sí se produce en biorreactor es biomasa de micelio, que no equivale al material silvestre.',
            },
            {
              p: 'Maitake (Grifola frondosa)',
              r: 'Biológicamente cultivable, pero fructifica entre 10 y 16 °C. Como el INC101 calienta y no refrigera, solo es viable si tu ambiente ya está en ese rango, es decir en pleno invierno y en zonas frías. Fuera de esa ventana el cultivo no llega a formar cuerpos fructíferos.',
            },
            {
              p: 'Champiñón y portobello (Agaricus bisporus)',
              r: 'Requieren una capa de cobertura (casing) de turba sobre el sustrato y un manejo de compost que excede el formato de una incubadora doméstica. Es un cultivo posible, pero no es lo que este equipo resuelve mejor.',
            },
            {
              p: 'Trufas',
              r: 'No corresponden a este tipo de cultivo. Son hongos micorrícicos: viven asociados a las raíces de un árbol hospedador y fructifican bajo tierra, en plantaciones que tardan entre seis y diez años en producir.',
            },
          ],
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'Ninguna de estas guías constituye información médica. Los compuestos mencionados ' +
            '—triterpenos, polisacáridos, cordicepina— están descritos en la literatura ' +
            'científica sobre el género, y eso no equivale a una indicación terapéutica.',
        },
      ],
    },
    {
      id: 'calendario',
      titulo: 'Qué cultivar en cada estación',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Esta es la sección que más consultas evita, y parte de una limitación que preferimos ' +
            'declarar: el equipo calienta y sostiene, pero no refrigera. Puede mantener 24 °C en ' +
            'una noche de invierno, y no puede mantener 18 °C en una tarde de enero a 33 °C. En ' +
            'consecuencia, la estación no condiciona si podés cultivar, sino qué conviene ' +
            'cultivar.',
        },
        {
          tipo: 'cronograma',
          filas: [
            {
              etapa: 'Verano',
              dias: 'Diciembre a febrero',
              que: 'Especies de rango cálido: gírgola rosada, oreja de Judas y reishi. Las tres fructifican por encima de los 21 °C, de modo que el ambiente juega a favor.',
              ojo: 'Es la peor época para shiitake y para gírgola común: su rango de fructificación queda por debajo de la temperatura ambiente.',
            },
            {
              etapa: 'Otoño',
              dias: 'Marzo a mayo',
              que: 'La mejor ventana del año. El ambiente acompaña casi todos los rangos y el equipo compensa la amplitud térmica entre el día y la noche.',
              ojo: 'Momento indicado para iniciar shiitake, que tiene la colonización más larga.',
            },
            {
              etapa: 'Invierno',
              dias: 'Junio a agosto',
              que: 'Temporada de las especies de rango templado y frío: shiitake, cola de pavo, cordyceps y gírgola común. El equipo sostiene la temperatura que el ambiente no da.',
              ojo: 'Es cuando más se nota el equipo: sin control térmico, el invierno directamente detiene el cultivo.',
            },
            {
              etapa: 'Primavera',
              dias: 'Septiembre a noviembre',
              que: 'Segunda ventana amplia del año, apta para todas las especies del listado. Buen momento para probar una especie nueva.',
              ojo: 'Conviene cerrar los ciclos largos antes de diciembre, para no terminar la fructificación en pleno calor.',
            },
          ],
        },
        {
          tipo: 'aviso',
          tono: 'cuidado',
          texto:
            'Si tu zona supera los 30 °C de forma sostenida durante el verano, escribinos antes ' +
            'de comprar. Vamos a decirte con franqueza qué especies vas a poder cultivar en esa ' +
            'época y cuáles conviene reservar para el resto del año.',
        },
      ],
    },
    {
      id: 'rinde',
      titulo: 'Rendimiento y duración del ciclo',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'El rendimiento se expresa como eficiencia biológica: la relación entre el peso de la ' +
            'cosecha fresca y el peso seco del sustrato. Un cultivo bien llevado de gírgolas ' +
            'alcanza entre el 75 % y el 100 % en la primera oleada, es decir cerca de un kilo de ' +
            'hongos frescos por kilo de sustrato seco. Las especies funcionales rinden bastante ' +
            'menos, porque destinan más energía a la estructura del cuerpo fructífero.',
        },
        {
          tipo: 'parrafo',
          texto:
            'El factor de mayor incidencia no es la especie sino la calidad del material inicial: ' +
            'el mismo procedimiento sobre un micelio vigoroso o sobre uno almacenado durante ' +
            'meses arroja resultados que no admiten comparación.',
        },
        {
          tipo: 'faq',
          items: [
            {
              p: '¿Es viable sin experiencia previa?',
              r: 'Sí. La mayoría de nuestros clientes inició sin experiencia. Empezando por gírgolas y respetando las guías, el resultado se alcanza. Las dos variables determinantes siguen siendo las mismas: asepsia y temperatura.',
            },
            {
              p: '¿Puedo cultivar dos especies a la vez en el mismo equipo?',
              r: 'Es posible si los rangos térmicos se superponen —gírgola de verano y melena de león comparten la franja de 18 a 24 °C, por ejemplo—, pero no es recomendable mientras estés aprendiendo: una contaminación se propaga a ambos cultivos y perdés la posibilidad de identificar qué falló.',
            },
            {
              p: '¿Se puede cultivar durante todo el año?',
              r: 'Sí, y es precisamente el propósito del equipo: sostiene las condiciones internas al margen del clima exterior. Lo que cambia con la estación es la especie más conveniente, según el calendario de la sección anterior.',
            },
            {
              p: '¿Cuántos cultivos entran por ciclo?',
              r: 'El área útil admite 15 frascos o 4 recipientes tipo bandeja de 1,5 litros. Para cordyceps, que se cultiva en frascos, esa capacidad es la determinante; para gírgolas conviene el formato bandeja.',
            },
          ],
        },
      ],
    },
  ],
  relacionadas: ['los-dos-vitales', 'donde-conseguir-insumos', 'como-funciona-la-incubadora'],
}

const problemas: Guia = {
  slug: 'solucion-de-problemas',
  titulo: 'Diagnóstico de problemas frecuentes',
  eyebrow: 'Diagnóstico',
  resumen:
    'Los tres problemas más habituales y el procedimiento para cada uno: contaminación, falta ' +
    'de temperatura y exceso de condensación.',
  intencion: 'informacional',
  actualizado: '2026-07-21',
  mensajesQueResuelve: 40,
  secciones: [
    {
      id: 'contaminacion',
      titulo: 'Contaminación del cultivo',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'La aparición de moho verde, negro o rosado, o de olor desagradable, indica ' +
            'contaminación por organismos competidores. Es la causa principal de los cultivos ' +
            'perdidos y corresponde ser claros al respecto: cuando la contaminación es visible, ' +
            'ya no es reversible. Ese cultivo se descarta.',
        },
        {
          tipo: 'aviso',
          tono: 'cuidado',
          texto:
            'Lo relevante no es recuperar ese intento, sino identificar la causa para que no se ' +
            'repita. Casi siempre corresponde a una falla de asepsia (algo ingresó sin ' +
            'desinfectar) o a temperatura fuera de rango durante un período prolongado. Si te ' +
            'ocurrió, escribinos con los días transcurridos desde el armado, la temperatura del ' +
            'equipo y tu zona, y lo analizamos sobre tu caso.',
        },
      ],
    },
    {
      id: 'no-calienta',
      titulo: 'El equipo no alcanza la temperatura configurada',
      bloques: [
        {
          tipo: 'pasos',
          items: [
            'Verificá la conexión eléctrica y el encendido, y que la temperatura objetivo esté por encima de la temperatura ambiente.',
            'Controlá que la sonda de temperatura esté colocada según indica el manual: una lectura incorrecta produce una regulación incorrecta.',
            'Considerá el tiempo de respuesta: elevar la temperatura no es instantáneo, en particular con ambiente frío.',
          ],
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'Si realizaste estas verificaciones y el equipo sigue sin calentar, puede tratarse de ' +
            'una falla. Escribinos: contás con 12 meses de garantía de fábrica y, luego, servicio ' +
            'técnico oficial y repuestos de por vida.',
        },
      ],
    },
    {
      id: 'condensacion',
      titulo: 'Exceso de condensación',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Cierto nivel de condensación es parte normal del proceso. Se vuelve un problema ' +
            'cuando el agua gotea sobre el cultivo y favorece la contaminación. Es más frecuente ' +
            'en zonas frías o húmedas, donde el diferencial térmico con el ambiente es mayor.',
        },
        {
          tipo: 'pasos',
          items: [
            'Observá la cúpula: una película de vapor es normal; el problema son las gotas que caen sobre el sustrato.',
            'Ante exceso de agua, escurrí el recipiente de cultivo.',
            'Secá la base de la incubadora, donde se acumula el agua que desciende.',
            'No destapes ni rocíes para ventilar: la ventilación es pasiva, a través de los orificios cubiertos con cinta Micropore.',
          ],
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'Si la situación se repite con frecuencia, escribinos y lo revisamos sobre tu caso ' +
            'particular.',
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
    'Precio vigente, medios de pago y opciones de envío. Los valores se leen de la tienda en ' +
    'el momento de la consulta, de modo que corresponden a lo que vas a abonar.',
  intencion: 'comercial',
  actualizado: '2026-07-21',
  mensajesQueResuelve: 78,
  secciones: [
    {
      id: 'donde',
      titulo: 'Dónde se realiza la compra',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'La compra se realiza en nuestra tienda oficial, infomicelium.com.ar. El precio que ' +
            'figura más abajo se lee de allí en tiempo real, por lo que en esta página nunca vas ' +
            'a encontrar un valor desactualizado.',
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'La compra es directa a fábrica. No somos revendedores: diseñamos y fabricamos el ' +
            'equipo, y por eso el soporte y los repuestos provienen de la misma fuente.',
        },
      ],
    },
    {
      id: 'precio',
      titulo: 'Precio vigente',
      bloques: [
        { tipo: 'precio' },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'Este valor se lee de la tienda en tiempo real, de modo que es el que vas a abonar. ' +
            'Ante una diferencia con cualquier otra publicación, el valor válido es el de la ' +
            'tienda oficial.',
        },
      ],
    },
    {
      id: 'pagos',
      titulo: 'Medios de pago',
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
              p: '¿En cuántas cuotas puedo abonar?',
              r: 'Los planes de cuotas vigentes los define Mercado Pago según tu tarjeta y entidad emisora, y se actualizan con frecuencia. Se muestran en pantalla al momento de pagar, antes de confirmar la compra.',
            },
            {
              p: '¿Conviene abonar por transferencia?',
              r: 'Sí: el pago por transferencia o depósito tiene un 13 % de descuento sobre el precio vigente. Es el valor más bajo disponible para el equipo. El monto exacto de hoy figura más arriba.',
            },
            {
              p: '¿Qué sucede si me arrepiento de la compra?',
              r: 'Contás con 30 días para la devolución. Como fabricantes, la garantía y el soporte los brindamos nosotros de forma directa.',
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
  resumen: 'Cómo despachamos, a qué destinos llegamos y cómo hacer el seguimiento del pedido.',
  intencion: 'informacional',
  actualizado: '2026-07-21',
  mensajesQueResuelve: 57,
  secciones: [
    {
      id: 'como',
      titulo: 'Modalidades y cobertura',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Enviamos a todo el país. Las opciones se seleccionan al finalizar la compra y, ' +
            'apenas se despacha el pedido, recibís el número de seguimiento.',
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
        // El seguimiento lo miramos nosotros. Antes acá había una sección entera titulada
        // "Si el seguimiento no se mueve": le plantaba al que todavía no compró un problema
        // que probablemente no va a tener. La información útil (que gestionamos el reclamo)
        // se queda, dicha como compromiso nuestro y no como advertencia.
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'El seguimiento del envío lo hacemos nosotros: ante una demora en el trayecto, ' +
            'gestionamos el reclamo con el correo y te mantenemos informado. No queda a tu cargo.',
        },
        {
          tipo: 'faq',
          items: [
            {
              p: '¿Cuál es el costo del envío?',
              r: 'El costo exacto depende de tu código postal y de la modalidad elegida: se muestra en pantalla al finalizar la compra, antes del pago. En varias promociones el envío está bonificado.',
            },
            {
              p: '¿Cuál es el plazo de entrega?',
              r: 'Entre 4 y 5 días una vez despachado. El plazo puede variar según la zona y la época del año.',
            },
          ],
        },
      ],
    },
  ],
  relacionadas: ['como-comprar'],
}

const sobre: Guia = {
  slug: 'sobre-micelium',
  titulo: 'Quiénes somos',
  eyebrow: 'Micelium®',
  resumen:
    'Somos una fábrica argentina de equipos de cultivo. Qué implica eso para vos, antes y ' +
    'después de la compra.',
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
            'Diseñamos y fabricamos las incubadoras en nuestro propio taller. No revendemos un ' +
            'producto de terceros: cada equipo es resultado de nuestro trabajo, y eso determina ' +
            'todo lo que ocurre después de la compra.',
        },
        {
          tipo: 'pasos',
          items: [
            'El soporte lo brinda quien fabricó el equipo, no un intermediario ajeno al producto.',
            'Los repuestos están disponibles y van a seguir estándolo: 12 meses de garantía y servicio técnico oficial de por vida.',
            'El acompañamiento del cultivo está incluido en la compra, no se cobra por separado.',
          ],
        },
      ],
    },
    {
      id: 'confianza',
      titulo: 'Por qué publicamos toda esta información',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Adquirir un equipo por internet exige un grado de confianza que hay que ganarse. ' +
            'Por eso preferimos ser explícitos desde el inicio: qué hace el equipo, qué material ' +
            'necesitás además, qué procedimiento existe si algo falla. Toda esta información es ' +
            'pública para que la decisión se tome sobre datos verificables y no sobre promesas.',
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'Ante cualquier consulta, el asistente responde de inmediato y, de ser necesario, ' +
            'deriva a una persona del equipo.',
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
    'El funcionamiento completo del equipo, paso a paso: contenido del envío, montaje, ' +
    'configuración de temperatura, uso del booster de humedad y las contraindicaciones que ' +
    'no admiten excepción.',
  intencion: 'informacional',
  actualizado: '2026-07-22',
  mensajesQueResuelve: 97,
  privada: true,
  secciones: [
    {
      id: 'caja',
      titulo: '1. Contenido del envío',
      bloques: [
        { tipo: 'parrafo', texto: 'Al abrir el paquete vas a encontrar tres elementos:' },
        {
          tipo: 'pasos',
          items: [
            'Cúpula transparente (la tapa).',
            'Base de la incubadora (el módulo negro con la pantalla).',
            'Booster de humedad (bolsa negra tipo sobre).',
          ],
        },
      ],
    },
    {
      id: 'montaje',
      titulo: '2. Montaje paso a paso',
      bloques: [
        { tipo: 'parrafo', texto: 'Respetá este orden para evitar errores de instalación:' },
        {
          tipo: 'pasos',
          items: [
            'Ubicación: colocá la base sobre una superficie nivelada, seca y limpia.',
            'Sonda: fijá la sonda de temperatura (leé la advertencia siguiente antes de continuar).',
            'Cúpula: colocá la cúpula sobre la base, con los orificios de ventilación orientados hacia atrás.',
            'Alimentación: conectá la incubadora a la red eléctrica.',
            'Configuración: establecé la temperatura correspondiente a tu especie.',
          ],
        },
      ],
    },
    {
      id: 'sonda',
      titulo: '3. La sonda de temperatura: el punto crítico',
      bloques: [
        {
          tipo: 'aviso',
          tono: 'cuidado',
          texto:
            'Leé esta sección con atención: de ella depende la integridad del equipo y del ' +
            'cultivo. La sonda de temperatura es el sensor que determina cuándo el equipo ' +
            'interrumpe el calentamiento.',
        },
        {
          tipo: 'vital',
          numero: 1,
          titulo: 'La sonda va SIEMPRE adherida a la base',
          texto:
            'Adherida a la base, dentro de la bandeja, con cinta adhesiva. Nunca suspendida ni ' +
            'al aire. Si queda mal colocada, el equipo lee una temperatura que no corresponde a ' +
            'la del cultivo: calienta de forma continua y puede dañar el equipo o el cultivo.',
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'Cada vez que muevas el cultivo o coloques el booster, verificá que la sonda ' +
            'permanezca en posición. Es el error de mayor costo y el más simple de evitar.',
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
            'El equipo CALIENTA y sostiene la temperatura, pero NO REFRIGERA. Con 28 °C de ' +
            'temperatura ambiente, la incubadora no puede descender por debajo de ese valor.',
        },
        { tipo: 'parrafo', texto: 'Procedimiento de configuración, desde el menú F1:' },
        {
          tipo: 'pasos',
          items: [
            'Mantené presionado el botón SET durante unos segundos, hasta que aparezca «F1».',
            'Presioná SET nuevamente y seleccioná la temperatura con las flechas ▲ ▼.',
            'Confirmá con el botón de encendido para guardar el valor.',
            'Dejá los parámetros F2, F3 y F4 en su configuración de fábrica: no requieren ajuste.',
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
            'El booster se utiliza EXCLUSIVAMENTE en la etapa de fructificación. Durante la ' +
            'colonización NO debe usarse.',
        },
        {
          tipo: 'pasos',
          items: [
            'Preparación de la solución: en un recipiente con agua, agregá 3 gotas de lavandina por litro. El cloro sanitiza el booster y previene contaminaciones.',
            'Sumergí el booster en la solución durante 15 a 20 minutos.',
            'Escurrí con presión suave, hasta que deje de gotear.',
            'Colocá el booster sobre la base negra, y el recipiente de cultivo encima del booster.',
          ],
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'Después de colocar el booster, verificá nuevamente la posición de la sonda.',
        },
        {
          tipo: 'faq',
          items: [
            {
              p: '¿Con qué frecuencia se rehidrata?',
              r: 'Cada 6 o 7 días, para sostener la humedad relativa dentro del rango de fructificación.',
            },
            {
              p: '¿Puede abrirse o esterilizarse con calor?',
              r: 'No. La bolsa del booster no debe abrirse en ningún caso, ni exponerse a microondas u horno: el material se destruye.',
            },
            {
              p: '¿Cómo se conserva al finalizar el cultivo?',
              r: 'Dejalo secar al sol antes de guardarlo. Almacenado con humedad, se convierte en un foco de contaminantes para el ciclo siguiente.',
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
            'Los orificios —orientados hacia atrás— se cubren con cinta Micropore, que permite ' +
            'el intercambio gaseoso pero retiene partículas y esporas. La ventilación del cultivo ' +
            'es pasiva: no corresponde destapar ni abrir el recipiente.',
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'Mantenimiento: reemplazá la cinta únicamente cuando, tras varios meses, presente ' +
            'acumulación visible de polvo o pelusa.',
        },
      ],
    },
    {
      id: 'extras',
      titulo: '7. Modo deshidratador y limpieza',
      bloques: [
        {
          tipo: 'parrafo',
          texto: 'El equipo también permite deshidratar la cosecha. Procedimiento:',
        },
        {
          tipo: 'pasos',
          items: [
            'Adherí la sonda a la base con cinta, firmemente.',
            'Cubrí la bandeja con servilletas de papel.',
            'Distribuí las setas sobre la superficie.',
            'Configurá la temperatura en 40 °C.',
          ],
        },
        {
          tipo: 'faq',
          items: [
            { p: 'Limpieza del equipo', r: 'Desconectá SIEMPRE el equipo antes de limpiarlo. Utilizá un paño apenas humedecido. No viertas agua directamente sobre la base.' },
            { p: 'Limpieza de la cúpula', r: 'Admite alcohol o detergente suave, con secado posterior con papel.' },
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
    'El proceso completo con tiempos, temperaturas y proporciones exactas: preparación, ' +
    'montaje, colonización, fructificación y el procedimiento para obtener hasta tres ' +
    'cosechas del mismo sustrato.',
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
            'El ciclo consta de tres etapas: colonización (el micelio coloniza el sustrato), ' +
            'fructificación (se desarrollan los cuerpos fructíferos, es decir los hongos ' +
            'propiamente dichos) y cosecha, que puede repetirse en varias oleadas sobre el mismo ' +
            'sustrato.',
        },
        {
          tipo: 'parrafo',
          texto:
            'Elegí un espacio limpio, sin circulación de personas ni corrientes de aire, con una ' +
            'superficie lisa y de fácil desinfección (una mesada de cocina es adecuada).',
        },
        {
          tipo: 'pasos',
          items: [
            'Materiales: frascos de sustrato y micelio, cuchara, tenedor, servilletas de papel y guantes descartables.',
            'Desinfectantes: alcohol al 70 % y solución de lavandina al 10 % (1 parte de lavandina, 9 de agua).',
            'Un recipiente amplio para la mezcla (bandeja o contenedor plástico grande) y un atomizador de agua.',
          ],
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'Si no vas a utilizar el kit de inmediato, conservá los frascos de micelio y sustrato ' +
            'refrigerados entre 3 y 5 °C, sin abrirlos hasta el momento del armado.',
        },
      ],
    },
    {
      id: 'higiene',
      titulo: '2. Asepsia: la etapa determinante',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'El cultivo es altamente sensible a la contaminación, y la mayoría de los que ' +
            'fracasan lo hacen en esta instancia. El orden del procedimiento importa:',
        },
        {
          tipo: 'pasos',
          items: [
            'Lavate las manos con jabón antibacterial y colocate guantes descartables.',
            'Desinfectá utensilios y superficies con solución de lavandina al 10 %.',
            'A continuación aplicá alcohol al 70 % sobre superficies y utensilios: elimina esporas que la lavandina no alcanza.',
            'Dejá actuar los desinfectantes un mínimo de 5 minutos antes de comenzar.',
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
            { clave: 'Duración', valor: '7 a 15 días (puede extenderse según las condiciones)' },
            { clave: 'Booster', valor: 'No se utiliza en esta etapa' },
          ],
        },
        {
          tipo: 'parrafo',
          texto:
            'Colocá el recipiente en la incubadora y no lo manipules. El micelio va cubriendo el ' +
            'sustrato con una capa blanca, de avance gradual y uniforme.',
        },
        {
          tipo: 'aviso',
          tono: 'cuidado',
          texto:
            'Indicadores de contaminación: manchas verdes, negras o rosadas, u olor ' +
            'desagradable. Ese cultivo no es recuperable. Retiralo, desinfectá el área y ' +
            'escribinos para analizar la causa antes del próximo intento.',
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
            'Cuando el sustrato está completamente colonizado (blanco y compacto) se inicia la ' +
            'etapa de desarrollo de los cuerpos fructíferos. Comienza con un shock térmico.',
        },
        {
          tipo: 'pasos',
          items: [
            'Shock térmico: llevá el recipiente cerrado a refrigeración, entre 3 y 5 °C, durante 24 horas. Simula el cambio estacional e induce la fructificación.',
            'Hidratá el booster y colocalo sobre la base, con el cultivo por encima.',
            'Ubicá el recipiente bajo la cúpula, sin tapa.',
            'Ajustá la temperatura y dejá que el equipo estabilice las condiciones.',
          ],
        },
        {
          tipo: 'datos',
          filas: [
            { clave: 'Temperatura', valor: '20 a 27 °C — óptimo 24 °C' },
            { clave: 'Humedad relativa', valor: '80 a 90 % (la sostiene el booster)' },
            { clave: 'Fotoperíodo', valor: '12 h de luz indirecta y 12 h de oscuridad (no requiere precisión horaria)' },
            { clave: 'Ventilación', valor: 'Pasiva, por los orificios con cinta Micropore' },
            { clave: 'Rehidratación del booster', valor: 'Cada 6 a 7 días' },
          ],
        },
        {
          tipo: 'aviso',
          tono: 'cuidado',
          texto:
            'No superes los 27 °C: por encima de ese valor la formación de cuerpos fructíferos ' +
            'se inhibe. Tampoco rocíes agua ni destapes el recipiente para ventilar — el equipo ' +
            'ya regula el intercambio gaseoso.',
        },
        {
          tipo: 'faq',
          items: [
            {
              p: '¿Cuándo aparecen los primeros hongos?',
              r: 'Entre los días 10 y 15 de esta etapa se forman los pines (puntos blancos iniciales) y luego los primordios, los cuerpos fructíferos en formación. Durante ese período no corresponde manipular el cultivo.',
            },
            {
              p: 'Se acumula agua en la cúpula, ¿es normal?',
              r: 'Cierto nivel de condensación es esperable. Ante gotas en exceso sobre el sustrato, escurrí el recipiente y secá la base de la incubadora, donde el agua se acumula.',
            },
            {
              p: '¿Cuál es el punto de cosecha?',
              r: 'Cuando el sombrero se abre y el velo se desprende. Cosechá de a una pieza, girando con suavidad desde la base. No utilices cuchillo: daña el micelio, que aún debe producir las oleadas siguientes.',
            },
          ],
        },
      ],
    },
    {
      id: 'cronograma',
      titulo: '5. Cronograma del ciclo',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Esta es la referencia para evaluar el avance. Si tu cultivo se encuentra dentro de ' +
            'estos rangos, la ausencia de cambios visibles no indica un problema.',
        },
        {
          tipo: 'cronograma',
          filas: [
            {
              etapa: 'Armado',
              dias: 'Día 1',
              que: 'Mezcla de sustrato y micelio, con todo el material desinfectado.',
              ojo: 'Registrá la fecha y tomá una fotografía. Sirve como referencia comparativa.',
            },
            {
              etapa: 'Colonización',
              dias: 'Días 2 a 20',
              que: 'El recipiente permanece en la incubadora a 27-28 °C, en oscuridad, sin manipulación.',
              ojo: 'Fotografía cada 5 días. El avance del micelio debe ser uniforme.',
            },
            {
              etapa: 'Shock térmico',
              dias: 'Día 21',
              que: 'Recipiente cerrado en refrigeración (3-5 °C) durante 24 horas.',
              ojo: 'Es el estímulo que induce la fructificación.',
            },
            {
              etapa: 'Fructificación',
              dias: 'Días 22 a 35',
              que: 'Retorno a la incubadora con el booster hidratado, 24 °C y 80-90 % de humedad relativa.',
              ojo: 'Los pines se forman entre el día 10 y 15 de esta etapa.',
            },
            {
              etapa: 'Primera cosecha',
              dias: 'Días 35 a 40',
              que: 'Cosecha al abrirse el sombrero y desprenderse el velo.',
              ojo: 'De a una pieza, girando desde la base.',
            },
            {
              etapa: 'Oleadas siguientes',
              dias: 'Días 41 a 50',
              que: 'Rehidratación del sustrato y repetición del shock térmico.',
              ojo: 'Un cultivo sano produce hasta 3 oleadas.',
            },
          ],
        },
      ],
    },
    {
      id: 'flushes',
      titulo: '6. Oleadas sucesivas sobre el mismo sustrato',
      bloques: [
        {
          tipo: 'parrafo',
          texto:
            'Tras la primera cosecha el micelio permanece viable y puede producir hasta tres ' +
            'oleadas. El factor determinante es una rehidratación correcta.',
        },
        {
          tipo: 'pasos',
          items: [
            'Preparación: herví agua y dejala enfriar. Agregá 1 ml de agua oxigenada por litro.',
            'Volcá la solución sobre el sustrato hasta que el pan quede completamente sumergido.',
            'Tapá el recipiente y llevalo a refrigeración (3-5 °C) durante 24 horas.',
            'Retiralo, eliminá el excedente de agua y escurrí unos minutos hasta que deje de gotear.',
            'Restituí las condiciones de fructificación: 24 °C, booster hidratado y fotoperíodo 12/12.',
          ],
        },
        {
          tipo: 'aviso',
          tono: 'dato',
          texto:
            'El procedimiento se repite en cada oleada. Un cultivo saludable rinde en general ' +
            'hasta 3 cosechas; a partir de ahí el sustrato agota sus nutrientes y corresponde ' +
            'iniciar uno nuevo.',
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
          case 'especies':
            partes.push(
              b.filas
                .map(
                  f =>
                    `${f.nombre} (${f.cientifico}) — dificultad ${f.nivel}. ` +
                    `Colonización: ${f.colonizacion}. Fructificación: ${f.fructificacion}. ` +
                    `Ciclo: ${f.ciclo}. ${f.nota}`,
                )
                .join('\n'),
            )
            break
        }
      }
    }
  }
  return partes.join('\n')
}

/**
 * Minutos de lectura estimados. Sirve como señal de escaneabilidad: el lector decide si
 * entra ahora o vuelve después, en vez de abandonar a mitad. 200 palabras/minuto es el
 * promedio aceptado para lectura de pantalla en castellano.
 */
export function minutosLectura(g: Guia): number {
  let palabras = g.resumen.split(/\s+/).length
  for (const s of g.secciones) {
    palabras += s.titulo.split(/\s+/).length
    for (const b of s.bloques) {
      switch (b.tipo) {
        case 'parrafo':
        case 'aviso':
          palabras += b.texto.split(/\s+/).length
          break
        case 'vital':
          palabras += (b.titulo + ' ' + b.texto).split(/\s+/).length
          break
        case 'pasos':
          palabras += b.items.join(' ').split(/\s+/).length
          break
        case 'faq':
          palabras += b.items.map(i => i.p + ' ' + i.r).join(' ').split(/\s+/).length
          break
        case 'datos':
          palabras += b.filas.map(f => f.clave + ' ' + f.valor).join(' ').split(/\s+/).length
          break
        case 'cronograma':
          palabras += b.filas.map(f => f.etapa + ' ' + f.que + ' ' + (f.ojo ?? '')).join(' ').split(/\s+/).length
          break
        case 'especies':
          palabras += b.filas.map(f => f.nombre + ' ' + f.nota).join(' ').split(/\s+/).length
          break
      }
    }
  }
  return Math.max(1, Math.round(palabras / 200))
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
