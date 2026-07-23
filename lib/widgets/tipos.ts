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
