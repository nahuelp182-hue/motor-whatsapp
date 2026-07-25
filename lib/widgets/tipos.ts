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
  | 'producto'
  | 'media'
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
  ayuda:
    'La paleta de marca es lo normal. El código propio está para un evento o una fecha puntual: si termina quedándose, el sitio deja de verse como una sola marca.',
}

// Gesto con el que el widget entra en pantalla la primera vez que se lo ve al bajar. Es una
// opción de bloque: los flotantes (WhatsApp, banner, barra) tienen su propia aparición y no lo
// usan. Se agrega una sola vez a los tipos `bloque` más abajo, no se repite en cada uno.
const CAMPO_ANIMACION: Campo = {
  key: 'animacion',
  label: 'Animación de entrada',
  tipo: 'select',
  porDefecto: 'subir',
  ayuda:
    'Cómo aparece cuando el visitante llega a él al bajar. Sutil a propósito: se nota sin distraer. «Ninguna» lo deja fijo. A quien pidió menos movimiento en su sistema se le muestra sin animar.',
  opciones: [
    { value: 'subir', label: 'Subir con suavidad' },
    { value: 'escala', label: 'Aparecer creciendo' },
    { value: 'lado', label: 'Entrar desde el costado' },
    { value: 'ninguna', label: 'Sin animación' },
  ],
}

// Proporciones con su medida sugerida. El panel muestra la medida ANTES de subir, que es
// cuando sirve: después de subir una foto mal encuadrada ya no hay nada que hacer.
export const PROPORCIONES = [
  { value: '16:9', label: 'Apaisado (16:9)', medida: '1600 × 900 px' },
  { value: '4:3', label: 'Clásico (4:3)', medida: '1600 × 1200 px' },
  { value: '1:1', label: 'Cuadrado (1:1)', medida: '1200 × 1200 px' },
  { value: '4:5', label: 'Vertical (4:5)', medida: '1080 × 1350 px' },
  { value: 'original', label: 'Como venga el archivo', medida: 'ancho máximo 1600 px' },
] as const

export const MARCOS = [
  { value: 'ninguno', label: 'Sin marco', radio: '0' },
  { value: 'suave', label: 'Esquinas suaves', radio: '8px' },
  { value: 'redondo', label: 'Esquinas redondeadas', radio: '18px' },
  { value: 'circulo', label: 'Círculo', radio: '999px' },
] as const

// ── Tipos ────────────────────────────────────────────────────────────────────

const TIPOS_BASE: TipoWidget[] = [
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
      'Se inserta donde elijas más abajo. Los textos salen solos de tres fuentes reales: las respuestas por WhatsApp tras la entrega, las reseñas de Google, y las que dejen desde el formulario del sitio (estas últimas no se publican hasta que las apruebes en Reseñas). Si todavía no hay ninguna, el widget no dibuja nada en vez de mostrar relleno.',
    campos: [
      {
        key: 'titulo',
        label: 'Título',
        tipo: 'texto',
        porDefecto: 'Lo que dicen quienes ya lo usan',
        ayuda: 'Encabezado de la sección. Vacío = sin encabezado.',
      },
      {
        key: 'subtitulo',
        label: 'Subtítulo',
        tipo: 'texto',
        porDefecto: '',
        ayuda: 'Línea chica bajo el título. Vacío = sin subtítulo.',
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
          'Agrega "✓ compra verificada" (WhatsApp) o "✓ Google" bajo cada nombre. Es cierto: esas reseñas vienen de una entrega o de la ficha de Google.',
      },
      {
        key: 'promedio',
        label: 'Mostrar promedio de estrellas',
        tipo: 'booleano',
        porDefecto: true,
        ayuda:
          'Encabeza el bloque con el promedio (ej. 4,9) y la cantidad de reseñas. Solo aparece si hay reseñas con estrellas.',
      },
      {
        key: 'mostrarFecha',
        label: 'Mostrar la fecha de cada reseña',
        tipo: 'booleano',
        porDefecto: false,
        ayuda: 'Agrega la fecha bajo cada reseña.',
      },
      {
        key: 'formulario',
        label: 'Mostrar botón "Escribir reseña"',
        tipo: 'booleano',
        porDefecto: false,
        ayuda:
          'Deja que cualquiera envíe una reseña desde el sitio. NO se publica sola: queda pendiente hasta que la aprobás en la sección Reseñas del panel.',
      },
      {
        key: 'botonTexto',
        label: 'Texto del botón',
        tipo: 'texto',
        porDefecto: 'Escribir reseña',
        ayuda: 'Solo se usa si el botón está activado.',
      },
      {
        key: 'mensajeGracias',
        label: 'Mensaje al enviar',
        tipo: 'texto',
        porDefecto: '¡Gracias! Tu reseña se publicará luego de una breve revisión.',
        ayuda: 'Lo que ve la persona después de enviar su reseña.',
      },
      {
        key: 'permitirFoto',
        label: 'Dejar que suban una foto',
        tipo: 'booleano',
        porDefecto: false,
        ayuda: 'Agrega al formulario la opción de adjuntar una foto (ej. el equipo funcionando, su cosecha).',
      },
      {
        key: 'mostrarFotos',
        label: 'Mostrar las fotos en las reseñas',
        tipo: 'booleano',
        porDefecto: true,
        ayuda: 'Si lo apagás, las reseñas con foto se ven igual pero sin la imagen (solo el texto).',
      },
      {
        key: 'filtroProducto',
        label: 'Qué reseñas mostrar',
        tipo: 'select',
        porDefecto: 'todas',
        opciones: [
          { value: 'todas', label: 'Todas las de la tienda' },
          { value: 'este', label: 'Solo las de este producto (en la ficha)' },
          { value: 'elegidos', label: 'Solo las de los productos que elija' },
        ],
        ayuda:
          '"Este producto" solo tiene efecto dentro de una ficha: muestra las reseñas de ese producto. En una ficha de ebook podés poner "este" para ver solo las del ebook, o "todas" para mostrar todas juntas.',
      },
      {
        key: 'productos',
        label: 'Productos a incluir',
        tipo: 'lista',
        maxItems: 20,
        ayuda: 'Solo se usa si arriba elegiste "los productos que elija". Sumá cada producto cuyas reseñas querés mostrar.',
        campos: [
          {
            key: 'id',
            label: 'Producto',
            tipo: 'producto',
            ayuda: 'Se muestran las reseñas asociadas a este producto.',
          },
        ],
      },
      {
        key: 'estrellaTamano',
        label: 'Tamaño de las estrellas (px)',
        tipo: 'numero',
        porDefecto: 15,
        min: 10,
        max: 30,
        ayuda: 'Tamaño de las estrellas en cada reseña.',
      },
      {
        key: 'estrellaColor',
        label: 'Color de las estrellas',
        tipo: 'select',
        porDefecto: 'dorado',
        opciones: [
          { value: 'dorado', label: 'Dorado' },
          { value: 'ambar', label: 'Ámbar' },
          { value: 'negro', label: 'Negro' },
          { value: 'marca', label: 'Color de marca (el de abajo)' },
        ],
        ayuda: 'El dorado es el estándar de las reseñas y el que más se reconoce.',
      },
      {
        key: 'estrellaAlineacion',
        label: 'Alineación de las estrellas',
        tipo: 'select',
        porDefecto: 'izquierda',
        opciones: [
          { value: 'izquierda', label: 'Izquierda' },
          { value: 'centro', label: 'Centro' },
          { value: 'derecha', label: 'Derecha' },
        ],
        ayuda: 'Dónde se ubican las estrellas dentro de cada reseña.',
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
    nombre: 'Línea de tiempo de entrega',
    descripcion:
      'Compra → Envío → Entrega, con las fechas calculadas solas. Poner un día del calendario en vez de "en algún momento" es de lo que más levanta conversión en Amazon.',
    categoria: 'conversion',
    contextos: ['tienda', 'producto'],
    bloque: true,
    uso:
      'Las fechas se calculan en el momento de la visita, contando solo días hábiles y respetando la hora de corte. Si entran un domingo a la noche, la cuenta arranca el lunes. No hay que actualizar nada nunca.',
    cuidado:
      'Poné los plazos que cumplís de verdad, no el mejor caso. Llegar antes suma; llegar después resta el doble y es la causa principal de que baje la reputación.',
    campos: [
      {
        key: 'ubicacion',
        label: 'Dónde se inserta en la página',
        tipo: 'ubicacion',
        porDefecto: 'final',
        ayuda: 'En la ficha de producto, «al final» lo deja debajo del botón de compra, que es donde aparece la pregunta.',
      },
      {
        key: 'dias_envio',
        label: 'Días hasta despachar',
        tipo: 'numero',
        porDefecto: 1,
        min: 0,
        max: 30,
        ayuda: 'Cuánto tardás en entregarlo al correo. En 0 el envío figura hoy mismo.',
      },
      {
        key: 'dias_entrega',
        label: 'Días de tránsito (después del despacho)',
        tipo: 'numero',
        porDefecto: 5,
        min: 1,
        max: 60,
        ayuda: 'Lo que tarda el correo desde que lo retira. Si dudás, poné el plazo más largo.',
      },
      {
        key: 'corte',
        label: 'Hora de corte para despachar hoy',
        tipo: 'numero',
        porDefecto: 18,
        min: 0,
        max: 23,
        ayuda: 'En hora del día (18 = seis de la tarde). Después de esa hora, toda la cuenta se corre un día.',
      },
      {
        key: 'mostrar_limite',
        label: 'Mostrar la hora límite',
        tipo: 'booleano',
        porDefecto: false,
        ayuda:
          'Agrega «antes de las 18:00» debajo de «Hoy». Desaparece solo una vez pasada la hora, así nunca queda diciendo algo que ya no se cumple.',
      },
      {
        key: 'rango',
        label: 'Mostrar la entrega como rango de dos días',
        tipo: 'booleano',
        porDefecto: true,
        ayuda: 'Muestra «29 - 30 jul» en vez de un solo día. Un rango se cumple más fácil que una fecha exacta.',
      },
      {
        key: 'sabados',
        label: 'También se despacha los sábados',
        tipo: 'booleano',
        porDefecto: false,
        ayuda: 'Apagado, el sábado y el domingo no cuentan. Prendelo solo si de verdad despachás los sábados.',
      },
      {
        key: 'nota',
        label: 'Aclaración al pie',
        tipo: 'texto',
        porDefecto: '* Fechas aproximadas',
        ayuda: 'Vacío = sin aclaración. Conviene dejarla: es lo que evita el reclamo por un día de diferencia.',
      },
      {
        key: 'et_compra',
        label: 'Nombre del primer paso',
        tipo: 'texto',
        porDefecto: 'Compra',
        ayuda: 'Debajo aparece «Hoy» o «Mañana», según la hora de corte.',
      },
      {
        key: 'et_envio',
        label: 'Nombre del segundo paso',
        tipo: 'texto',
        porDefecto: 'Envío',
        ayuda: 'El momento en que sale de acá.',
      },
      {
        key: 'et_entrega',
        label: 'Nombre del tercer paso',
        tipo: 'texto',
        porDefecto: 'Entrega',
        ayuda: 'Cuándo lo tiene en la mano.',
      },
      {
        key: 'iconos',
        label: 'Íconos',
        tipo: 'select',
        porDefecto: 'linea',
        ayuda: 'Los de línea toman el color elegido y se ven parejos en cualquier equipo. Los emojis dependen del sistema de cada visitante.',
        opciones: [
          { value: 'linea', label: 'De línea (recomendado)' },
          { value: 'emoji', label: 'Emojis' },
        ],
      },
      {
        key: 'fondo',
        label: 'Fondo',
        tipo: 'select',
        porDefecto: 'suave',
        ayuda: 'El recuadro separa la línea de tiempo del resto de la ficha.',
        opciones: [
          { value: 'suave', label: 'Recuadro suave' },
          { value: 'ninguno', label: 'Sin fondo' },
        ],
      },
      {
        key: 'color',
        label: 'Color de íconos y fechas',
        tipo: 'color',
        porDefecto: 'sage',
        ayuda: 'Los íconos, las fechas y la línea que une los pasos.',
      },
      {
        key: 'color_texto',
        label: 'Color de los nombres de paso',
        tipo: 'color',
        porDefecto: 'profundo',
        ayuda: 'Compra, Envío y Entrega. Conviene un poco más oscuro que las fechas.',
      },
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
    slug: 'desglose_pack',
    nombre: 'Qué incluye el pack',
    descripcion:
      'Desarma el precio en las piezas que vienen adentro y las enfrenta con lo que se paga. Justifica el número en vez de solo mostrarlo.',
    categoria: 'conversion',
    contextos: ['producto', 'tienda'],
    bloque: true,
    uso:
      'No se carga ningún precio acá: el valor de cada pieza sale del precio de lista que la página ya muestra, repartido según el peso que le des a cada una. Si cambiás el precio en Tiendanube, el desglose se acomoda solo. Sin precio tachado en la página, muestra las piezas sin importes.',
    cuidado:
      'Los pesos tienen que reflejar lo que cada pieza vale de verdad. Inflar una para agrandar el ahorro se nota, y en un producto caro la desconfianza es el freno que ya tenés.',
    campos: [
      {
        key: 'ubicacion',
        label: 'Dónde se inserta en la página',
        tipo: 'ubicacion',
        porDefecto: 'medio',
        ayuda: 'Va bien después de la comparativa: primero por qué conviene, después cuánto vale.',
      },
      { key: 'titulo', label: 'Título', tipo: 'texto', porDefecto: 'Lo que incluye este pack', ayuda: 'Vacío = sin encabezado.' },
      {
        key: 'intro',
        label: 'Bajada',
        tipo: 'texto',
        porDefecto: 'Tres piezas que se venden juntas y trabajan como un solo equipo.',
        ayuda: 'Una línea abajo del título. Vacío = no se muestra.',
      },
      {
        key: 'items',
        label: 'Piezas del pack',
        tipo: 'lista',
        maxItems: 6,
        ayuda: 'Se muestran en este orden. La pieza principal va primero.',
        campos: [
          { key: 'nombre', label: 'Pieza', tipo: 'texto', ayuda: 'Cómo se llama en la caja.' },
          { key: 'detalle', label: 'Qué hace', tipo: 'texto', ayuda: 'Media línea. Es lo que convierte una lista de nombres en una razón para pagar.' },
          {
            key: 'peso',
            label: 'Cuánto pesa en el precio',
            tipo: 'numero',
            porDefecto: 1,
            min: 0,
            max: 100,
            ayuda: 'Proporción, no pesos. Si ponés 70 / 22 / 8, la primera pieza se lleva el 70 % del precio de lista. Los números se reparten solos, así que no hace falta que sumen 100.',
          },
        ],
      },
      {
        key: 'etiqueta_total',
        label: 'Cómo llamar a la suma',
        tipo: 'texto',
        porDefecto: 'Valor de las 3 piezas',
        ayuda: 'La fila tachada. Es el precio de lista de la página, no un número aparte.',
      },
      {
        key: 'etiqueta_pack',
        label: 'Cómo llamar al precio final',
        tipo: 'texto',
        porDefecto: 'Precio del pack completo',
        ayuda: 'La fila destacada, con el precio que realmente se paga hoy.',
      },
      {
        key: 'mostrar_ahorro',
        label: 'Mostrar cuánto ahorra',
        tipo: 'booleano',
        porDefecto: true,
        ayuda: 'El monto en pesos además del porcentaje. El monto pega más fuerte que el %.',
      },
      {
        key: 'mostrar_transferencia',
        label: 'Sumar el precio con transferencia',
        tipo: 'booleano',
        porDefecto: true,
        ayuda: 'El descuento por medio de pago que ya calcula Tiendanube, como fila propia. El renglón nativo es chico y se pierde justo para quien está mirando números.',
      },
      {
        key: 'nota',
        label: 'Nota al pie',
        tipo: 'texto',
        porDefecto: 'Las tres se despachan juntas en el mismo envío. No se venden por separado.',
        ayuda: 'Si las piezas no están publicadas sueltas, conviene decirlo: alguien que las busca y no las encuentra desconfía del precio.',
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
  {
    slug: 'progreso_envio',
    nombre: 'Progreso a envío gratis',
    descripcion:
      'Barra que dice cuánto falta para llegar al envío gratis. Sube el ticket promedio sin descuentos: la persona agrega para no perder el beneficio.',
    categoria: 'conversion',
    contextos: ['tienda', 'producto'],
    bloque: true,
    uso:
      'Lee el total del carrito de Tiendanube en vivo y se actualiza sola cuando agregan o sacan algo. Con el carrito vacío no se muestra: sin nada adentro el mensaje no significa nada.',
    cuidado:
      'El monto de acá tiene que ser el mismo que tenés configurado como envío gratis en Tiendanube. Si no coinciden, prometés un beneficio que el checkout no da.',
    campos: [
      {
        key: 'ubicacion',
        label: 'Dónde se inserta en la página',
        tipo: 'ubicacion',
        porDefecto: 'inicio',
        ayuda: 'Se elige de la lista. Rinde arriba, donde se ve antes de seguir comprando.',
      },
      {
        key: 'objetivo',
        label: 'Monto para envío gratis',
        tipo: 'numero',
        porDefecto: 0,
        min: 0,
        max: 100000000,
        ayuda: 'En pesos, sin puntos ni signo. Tiene que ser exactamente el que configuraste en Tiendanube.',
      },
      {
        key: 'texto_falta',
        label: 'Mensaje mientras falta',
        tipo: 'texto',
        porDefecto: 'Te falta',
        ayuda: 'El monto que falta se agrega solo después de este texto.',
      },
      {
        key: 'texto_logrado',
        label: 'Mensaje al llegar',
        tipo: 'texto',
        porDefecto: '¡Listo! Tenés envío gratis',
        ayuda: 'Lo que se lee cuando ya superó el monto. Corto y celebratorio.',
      },
      {
        key: 'fijo',
        label: 'Fijar al borde inferior',
        tipo: 'booleano',
        porDefecto: false,
        ayuda:
          'Queda flotando abajo, siempre visible. Ojo: si también usás la barra de acción fija, las dos pelean por el mismo lugar.',
      },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'pack_complementarios',
    nombre: 'Pack de complementarios',
    descripcion:
      'Casillas con productos que suman al principal, y un botón que agrega todo junto. Es el "comprados juntos habitualmente" de Amazon: el momento de mayor disposición a sumar es justo antes de comprar.',
    categoria: 'conversion',
    contextos: ['tienda', 'producto'],
    bloque: true,
    uso:
      'Los productos se eligen de un desplegable con tu catálogo real de Tiendanube. El precio se lee en vivo del catálogo, no se carga acá. Al tocar el botón se agregan al carrito los que estén tildados.',
    cuidado:
      'Tres productos como máximo funcionan mejor que cinco. Y que sean de verdad complementarios: ofrecer algo que no tiene que ver hace dudar de todo lo demás.',
    campos: [
      {
        key: 'ubicacion',
        label: 'Dónde se inserta en la página',
        tipo: 'ubicacion',
        porDefecto: 'antes_final',
        ayuda: 'Rinde cerca del botón de compra, cuando ya decidió llevarlo.',
      },
      {
        key: 'titulo',
        label: 'Título',
        tipo: 'texto',
        porDefecto: 'Sumá lo que te va a hacer falta',
        ayuda: 'Que hable de la necesidad, no de la venta.',
      },
      {
        key: 'items',
        label: 'Productos',
        tipo: 'lista',
        maxItems: 4,
        ayuda: 'Se muestran en este orden, todos tildados de entrada. El visitante destilda lo que no quiera.',
        campos: [
          {
            key: 'producto',
            label: 'Producto',
            tipo: 'producto',
            ayuda: 'Se elige de tu catálogo de Tiendanube. El nombre y el precio salen de ahí, siempre actualizados.',
          },
          {
            key: 'nota',
            label: 'Por qué conviene',
            tipo: 'texto',
            ayuda: 'Media línea explicando para qué le sirve. Sin esto es solo otro producto más.',
          },
        ],
      },
      {
        key: 'etiqueta',
        label: 'Texto del botón',
        tipo: 'texto',
        porDefecto: 'Agregar al carrito',
        ayuda: 'El botón agrega los tildados y lleva al carrito.',
      },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'viendo_ahora',
    nombre: 'Gente viendo ahora',
    descripcion:
      'Cuántas personas están mirando esta misma página en este momento. El dato sale de visitantes reales presentes, no de un número al azar.',
    categoria: 'conversion',
    contextos: ['producto', 'tienda'],
    bloque: true,
    uso:
      'El navegador de cada visitante avisa que está en la página y vuelve a avisar cada 45 segundos mientras la pestaña esté a la vista. Se cuentan los presentes de los últimos minutos, y el número se refresca solo sin recargar. Si no llega al mínimo configurado, el widget no se muestra: mejor nada que "1 persona".',
    cuidado:
      'Este número es verificable: alguien puede abrir la página en dos dispositivos y contar. Si el factor de corrección está alto, el widget dice algo que se puede desmentir en treinta segundos, y eso cuesta más de lo que suma. Conviene contrastarlo contra los usuarios activos de GA4 en tiempo real antes de fijarlo.',
    campos: [
      {
        key: 'ubicacion',
        label: 'Dónde se inserta en la página',
        tipo: 'ubicacion',
        porDefecto: 'tras_intro',
        ayuda: 'Cerca del precio o del botón de compra es donde pesa.',
      },
      {
        key: 'plantilla',
        label: 'Texto',
        tipo: 'texto',
        porDefecto: '{n} personas están viendo este producto',
        ayuda: 'Escribí {n} donde va el número. Si queda en 1, el texto se ajusta solo al singular.',
      },
      {
        key: 'factor',
        label: 'Factor de corrección',
        tipo: 'numero',
        min: 1,
        max: 5,
        porDefecto: 3,
        ayuda:
          'Multiplica el conteo real para compensar visitantes que no se registran (bloqueadores, JS desactivado, navegación privada). En 1 se muestra el dato crudo. Cuanto más alto, más se aleja de lo verificable.',
      },
      {
        key: 'minimo',
        label: 'No mostrar si son menos de',
        tipo: 'numero',
        min: 2,
        max: 20,
        porDefecto: 3,
        ayuda: 'Por debajo de este número el widget no aparece. Evita el "1 persona está viendo", que resta en vez de sumar.',
      },
      {
        key: 'ventana',
        label: 'Minutos que cuenta como "ahora"',
        tipo: 'numero',
        min: 1,
        max: 10,
        porDefecto: 3,
        ayuda: 'Cuánto sigue contando alguien después de su último aviso. Tres minutos es lo habitual.',
      },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'upsell_upgrade',
    nombre: 'Pasar a la versión superior',
    descripcion:
      'Compara lo que está mirando con una versión mejor y muestra la diferencia de precio. Es más fácil aceptar "por $40.000 más" que decidir de nuevo desde cero.',
    categoria: 'conversion',
    contextos: ['tienda', 'producto'],
    bloque: true,
    uso:
      'La diferencia de precio se calcula sola: precio del superior menos el que muestra la página. No se carga ningún monto acá. El botón agrega la versión superior al carrito.',
    cuidado:
      'Un solo escalón hacia arriba. Ofrecer el más caro de todos desde un producto de entrada no sube el ticket: hace sentir que lo que eligió estaba mal.',
    campos: [
      {
        key: 'ubicacion',
        label: 'Dónde se inserta en la página',
        tipo: 'ubicacion',
        porDefecto: 'tras_intro',
        ayuda: 'Cerca del precio, mientras todavía está comparando.',
      },
      {
        key: 'titulo',
        label: 'Título',
        tipo: 'texto',
        porDefecto: 'Por un poco más, la versión completa',
        ayuda: 'Que el foco sea la diferencia, no el precio total.',
      },
      {
        key: 'producto',
        label: 'Versión superior',
        tipo: 'producto',
        ayuda: 'Del catálogo real. Su precio se lee en vivo, así que la diferencia nunca queda vieja.',
      },
      {
        key: 'items',
        label: 'Qué suma respecto de lo que está mirando',
        tipo: 'lista',
        maxItems: 5,
        ayuda: 'Solo las diferencias, no la lista completa de características. Tres bastan.',
        campos: [
          { key: 'texto', label: 'Diferencia', tipo: 'texto', ayuda: 'Un renglón, en positivo: qué gana.' },
        ],
      },
      {
        key: 'etiqueta',
        label: 'Texto del botón',
        tipo: 'texto',
        porDefecto: 'Quiero la versión completa',
        ayuda: 'En primera persona rinde más que un "Comprar".',
      },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'crosssell_carrito',
    nombre: 'Complementos según el carrito',
    descripcion:
      'Ofrece un producto solo cuando el carrito ya tiene otro. Es el cross-sell honesto: no sugiere al azar, sugiere lo que le va a hacer falta por lo que ya eligió.',
    categoria: 'conversion',
    contextos: ['tienda', 'producto'],
    bloque: true,
    uso:
      'Lee el carrito de Tiendanube en vivo. Cada regla dice "si lleva A, ofrecer B". Si no se cumple ninguna, el widget no aparece; y nunca ofrece algo que ya está en el carrito.',
    cuidado:
      'Que el complemento sea de verdad necesario para lo que compró. Ofrecer algo sin relación en el último paso hace dudar de todo lo anterior.',
    campos: [
      {
        key: 'ubicacion',
        label: 'Dónde se inserta en la página',
        tipo: 'ubicacion',
        porDefecto: 'final',
        ayuda: 'Se elige de la lista.',
      },
      {
        key: 'titulo',
        label: 'Título',
        tipo: 'texto',
        porDefecto: 'Con lo que llevás, esto te va a hacer falta',
        ayuda: 'Que hable de su compra, no de la tuya.',
      },
      {
        key: 'items',
        label: 'Reglas',
        tipo: 'lista',
        maxItems: 6,
        ayuda: 'Se evalúan todas y se muestra lo que corresponda, sin repetir.',
        campos: [
          {
            key: 'si_lleva',
            label: 'Si el carrito tiene…',
            tipo: 'producto',
            ayuda: 'El producto que dispara la sugerencia.',
          },
          {
            key: 'ofrecer',
            label: '…ofrecer',
            tipo: 'producto',
            ayuda: 'El complemento. Su precio se lee del catálogo.',
          },
          {
            key: 'nota',
            label: 'Por qué',
            tipo: 'texto',
            ayuda: 'Media línea que explique la relación entre los dos. Sin esto es solo otro producto.',
          },
        ],
      },
      {
        key: 'etiqueta',
        label: 'Texto del botón',
        tipo: 'texto',
        porDefecto: 'Sumar al carrito',
        ayuda: 'Agrega sin sacar al visitante de donde está.',
      },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'upsell_al_agregar',
    nombre: 'Oferta al agregar al carrito',
    descripcion:
      'Ventana que aparece justo después de agregar algo al carrito. Es el momento de mayor disposición a sumar: ya decidió comprar y todavía no salió del envión.',
    categoria: 'conversion',
    contextos: ['tienda', 'producto'],
    uso:
      'Se dispara sola con el evento de Tiendanube al agregar al carrito. No necesita que prepares nada. Aparece una sola vez por visita, aunque agreguen varias cosas.',
    cuidado:
      'Una sola oferta, y que tenga que ver con lo que acaba de poner. Una ventana que interrumpe la compra con algo irrelevante es la forma más cara de perder un carrito armado.',
    campos: [
      {
        key: 'titulo',
        label: 'Título',
        tipo: 'texto',
        porDefecto: 'Antes de seguir…',
        ayuda: 'Corto. Ya tiene la atención, no hace falta pelearla.',
      },
      {
        key: 'texto',
        label: 'Texto',
        tipo: 'textarea',
        ayuda: 'Un renglón sobre por qué le sirve junto con lo que acaba de agregar.',
      },
      {
        key: 'producto',
        label: 'Producto ofrecido',
        tipo: 'producto',
        ayuda: 'Del catálogo real. Nombre, precio e imagen salen de ahí.',
      },
      {
        key: 'etiqueta',
        label: 'Texto del botón',
        tipo: 'texto',
        porDefecto: 'Sumarlo a mi pedido',
        ayuda: 'Agrega el producto y cierra la ventana, sin sacarlo de donde estaba.',
      },
      {
        key: 'rechazo',
        label: 'Texto para rechazar',
        tipo: 'texto',
        porDefecto: 'No, gracias',
        ayuda: 'Tiene que estar y ser fácil de encontrar. Esconder la salida convierte una oferta en una trampa.',
      },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'media',
    nombre: 'Imagen o animación',
    descripcion:
      'Una imagen, un GIF o un video corto en bucle, con marco y proporción a elección. Para mostrar en movimiento lo que en texto necesita tres párrafos.',
    categoria: 'contenido',
    contextos: ['guias', 'tienda', 'producto'],
    bloque: true,
    uso:
      'Se inserta donde elijas. El archivo NO se sube como viene: las fotos se achican y pasan a WebP, y los GIF se convierten a video, que pesa hasta veinte veces menos y se ve igual. Un GIF de 50 MB terminaría pesando menos de 3 MB.',
    cuidado:
      'La proporción recorta al centro para que la pieza entre siempre bien en su lugar. Si lo importante está en un borde, conviene recortar antes de subir o elegir «como venga el archivo».',
    campos: [
      {
        key: 'ubicacion',
        label: 'Dónde se inserta en la página',
        tipo: 'ubicacion',
        porDefecto: 'medio',
        ayuda: 'Se elige de la lista.',
      },
      {
        key: 'archivo',
        label: 'Archivo',
        tipo: 'media',
        ayuda: 'El video va en bucle, sin sonido y sin controles: se comporta como el GIF que reemplaza.',
      },
      {
        key: 'proporcion',
        label: 'Proporción',
        tipo: 'select',
        porDefecto: '16:9',
        ayuda:
          'Define el lugar que ocupa. Elegirla evita el salto del texto mientras carga y que una imagen mal medida deforme la página.',
        opciones: [
          { value: '16:9', label: 'Apaisado (16:9) — 1600 × 900 px' },
          { value: '4:3', label: 'Clásico (4:3) — 1600 × 1200 px' },
          { value: '1:1', label: 'Cuadrado (1:1) — 1200 × 1200 px' },
          { value: '4:5', label: 'Vertical (4:5) — 1080 × 1350 px' },
          { value: 'original', label: 'Como venga el archivo' },
        ],
      },
      {
        key: 'marco',
        label: 'Marco',
        tipo: 'select',
        porDefecto: 'redondo',
        ayuda: 'El círculo solo queda bien con proporción cuadrada.',
        opciones: [
          { value: 'ninguno', label: 'Sin marco' },
          { value: 'suave', label: 'Esquinas suaves' },
          { value: 'redondo', label: 'Esquinas redondeadas' },
          { value: 'circulo', label: 'Círculo' },
        ],
      },
      {
        key: 'borde',
        label: 'Línea de contorno',
        tipo: 'booleano',
        porDefecto: false,
        ayuda: 'Una línea fina del color elegido. Ayuda cuando la imagen tiene fondo claro y se pierde contra la página.',
      },
      {
        key: 'epigrafe',
        label: 'Epígrafe',
        tipo: 'texto',
        ayuda: 'Opcional, va debajo. Sirve para aclarar qué se está viendo; también lo leen los buscadores.',
      },
      {
        key: 'alt',
        label: 'Descripción para quien no puede verla',
        tipo: 'texto',
        ayuda:
          'Qué se ve, en una frase. Lo usan los lectores de pantalla y los buscadores. Si queda vacío, se usa el epígrafe.',
      },
      {
        key: 'ancho',
        label: 'Ancho',
        tipo: 'select',
        porDefecto: 'completo',
        ayuda: 'Hasta dónde se estira dentro del texto.',
        opciones: [
          { value: 'completo', label: 'Todo el ancho del texto' },
          { value: 'medio', label: 'La mitad, centrada' },
          { value: 'chico', label: 'Chica, centrada' },
        ],
      },
      CAMPO_COLOR,
    ],
  },
]

// La animación de entrada es común a todos los widgets de bloque: se suma acá una sola vez, al
// final de cada uno, en vez de repetir el campo veinte veces. Los flotantes no la llevan porque
// no pasan por verUnaVez (tienen su propia aparición).
export const TIPOS: TipoWidget[] = TIPOS_BASE.map(t =>
  t.bloque && !t.campos.some(c => c.key === 'animacion')
    ? { ...t, campos: [...t.campos, CAMPO_ANIMACION] }
    : t,
)

/**
 * Ids de producto referenciados por una config, mirando la declaración del tipo.
 *
 * Genérico a propósito: un widget nuevo que use campos de tipo `producto` —sueltos o
 * dentro de una lista— queda resuelto sin tocar la API. La alternativa era que cada
 * widget que menciona productos tuviera su caso especial en el endpoint público, que es
 * justo lo que este motor evita.
 */
export function idsDeProducto(tipo: TipoWidget, config: Record<string, unknown>): string[] {
  const ids: string[] = []
  for (const c of tipo.campos) {
    if (c.tipo === 'producto') {
      const v = String(config?.[c.key] ?? '')
      if (v) ids.push(v)
    } else if (c.tipo === 'lista') {
      const items = Array.isArray(config?.[c.key]) ? (config[c.key] as Record<string, unknown>[]) : []
      for (const item of items) {
        for (const sub of c.campos ?? []) {
          if (sub.tipo !== 'producto') continue
          const v = String(item?.[sub.key] ?? '')
          if (v) ids.push(v)
        }
      }
    }
  }
  return [...new Set(ids)]
}

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
      case 'color': {
        if (PALETA.some(p => p.value === v)) return v
        // Además de la paleta se admite un código propio, para campañas o fechas puntuales
        // que piden un color que no es de marca. Se acepta SOLO #rrggbb: cualquier otra
        // cosa termina metida dentro de una hoja de estilos que se sirve a los visitantes.
        const hex = String(v ?? '').trim().toLowerCase()
        if (/^#[0-9a-f]{6}$/.test(hex)) return hex
        if (/^#[0-9a-f]{3}$/.test(hex)) {
          return '#' + hex.slice(1).split('').map(x => x + x).join('')
        }
        return 'sage'
      }
      case 'media':
        // Solo URLs del almacén propio. Sin esto, la config puede terminar apuntando a un
        // archivo de cualquier servidor, que además de romperse cuando ese servidor cambia
        // le cuenta a un tercero quién visita el sitio.
        return /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(String(v ?? ''))
          ? String(v)
          : ''
      case 'producto':
        // Solo el id numérico de Tiendanube; el nombre y el precio se leen en vivo.
        return /^\d{1,12}$/.test(String(v ?? '')) ? String(v) : ''
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
