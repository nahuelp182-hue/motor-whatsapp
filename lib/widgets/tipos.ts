// Registro de tipos de widget.
//
// ESTE ARCHIVO ES EL CONTRATO. Un tipo declara qué campos tiene; el panel arma el
// formulario solo a partir de esa declaración (components/widgets/CampoEditor.tsx) y
// public/mic.js lo dibuja en el sitio. Agregar un tipo nuevo = una entrada acá + una
// función de render en mic.js. Nada más: no se toca el panel, ni la API, ni la base.
//
// Por eso los campos se declaran con `tipo` de dato y no con HTML: el mismo registro
// sirve para generar el formulario, validar lo que entra por la API y poner los valores
// por defecto.

export type TipoCampo =
  | 'texto'
  | 'textarea'
  | 'numero'
  | 'booleano'
  | 'select'
  | 'color'
  | 'url'
  | 'enlace'
  | 'emoji'
  | 'ubicacion'
  | 'lista'

export type Campo = {
  key: string
  label: string
  tipo: TipoCampo
  ayuda?: string
  placeholder?: string
  opciones?: { value: string; label: string }[] // select
  campos?: Campo[] // lista: forma de cada ítem
  maxItems?: number
  min?: number
  max?: number
  porDefecto?: unknown
}

export type Contexto = 'guias' | 'tienda' | 'producto'

export type TipoWidget = {
  slug: string
  nombre: string
  descripcion: string
  categoria: 'conversion' | 'confianza' | 'contenido' | 'captura'
  contextos: Contexto[]
  /** El widget se sirve con datos vivos de la base (reseñas, stock). Ver lib/widgets/datos.ts */
  datosVivos?: 'resenas'
  /** Dónde aparece y qué necesita para funcionar. Se muestra arriba del formulario. */
  uso: string
  /**
   * El widget se inserta DENTRO del contenido (no flota). Estos llevan el campo
   * `ubicacion`, que reemplaza al viejo `data-mic-slot`: el lugar se elige de una lista
   * y lo resuelve mic.js. Nadie tiene que tocar el HTML de una página para mover un widget.
   */
  bloque?: boolean
  /** Cuándo NO conviene usarlo. Se muestra en el panel para no tener que recordarlo. */
  cuidado?: string
  campos: Campo[]
}

// ── Paleta ───────────────────────────────────────────────────────────────────
// A propósito NO hay selector libre de color: se elige entre estos tokens. Con color
// libre, la identidad visual se desarma sola después de tres ediciones apuradas.
export const PALETA = [
  { value: 'sage', label: 'Sage (verde claro)', hex: '#6f8a5f' },
  { value: 'profundo', label: 'Verde profundo', hex: '#3f4f38' },
  { value: 'crema', label: 'Crema', hex: '#f4f2eb' },
  { value: 'tierra', label: 'Tierra', hex: '#7a6a55' },
  { value: 'carbon', label: 'Carbón', hex: '#1c1a17' },
] as const

// ── Ubicaciones ──────────────────────────────────────────────────────────────
// Reemplazo del viejo `data-mic-slot`. El lugar se elige de esta lista y lo resuelve
// mic.js midiendo el contenido de la página. Así mover un widget es un clic, y no editar
// el HTML de diez guías.
export const UBICACIONES = [
  { value: 'inicio', label: 'Arriba de todo', ayuda: 'Antes del primer párrafo.' },
  { value: 'tras_intro', label: 'Después de la introducción', ayuda: 'Tras el primer párrafo, cuando ya enganchó pero todavía no se fue.' },
  { value: 'medio', label: 'En el medio', ayuda: 'A mitad del texto, entre dos párrafos.' },
  { value: 'antes_final', label: 'Antes del cierre', ayuda: 'Justo antes del último párrafo.' },
  { value: 'final', label: 'Al final', ayuda: 'Después de todo el contenido. Es el lugar más seguro: nunca interrumpe.' },
] as const

// ── Destinos de enlace ───────────────────────────────────────────────────────
// Lista cerrada de destinos reales. Evita tener que escribir direcciones a mano (y que
// una dirección mal tipeada mande a los visitantes a una página que no existe).
export const DESTINOS = [
  { value: '', label: 'Sin enlace (el botón no aparece)' },
  { value: 'https://infomicelium.com.ar', label: 'Tienda — portada' },
  { value: 'https://infomicelium.com.ar/productos', label: 'Tienda — todos los productos' },
  { value: '/guia', label: 'Guías — índice' },
  { value: '/guia/asistente', label: 'Guías — asistente' },
  { value: '/contacto', label: 'Contacto' },
  { value: '/acceso', label: 'Mi equipo (área de clientes)' },
  { value: 'https://wa.me/543512145521', label: 'WhatsApp de Micelium' },
] as const

// Emojis que se usan de verdad en la marca. Que la lista sea corta es la gracia: evita el
// desfile de emojis que hace ver improvisado a un sitio.
export const EMOJIS = [
  '🌱', '🍃', '🛡️', '✅', '📦', '🚚', '💬', '⏱️', '🌡️', '💧',
  '🔧', '⭐', '📋', '🏠', '🔬', '📈', '🤝', '💡',
] as const

const CAMPO_COLOR: Campo = {
  key: 'color',
  label: 'Color principal',
  tipo: 'color',
  porDefecto: 'sage',
}

// ── Tipos ────────────────────────────────────────────────────────────────────

export const TIPOS: TipoWidget[] = [
  {
    slug: 'whatsapp_flotante',
    nombre: 'Botón de WhatsApp',
    descripcion:
      'Botón flotante que abre WhatsApp con un mensaje ya escrito. La asesoría es lo que más convierte: esto la pone a un clic.',
    categoria: 'conversion',
    contextos: ['guias', 'tienda', 'producto'],
    uso: 'Flota sobre la página, siempre visible. No necesita que prepares ningún lugar: se ubica solo.',
    cuidado:
      'Si ya hay otro botón flotante en la misma página (chat de Tiendanube, por ejemplo), se van a superponer.',
    campos: [
      {
        key: 'numero',
        label: 'Número de WhatsApp',
        tipo: 'texto',
        placeholder: '5493512145521',
        ayuda:
          'Con código de país y área, sin el signo + ni espacios ni guiones. Para Córdoba: 54 9 351 y el número. Es el destino de la conversación.',
      },
      {
        key: 'etiqueta',
        label: 'Texto del botón',
        tipo: 'texto',
        porDefecto: 'Consultanos',
        ayuda: 'Lo que se lee al lado del ícono. Corto: dos o tres palabras, si no en celular se corta.',
      },
      {
        key: 'mensaje',
        label: 'Mensaje precargado',
        tipo: 'textarea',
        porDefecto: 'Hola, quería hacer una consulta sobre el equipo.',
        ayuda:
          'Aparece ya escrito en el chat del visitante; él solo aprieta enviar. Conviene que diga de qué página viene, así sabés qué estaba mirando.',
      },
      {
        key: 'posicion',
        label: 'Posición en pantalla',
        tipo: 'select',
        porDefecto: 'derecha',
        ayuda: 'De qué lado flota. En celular la derecha queda bajo el pulgar de la mayoría.',
        opciones: [
          { value: 'derecha', label: 'Abajo a la derecha' },
          { value: 'izquierda', label: 'Abajo a la izquierda' },
        ],
      },
      {
        key: 'demora',
        label: 'Aparece después de (segundos)',
        tipo: 'numero',
        porDefecto: 3,
        min: 0,
        max: 120,
        ayuda:
          'Cuánto espera antes de mostrarse, desde que carga la página. En 0 aparece de entrada. Unos segundos evita que tape el contenido antes de que lo lean.',
      },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'cta_producto',
    nombre: 'Bloque de llamada a la acción',
    descripcion:
      'Recuadro con título, texto y botón. Es el puente entre una guía y el producto: hoy el blog trae visitas y no las deriva.',
    categoria: 'conversion',
    contextos: ['guias', 'tienda', 'producto'],
    bloque: true,
    uso:
      'Se inserta dentro del texto de la página, en el lugar que elijas más abajo. No hay que preparar nada en la página.',
    campos: [
      {
        key: 'ubicacion',
        label: 'Dónde se inserta en la página',
        tipo: 'ubicacion',
        porDefecto: 'final',
        ayuda:
          'Se elige de la lista y listo: no hay que tocar el HTML de ninguna página. El widget se acomoda solo dentro del texto principal.',
      },
      {
        key: 'titulo',
        label: 'Título',
        tipo: 'texto',
        ayuda: 'La frase grande del recuadro. Funciona mejor si continúa lo que la persona venía leyendo.',
      },
      {
        key: 'texto',
        label: 'Texto',
        tipo: 'textarea',
        ayuda: 'Dos o tres renglones. Explica qué gana haciendo clic, no qué es el producto.',
      },
      {
        key: 'etiqueta',
        label: 'Texto del botón',
        tipo: 'texto',
        porDefecto: 'Ver el equipo',
        ayuda: 'Lo que dice el botón. Que describa la acción concreta, no un genérico tipo "Clic acá".',
      },
      {
        key: 'url',
        label: 'Enlace del botón',
        tipo: 'enlace',
        ayuda: 'Elegí el destino de la lista. Si queda sin destino, el botón no aparece.',
      },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'barra_accion',
    nombre: 'Barra de acción fija',
    descripcion:
      'Barra pegada al borde inferior con el precio y el botón de compra, siempre a mano mientras la persona baja.',
    categoria: 'conversion',
    contextos: ['tienda', 'producto'],
    uso:
      'Solo en la ficha de producto de la tienda. No crea un carrito propio: aprieta el botón de compra real de Tiendanube. Si el diseño de la tienda cambia y ese botón deja de existir, la barra directamente no aparece.',
    campos: [
      {
        key: 'etiqueta',
        label: 'Texto del botón',
        tipo: 'texto',
        porDefecto: 'Agregar al carrito',
        ayuda: 'Conviene que diga lo mismo que el botón original, para que no parezcan dos acciones distintas.',
      },
      {
        key: 'mostrar_precio',
        label: 'Mostrar el precio en la barra',
        tipo: 'booleano',
        porDefecto: true,
        ayuda:
          'Toma el precio que ya muestra la página, no uno que cargues acá: nunca puede quedar desactualizado. Si lo apagás, la barra queda solo con el botón.',
      },
      {
        key: 'solo_movil',
        label: 'Solo en celular',
        tipo: 'booleano',
        porDefecto: true,
        ayuda:
          'En pantallas grandes el botón de compra casi siempre queda a la vista, así que la barra sobra. El problema medido está en celular.',
      },
      {
        key: 'scroll',
        label: 'Aparece tras desplazar (%)',
        tipo: 'numero',
        porDefecto: 25,
        min: 0,
        max: 100,
        ayuda:
          'Cuánto tiene que haber bajado la persona para que la barra suba. En 0 aparece apenas entra; en 25 aparece cuando ya avanzó un cuarto de la página, que es cuando el botón original quedó arriba.',
      },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'resenas',
    nombre: 'Reseñas verificadas',
    descripcion:
      'Reseñas de compradores reales con sello de compra verificada. Es el widget que ataca el freno número uno: la desconfianza.',
    categoria: 'confianza',
    contextos: ['tienda', 'producto', 'guias'],
    datosVivos: 'resenas',
    bloque: true,
    uso:
      'Se inserta donde elijas más abajo. Los textos NO se cargan acá: salen solos de las respuestas que dejan los clientes por WhatsApp tras recibir el equipo. Si todavía no hay ninguna, el widget no dibuja nada en vez de mostrar relleno.',
    campos: [
      {
        key: 'titulo',
        label: 'Título',
        tipo: 'texto',
        porDefecto: 'Lo que dicen quienes ya lo usan',
        ayuda: 'Encabezado de la sección. Vacío = sin encabezado.',
      },
      {
        key: 'ubicacion',
        label: 'Dónde se inserta en la página',
        tipo: 'ubicacion',
        porDefecto: 'final',
        ayuda:
          'Se elige de la lista y listo: no hay que tocar el HTML de ninguna página. El widget se acomoda solo dentro del texto principal.',
      },
      {
        key: 'cantidad',
        label: 'Cuántas mostrar',
        tipo: 'numero',
        porDefecto: 6,
        min: 1,
        max: 30,
        ayuda:
          'Se muestran las más recientes hasta ese número. Las respuestas muy cortas (menos de 25 caracteres) se descartan solas porque no aportan.',
      },
      {
        key: 'sello',
        label: 'Mostrar sello de compra verificada',
        tipo: 'booleano',
        porDefecto: true,
        ayuda:
          'Agrega "✓ compra verificada" bajo cada nombre. Es cierto: cada reseña viene de una entrega real, por eso se puede afirmar.',
      },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'faq',
    nombre: 'Preguntas frecuentes',
    descripcion:
      'Lista de preguntas que se despliegan al tocarlas. Sirve para contestar de antemano lo que frena la compra.',
    categoria: 'confianza',
    contextos: ['guias', 'tienda', 'producto'],
    bloque: true,
    uso:
      'Se inserta donde elijas más abajo. Cargalo con las preguntas que de verdad llegan por WhatsApp, no con las que uno imagina.',
    campos: [
      {
        key: 'ubicacion',
        label: 'Dónde se inserta en la página',
        tipo: 'ubicacion',
        porDefecto: 'final',
        ayuda:
          'Se elige de la lista y listo: no hay que tocar el HTML de ninguna página. El widget se acomoda solo dentro del texto principal.',
      },
      {
        key: 'titulo',
        label: 'Título',
        tipo: 'texto',
        porDefecto: 'Preguntas frecuentes',
        ayuda: 'Encabezado de la sección. Vacío = sin encabezado.',
      },
      {
        key: 'items',
        label: 'Preguntas',
        tipo: 'lista',
        maxItems: 20,
        ayuda:
          'Se muestran en este orden, todas cerradas al principio. Usá las flechas para reordenar: lo que más frena la compra va primero.',
        campos: [
          {
            key: 'pregunta',
            label: 'Pregunta',
            tipo: 'texto',
            ayuda: 'Es lo único visible hasta que la tocan. Escribila como la haría el cliente.',
          },
          {
            key: 'respuesta',
            label: 'Respuesta',
            tipo: 'textarea',
            ayuda: 'Se ve al desplegar. Los saltos de línea que pongas se respetan.',
          },
        ],
      },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'beneficios',
    nombre: 'Lista de beneficios',
    descripcion: 'Lista corta con un emoji por línea. Habla de resultados, no de componentes.',
    categoria: 'confianza',
    contextos: ['guias', 'tienda', 'producto'],
    bloque: true,
    uso: 'Se inserta dentro del texto de la página, en el lugar que elijas más abajo.',
    cuidado:
      'Nunca listar de qué está hecho el equipo ni cómo se arma: eso le da la receta a quien quiera copiarlo, y al cliente no le mueve la aguja. Hablar de lo que consigue.',
    campos: [
      {
        key: 'titulo',
        label: 'Título',
        tipo: 'texto',
        ayuda: 'Opcional. Si lo dejás vacío, la lista arranca directamente.',
      },
      {
        key: 'ubicacion',
        label: 'Dónde se inserta en la página',
        tipo: 'ubicacion',
        porDefecto: 'final',
        ayuda:
          'Se elige de la lista y listo: no hay que tocar el HTML de ninguna página. El widget se acomoda solo dentro del texto principal.',
      },
      {
        key: 'items',
        label: 'Beneficios',
        tipo: 'lista',
        maxItems: 10,
        ayuda: 'De cinco a siete rinde mejor que diez: una lista larga se deja de leer.',
        campos: [
          {
            key: 'icono',
            label: 'Emoji',
            tipo: 'emoji',
            ayuda: 'Se elige de la lista. Va al principio de la línea. Sin emoji se usa un punto.',
          },
          {
            key: 'texto',
            label: 'Texto',
            tipo: 'texto',
            ayuda: 'Un renglón. Que se entienda leyendo solo esa línea, sin las demás.',
          },
        ],
      },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'garantia',
    nombre: 'Mensaje de garantía',
    descripcion: 'Recuadro de respaldo: garantía, soporte, quién está atrás del equipo.',
    categoria: 'confianza',
    contextos: ['tienda', 'producto'],
    bloque: true,
    uso:
      'Se inserta donde elijas más abajo. Rinde justo después del botón de compra, que es donde aparece la duda de "¿y si me quedo solo con esto?".',
    campos: [
      {
        key: 'ubicacion',
        label: 'Dónde se inserta en la página',
        tipo: 'ubicacion',
        porDefecto: 'final',
        ayuda:
          'Se elige de la lista y listo: no hay que tocar el HTML de ninguna página. El widget se acomoda solo dentro del texto principal.',
      },
      {
        key: 'titulo',
        label: 'Título',
        tipo: 'texto',
        porDefecto: 'Garantía de 1 año',
        ayuda: 'La línea en negrita. Concreta y verificable: un plazo, una cobertura.',
      },
      {
        key: 'texto',
        label: 'Texto',
        tipo: 'textarea',
        ayuda: 'Un renglón o dos explicando qué cubre y a quién le escribe si pasa algo.',
      },
      {
        key: 'icono',
        label: 'Emoji',
        tipo: 'emoji',
        porDefecto: '🛡️',
        ayuda: 'Se elige de la lista. Va grande, a la izquierda del recuadro.',
      },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'captura_email',
    nombre: 'Captura de email',
    descripcion:
      'Pide el correo a cambio de la guía en PDF. Sirve para que una visita que hoy se va sin comprar quede en la lista.',
    categoria: 'captura',
    contextos: ['guias', 'tienda', 'producto'],
    bloque: true,
    uso:
      'Como ventana emergente no necesita nada preparado. Como bloque se inserta donde elijas más abajo. El correo se valida (formato y que el dominio exista de verdad) y se envía la guía en PDF; quien la pide queda suscripto para las campañas.',
    cuidado:
      'Una sola ventana emergente por página. Si la persona ya dejó su correo o cerró la ventana, no le vuelve a aparecer.',
    campos: [
      {
        key: 'titulo',
        label: 'Título',
        tipo: 'texto',
        ayuda: 'La promesa, en una línea. Qué recibe, no qué le pedís.',
      },
      {
        key: 'texto',
        label: 'Texto',
        tipo: 'textarea',
        ayuda: 'Dos renglones sobre qué va a encontrar adentro. Concreto rinde más que entusiasta.',
      },
      {
        key: 'etiqueta',
        label: 'Texto del botón',
        tipo: 'texto',
        porDefecto: 'Quiero recibirla',
        ayuda: 'Mejor en primera persona ("Quiero recibirla") que imperativo ("Enviar").',
      },
      {
        key: 'modo',
        label: 'Cómo aparece',
        tipo: 'select',
        porDefecto: 'popup',
        ayuda:
          'Ventana emergente: tapa la pantalla, capta más y molesta más. Bloque: queda dentro del texto, no interrumpe y capta menos.',
        opciones: [
          { value: 'popup', label: 'Ventana emergente' },
          { value: 'bloque', label: 'Bloque en la página' },
        ],
      },
      {
        key: 'ubicacion',
        label: 'Dónde se inserta en la página',
        tipo: 'ubicacion',
        porDefecto: 'final',
        ayuda:
          'Se elige de la lista y listo: no hay que tocar el HTML de ninguna página. El widget se acomoda solo dentro del texto principal.',
      },
      {
        key: 'demora',
        label: 'Ventana: aparece a los (segundos)',
        tipo: 'numero',
        porDefecto: 15,
        min: 0,
        max: 300,
        ayuda:
          'Solo aplica al modo ventana. Antes de 10 segundos interrumpe a alguien que todavía no leyó nada. Se ignora si elegiste bloque.',
      },
      {
        key: 'salida',
        label: 'Ventana: también al intentar salir',
        tipo: 'booleano',
        porDefecto: true,
        ayuda:
          'Muestra la ventana cuando el puntero sube hacia la barra del navegador, señal de que se está yendo. En celular no existe ese gesto, así que ahí manda la demora.',
      },
      {
        key: 'gracias',
        label: 'Mensaje de agradecimiento',
        tipo: 'texto',
        porDefecto: '¡Listo! Revisá tu correo.',
        ayuda: 'Lo que se lee después de enviar. Conviene aclarar que el material llega por correo y no se descarga acá.',
      },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'cuotas',
    nombre: 'Cuotas sin interés',
    descripcion:
      'Muestra el precio dividido en cuotas. Es el widget de mayor efecto en un producto caro: nadie compara $300.000 con $300.000, comparan la cuota con lo que gastan por mes.',
    categoria: 'conversion',
    contextos: ['tienda', 'producto'],
    bloque: true,
    uso:
      'Toma el precio que ya muestra la página y lo divide: no se carga ningún número acá, así que nunca puede quedar desactualizado. Si la página no muestra precio, el widget no aparece.',
    campos: [
      {
        key: 'ubicacion',
        label: 'Dónde se inserta en la página',
        tipo: 'ubicacion',
        porDefecto: 'inicio',
        ayuda: 'Rinde apenas debajo del precio, que es donde aparece el susto del total.',
      },
      {
        key: 'cuotas',
        label: 'En cuántas cuotas',
        tipo: 'numero',
        porDefecto: 3,
        min: 2,
        max: 24,
        ayuda: 'Tiene que coincidir con las cuotas que ofrecés de verdad en el checkout. Prometer acá lo que no está allá se paga con un carrito abandonado.',
      },
      {
        key: 'texto',
        label: 'Aclaración',
        tipo: 'texto',
        porDefecto: 'sin interés con tarjeta de crédito',
        ayuda: 'Va chiquito al lado del monto. Sirve para aclarar la condición sin ensuciar el número.',
      },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'envio_estimado',
    nombre: 'Fecha de entrega estimada',
    descripcion:
      'Dice en qué fecha llega si compra hoy. Es de lo que más levanta conversión en Amazon: convierte un "en algún momento" en un día del calendario.',
    categoria: 'conversion',
    contextos: ['tienda', 'producto'],
    bloque: true,
    uso:
      'Calcula las fechas en el momento, contando solo días hábiles. Si la persona entra un domingo, ya cuenta desde el lunes. No hay que actualizar nada nunca.',
    cuidado:
      'Poné el rango que cumplís de verdad, no el mejor caso. Una fecha incumplida es la causa principal de que la reputación baje.',
    campos: [
      {
        key: 'ubicacion',
        label: 'Dónde se inserta en la página',
        tipo: 'ubicacion',
        porDefecto: 'inicio',
        ayuda: 'Cerca del botón de compra, que es donde aparece la pregunta "¿y cuándo me llega?".',
      },
      {
        key: 'dias_min',
        label: 'Desde (días hábiles)',
        tipo: 'numero',
        porDefecto: 3,
        min: 1,
        max: 60,
        ayuda: 'Lo más rápido que suele llegar, contando desde el despacho.',
      },
      {
        key: 'dias_max',
        label: 'Hasta (días hábiles)',
        tipo: 'numero',
        porDefecto: 7,
        min: 1,
        max: 90,
        ayuda: 'El plazo que cumplís siempre. Si dudás, poné el más largo: llegar antes suma, llegar después resta el doble.',
      },
      {
        key: 'corte',
        label: 'Hora de corte para despachar hoy',
        tipo: 'numero',
        porDefecto: 15,
        min: 0,
        max: 23,
        ayuda: 'En hora del día (15 = tres de la tarde). Después de esa hora, la cuenta arranca al día siguiente.',
      },
      {
        key: 'texto',
        label: 'Texto delante de la fecha',
        tipo: 'texto',
        porDefecto: 'Comprando hoy, llega entre el',
        ayuda: 'La fecha se agrega sola después de este texto.',
      },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'pasos',
    nombre: 'Cómo funciona (1-2-3)',
    descripcion:
      'Tres o cuatro pasos numerados. Baja la sensación de "esto va a ser complicado", que es el segundo freno después de la desconfianza.',
    categoria: 'confianza',
    contextos: ['guias', 'tienda', 'producto'],
    bloque: true,
    uso: 'Se inserta donde elijas más abajo. Funciona mejor arriba, antes de que aparezca el precio.',
    campos: [
      {
        key: 'ubicacion',
        label: 'Dónde se inserta en la página',
        tipo: 'ubicacion',
        porDefecto: 'medio',
        ayuda: 'Se elige de la lista: no hay que tocar el HTML de ninguna página.',
      },
      { key: 'titulo', label: 'Título', tipo: 'texto', porDefecto: 'Cómo funciona', ayuda: 'Vacío = sin encabezado.' },
      {
        key: 'items',
        label: 'Pasos',
        tipo: 'lista',
        maxItems: 5,
        ayuda: 'Tres pasos es lo que mejor funciona. Con más de cuatro deja de leerse como algo simple, que es justo lo contrario de lo que buscás.',
        campos: [
          { key: 'titulo', label: 'Título del paso', tipo: 'texto', ayuda: 'Dos o tres palabras. Un verbo adelante.' },
          { key: 'texto', label: 'Explicación', tipo: 'texto', ayuda: 'Un renglón. Lo que hace la persona, no lo que hace el equipo.' },
        ],
      },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'barra_confianza',
    nombre: 'Barra de confianza',
    descripcion:
      'Fila de tres o cuatro señales: envío, garantía, fabricación propia, soporte. La referencia manda una señal de confianza cada pantalla y media.',
    categoria: 'confianza',
    contextos: ['guias', 'tienda', 'producto'],
    bloque: true,
    uso: 'Se inserta donde elijas. En celular se apila sola.',
    campos: [
      {
        key: 'ubicacion',
        label: 'Dónde se inserta en la página',
        tipo: 'ubicacion',
        porDefecto: 'inicio',
        ayuda: 'Arriba de todo es donde más rinde: es lo primero que decide si la persona sigue leyendo.',
      },
      {
        key: 'items',
        label: 'Señales',
        tipo: 'lista',
        maxItems: 4,
        ayuda: 'Tres o cuatro. Cada una tiene que ser verificable: una promesa vaga acá resta en vez de sumar.',
        campos: [
          { key: 'icono', label: 'Emoji', tipo: 'emoji', ayuda: 'Se elige de la lista.' },
          { key: 'titulo', label: 'Título', tipo: 'texto', ayuda: 'Dos o tres palabras, en negrita.' },
          { key: 'texto', label: 'Detalle', tipo: 'texto', ayuda: 'Media línea. El dato concreto que respalda el título.' },
        ],
      },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'comparador',
    nombre: 'Comparativa',
    descripcion:
      'Dos columnas enfrentadas: hacerlo por las suyas contra hacerlo con el equipo. Ordena la decisión sin hablar mal de nadie.',
    categoria: 'confianza',
    contextos: ['guias', 'tienda', 'producto'],
    bloque: true,
    uso: 'Se inserta donde elijas más abajo.',
    cuidado:
      'La comparación va siempre contra el método (hacerlo a mano, improvisar), NUNCA contra otra marca ni nombrando competidores. Y no describe cómo armarlo: eso sería regalar la receta.',
    campos: [
      {
        key: 'ubicacion',
        label: 'Dónde se inserta en la página',
        tipo: 'ubicacion',
        porDefecto: 'medio',
        ayuda: 'Se elige de la lista.',
      },
      { key: 'titulo', label: 'Título', tipo: 'texto', porDefecto: 'Las dos maneras de hacerlo', ayuda: 'Vacío = sin encabezado.' },
      { key: 'col_a', label: 'Título de la columna izquierda', tipo: 'texto', porDefecto: 'Por las suyas', ayuda: 'La alternativa. Descriptiva, no despectiva.' },
      { key: 'col_b', label: 'Título de la columna derecha', tipo: 'texto', porDefecto: 'Con el equipo', ayuda: 'La opción que ofrecés. Va destacada.' },
      {
        key: 'items',
        label: 'Filas de comparación',
        tipo: 'lista',
        maxItems: 8,
        ayuda: 'Cuatro o cinco alcanzan. Cada fila es un aspecto: tiempo, resultado, qué pasa si falla.',
        campos: [
          { key: 'tema', label: 'Aspecto', tipo: 'texto', ayuda: 'Una o dos palabras: "Tiempo", "Si algo falla".' },
          { key: 'a', label: 'Columna izquierda', tipo: 'texto', ayuda: 'Cómo es sin el equipo. Honesto, sin exagerar.' },
          { key: 'b', label: 'Columna derecha', tipo: 'texto', ayuda: 'Cómo es con el equipo.' },
        ],
      },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'especificaciones',
    nombre: 'Ficha técnica',
    descripcion:
      'Tabla de dato y valor. Amazon la pone siempre: quien compara en serio la busca, y no encontrarla es motivo de abandono.',
    categoria: 'contenido',
    contextos: ['tienda', 'producto', 'guias'],
    bloque: true,
    uso: 'Se inserta donde elijas más abajo.',
    cuidado:
      'Datos de uso y resultado (consumo, medidas, capacidad, rangos), nunca de qué está hecho por dentro ni cómo se arma.',
    campos: [
      {
        key: 'ubicacion',
        label: 'Dónde se inserta en la página',
        tipo: 'ubicacion',
        porDefecto: 'antes_final',
        ayuda: 'Abajo: la busca quien ya está decidiendo, no quien recién llega.',
      },
      { key: 'titulo', label: 'Título', tipo: 'texto', porDefecto: 'Ficha técnica', ayuda: 'Vacío = sin encabezado.' },
      {
        key: 'items',
        label: 'Datos',
        tipo: 'lista',
        maxItems: 20,
        ayuda: 'Se muestran en este orden. Lo que más se pregunta va primero.',
        campos: [
          { key: 'dato', label: 'Dato', tipo: 'texto', ayuda: 'El nombre: "Consumo", "Medidas", "Capacidad".' },
          { key: 'valor', label: 'Valor', tipo: 'texto', ayuda: 'Con su unidad. Concreto y verificable.' },
        ],
      },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'banner_anuncio',
    nombre: 'Barra de anuncio',
    descripcion:
      'Franja fija arriba de todo con mensajes que rotan solos. Es donde van envío, cuotas y garantía sin gastar espacio de la página.',
    categoria: 'conversion',
    contextos: ['tienda', 'producto', 'guias'],
    uso: 'Se pega al borde superior de la pantalla. No necesita que prepares nada en la página.',
    campos: [
      {
        key: 'items',
        label: 'Mensajes',
        tipo: 'lista',
        maxItems: 5,
        ayuda: 'Rotan uno tras otro. Con dos o tres alcanza: más mensajes es menos chance de que lean el que importa.',
        campos: [{ key: 'texto', label: 'Mensaje', tipo: 'texto', ayuda: 'Una línea corta. Un beneficio concreto por mensaje.' }],
      },
      {
        key: 'segundos',
        label: 'Cada cuántos segundos cambia',
        tipo: 'numero',
        porDefecto: 5,
        min: 2,
        max: 20,
        ayuda: 'Menos de cuatro segundos no da tiempo a leer en celular.',
      },
      {
        key: 'cerrable',
        label: 'Se puede cerrar',
        tipo: 'booleano',
        porDefecto: true,
        ayuda: 'Si lo cierran, no vuelve a aparecer en esa visita. Dejarlo cerrable evita que moleste a quien ya lo leyó.',
      },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'cuenta_regresiva',
    nombre: 'Cuenta regresiva',
    descripcion: 'Reloj hacia una fecha real: cierre de una preventa, fin de una promoción, corte de despacho.',
    categoria: 'conversion',
    contextos: ['tienda', 'producto', 'guias'],
    bloque: true,
    uso:
      'Se inserta donde elijas. Al llegar la fecha desaparece solo, sin que tengas que acordarte de apagarlo.',
    cuidado:
      'Solo con una fecha que sea cierta. Un reloj que se reinicia solo lo detecta cualquiera que vuelva al otro día, y quema la confianza que el resto de los widgets construye.',
    campos: [
      {
        key: 'ubicacion',
        label: 'Dónde se inserta en la página',
        tipo: 'ubicacion',
        porDefecto: 'inicio',
        ayuda: 'Se elige de la lista.',
      },
      { key: 'titulo', label: 'Título', tipo: 'texto', porDefecto: 'La preventa cierra en', ayuda: 'Qué es lo que termina. Concreto.' },
      {
        key: 'hasta',
        label: 'Fecha y hora de cierre',
        tipo: 'texto',
        placeholder: '2026-08-15 23:59',
        ayuda: 'Formato año-mes-día y hora, por ejemplo 2026-08-15 23:59. Al pasar esa fecha el widget deja de mostrarse.',
      },
      { key: 'texto', label: 'Texto debajo del reloj', tipo: 'texto', ayuda: 'Opcional. Qué pasa cuando termina.' },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'video',
    nombre: 'Video',
    descripcion:
      'Video de YouTube incrustado. El equipo funcionando de verdad hace más por la confianza que cualquier texto.',
    categoria: 'contenido',
    contextos: ['guias', 'tienda', 'producto'],
    bloque: true,
    uso:
      'Se inserta donde elijas. Carga solo la miniatura hasta que alguien lo toca, así no enlentece la página.',
    campos: [
      {
        key: 'ubicacion',
        label: 'Dónde se inserta en la página',
        tipo: 'ubicacion',
        porDefecto: 'medio',
        ayuda: 'Se elige de la lista.',
      },
      { key: 'titulo', label: 'Título', tipo: 'texto', ayuda: 'Opcional, va arriba del video.' },
      {
        key: 'youtube',
        label: 'Dirección del video en YouTube',
        tipo: 'texto',
        placeholder: 'https://www.youtube.com/watch?v=...',
        ayuda: 'Pegá la dirección tal cual la copiás de YouTube. También sirve la corta (youtu.be/...). Es lo único que hay que pegar en todo el panel.',
      },
      CAMPO_COLOR,
    ],
  },
]

export const porSlug = (slug: string): TipoWidget | undefined => TIPOS.find(t => t.slug === slug)

/** Config inicial de un tipo, con todos los valores por defecto puestos. */
export function configPorDefecto(tipo: TipoWidget): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const c of tipo.campos) {
    if (c.porDefecto !== undefined) out[c.key] = c.porDefecto
    else if (c.tipo === 'lista') out[c.key] = []
    else if (c.tipo === 'booleano') out[c.key] = false
    else if (c.tipo === 'numero') out[c.key] = 0
    else out[c.key] = ''
  }
  return out
}

/**
 * Deja pasar SOLO los campos declarados por el tipo, con el tipo de dato correcto.
 * La config viaja como JSON desde el panel: sin esto, cualquier cosa que entre por la API
 * termina servida tal cual a todos los visitantes del sitio.
 */
export function sanearConfig(tipo: TipoWidget, entrada: unknown): Record<string, unknown> {
  const src = (entrada ?? {}) as Record<string, unknown>
  const out: Record<string, unknown> = {}

  const valor = (c: Campo, v: unknown): unknown => {
    switch (c.tipo) {
      case 'booleano':
        return v === true || v === 'true'
      case 'numero': {
        const n = Number(v)
        if (!Number.isFinite(n)) return c.porDefecto ?? 0
        return Math.min(c.max ?? Infinity, Math.max(c.min ?? -Infinity, n))
      }
      case 'select':
        return c.opciones?.some(o => o.value === v) ? v : (c.porDefecto ?? c.opciones?.[0]?.value ?? '')
      case 'color':
        return PALETA.some(p => p.value === v) ? v : 'sage'
      case 'ubicacion':
        return UBICACIONES.some(u => u.value === v) ? v : 'final'
      case 'emoji':
        return EMOJIS.includes(v as (typeof EMOJIS)[number]) ? v : (c.porDefecto ?? '')
      case 'enlace':
        return DESTINOS.some(d => d.value === v) ? v : ''
      case 'url': {
        const s = String(v ?? '').trim().slice(0, 500)
        // Sin esto, un `javascript:` guardado en la config se ejecuta en el navegador
        // de cada visitante: el panel escribe directo en el sitio público.
        return /^(https?:\/\/|\/|#)/i.test(s) ? s : ''
      }
      case 'lista': {
        const arr = Array.isArray(v) ? v : []
        return arr.slice(0, c.maxItems ?? 20).map(item => {
          const o: Record<string, unknown> = {}
          for (const sub of c.campos ?? []) {
            o[sub.key] = valor(sub, (item as Record<string, unknown>)?.[sub.key])
          }
          return o
        })
      }
      default:
        return String(v ?? '').slice(0, c.tipo === 'textarea' ? 2000 : 300)
    }
  }

  for (const c of tipo.campos) out[c.key] = valor(c, src[c.key])
  return out
}

// ── Reglas de aparición ──────────────────────────────────────────────────────

export type Reglas = {
  rutas?: string[] // prefijos de ruta donde aparece; vacío = en todas
  dispositivo?: 'todos' | 'movil' | 'escritorio'
  desde?: string | null // ISO
  hasta?: string | null
}

export function sanearReglas(entrada: unknown): Reglas {
  const r = (entrada ?? {}) as Record<string, unknown>
  const rutas = Array.isArray(r.rutas)
    ? r.rutas.map(x => String(x).slice(0, 200)).filter(Boolean).slice(0, 20)
    : []
  const disp = ['todos', 'movil', 'escritorio'].includes(String(r.dispositivo))
    ? (r.dispositivo as Reglas['dispositivo'])
    : 'todos'
  const fecha = (v: unknown) => {
    const s = String(v ?? '').trim()
    return s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString() : null
  }
  return { rutas, dispositivo: disp, desde: fecha(r.desde), hasta: fecha(r.hasta) }
}
