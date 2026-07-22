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
      'Botón flotante que abre un mensaje ya escrito en WhatsApp. La asesoría es lo que más convierte: esto la pone a un clic.',
    categoria: 'conversion',
    contextos: ['guias', 'tienda', 'producto'],
    campos: [
      { key: 'numero', label: 'Número (formato internacional, sin +)', tipo: 'texto', placeholder: '5493525623546' },
      { key: 'etiqueta', label: 'Texto del botón', tipo: 'texto', porDefecto: 'Consultanos' },
      {
        key: 'mensaje',
        label: 'Mensaje precargado',
        tipo: 'textarea',
        porDefecto: 'Hola, quería hacer una consulta sobre el equipo.',
      },
      { key: 'posicion', label: 'Posición', tipo: 'select', porDefecto: 'derecha', opciones: [
        { value: 'derecha', label: 'Abajo a la derecha' },
        { value: 'izquierda', label: 'Abajo a la izquierda' },
      ] },
      { key: 'demora', label: 'Aparece después de (segundos)', tipo: 'numero', porDefecto: 3, min: 0, max: 120 },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'cta_producto',
    nombre: 'Bloque de llamada a la acción',
    descripcion:
      'Bloque con título, texto y botón. Es el puente que hoy falta entre el blog (51% de las impresiones) y el producto.',
    categoria: 'conversion',
    contextos: ['guias', 'tienda', 'producto'],
    campos: [
      { key: 'titulo', label: 'Título', tipo: 'texto' },
      { key: 'texto', label: 'Texto', tipo: 'textarea' },
      { key: 'etiqueta', label: 'Texto del botón', tipo: 'texto', porDefecto: 'Ver el equipo' },
      { key: 'url', label: 'Enlace del botón', tipo: 'url' },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'barra_accion',
    nombre: 'Barra de acción fija',
    descripcion:
      'Barra pegada abajo con el precio y el botón de compra. Ataca la caída de add-to-cart en celular.',
    categoria: 'conversion',
    contextos: ['tienda', 'producto'],
    campos: [
      { key: 'etiqueta', label: 'Texto del botón', tipo: 'texto', porDefecto: 'Agregar al carrito' },
      { key: 'mostrar_precio', label: 'Mostrar el precio', tipo: 'booleano', porDefecto: true },
      { key: 'solo_movil', label: 'Solo en celular', tipo: 'booleano', porDefecto: true },
      { key: 'scroll', label: 'Aparece tras desplazar (%)', tipo: 'numero', porDefecto: 25, min: 0, max: 100 },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'resenas',
    nombre: 'Reseñas verificadas',
    descripcion:
      'Reseñas de compradores reales, con sello de compra verificada. Salen de la base, no se cargan a mano.',
    categoria: 'confianza',
    contextos: ['tienda', 'producto', 'guias'],
    datosVivos: 'resenas',
    campos: [
      { key: 'titulo', label: 'Título', tipo: 'texto', porDefecto: 'Lo que dicen quienes ya lo usan' },
      { key: 'cantidad', label: 'Cuántas mostrar', tipo: 'numero', porDefecto: 6, min: 1, max: 30 },
      { key: 'sello', label: 'Mostrar sello de compra verificada', tipo: 'booleano', porDefecto: true },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'faq',
    nombre: 'Preguntas frecuentes',
    descripcion: 'Acordeón de preguntas y respuestas. Se carga con las objeciones reales que llegan por WhatsApp.',
    categoria: 'confianza',
    contextos: ['guias', 'tienda', 'producto'],
    campos: [
      { key: 'titulo', label: 'Título', tipo: 'texto', porDefecto: 'Preguntas frecuentes' },
      {
        key: 'items',
        label: 'Preguntas',
        tipo: 'lista',
        maxItems: 20,
        campos: [
          { key: 'pregunta', label: 'Pregunta', tipo: 'texto' },
          { key: 'respuesta', label: 'Respuesta', tipo: 'textarea' },
        ],
      },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'beneficios',
    nombre: 'Lista de beneficios',
    descripcion: 'Lista con íconos. Habla de resultados, no de componentes.',
    categoria: 'confianza',
    contextos: ['guias', 'tienda', 'producto'],
    campos: [
      { key: 'titulo', label: 'Título (opcional)', tipo: 'texto' },
      {
        key: 'items',
        label: 'Beneficios',
        tipo: 'lista',
        maxItems: 10,
        campos: [
          { key: 'icono', label: 'Emoji', tipo: 'texto', placeholder: '🌱' },
          { key: 'texto', label: 'Texto', tipo: 'texto' },
        ],
      },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'garantia',
    nombre: 'Mensaje de garantía',
    descripcion: 'Franja de respaldo bajo el botón de compra: garantía, soporte, quién está atrás.',
    categoria: 'confianza',
    contextos: ['tienda', 'producto'],
    campos: [
      { key: 'titulo', label: 'Título', tipo: 'texto', porDefecto: 'Garantía de 1 año' },
      { key: 'texto', label: 'Texto', tipo: 'textarea' },
      { key: 'icono', label: 'Emoji', tipo: 'texto', porDefecto: '🛡️' },
      CAMPO_COLOR,
    ],
  },
  {
    slug: 'captura_email',
    nombre: 'Captura de email',
    descripcion:
      'Ventana o bloque que pide el email a cambio de algo (la guía en PDF, aviso de stock). Reemplaza al lead magnet cableado en el código.',
    categoria: 'captura',
    contextos: ['guias', 'tienda', 'producto'],
    campos: [
      { key: 'titulo', label: 'Título', tipo: 'texto' },
      { key: 'texto', label: 'Texto', tipo: 'textarea' },
      { key: 'etiqueta', label: 'Texto del botón', tipo: 'texto', porDefecto: 'Quiero recibirla' },
      { key: 'modo', label: 'Cómo aparece', tipo: 'select', porDefecto: 'popup', opciones: [
        { value: 'popup', label: 'Ventana emergente' },
        { value: 'bloque', label: 'Bloque en la página' },
      ] },
      { key: 'demora', label: 'Ventana: aparece a los (segundos)', tipo: 'numero', porDefecto: 15, min: 0, max: 300 },
      { key: 'salida', label: 'Ventana: también al intentar salir', tipo: 'booleano', porDefecto: true },
      { key: 'gracias', label: 'Mensaje de agradecimiento', tipo: 'texto', porDefecto: '¡Listo! Revisá tu correo.' },
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
