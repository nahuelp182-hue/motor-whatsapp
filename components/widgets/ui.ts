// Piezas visuales compartidas del panel de widgets.
//
// Sistema de diseño Micelium (definitivo 23/07/26): "Neutro premium + salvia". Casi
// blanco/negro como Tesla/Samsung, la salvia SOLO como firma. Títulos en Fraunces, cuerpo
// en Manrope, números en DM Mono. Los tokens se declaran UNA vez acá y todos los editores
// los usan, así el panel y el store parecen la misma empresa.
//
// Paleta:  fondo #fafafa · card #fff · alt #f4f4f1 · hairline #e7e7e2
//          ink #171717 · cuerpo #3f3f3c · muted #737373 · faint #a3a3a0
//          acento salvia #6f8a5f · texto-acento #57704a · wash #eef1e9

/** Color de la salvia para texto sobre fondo claro (el #6f8a5f puro queda flojo en blanco). */
export const ACENTO = '#57704a'
/** Fuente de títulos — Fraunces, servida por el layout como variable. */
export const TITULO = 'var(--font-fraunces), Georgia, serif'

/** Tarjeta base: blanca, borde hairline, sombra mínima. */
export const CARD =
  'rounded-2xl border border-[#e7e7e2] bg-white shadow-[0_1px_3px_rgba(23,23,23,0.04)]'

/** Campo de formulario sobre fondo claro. */
export const INPUT =
  'w-full rounded-xl border border-[#e7e7e2] bg-white px-3 py-2 text-sm text-[#171717] ' +
  'placeholder:text-[#a3a3a0] focus:border-[#6f8a5f] focus:ring-2 focus:ring-[#6f8a5f]/15 ' +
  'focus:outline-none transition-colors'

/** Rótulo de campo — eyebrow Manrope. */
export const LABEL = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#737373]'

// ── Escala de encabezados ────────────────────────────────────────────────────
// La regla para que la vista descanse: cada nivel tiene que verse claramente más
// grande y más oscuro que el de abajo. No repetir el mismo eyebrow chico para el
// título de una sección y para un rótulo menor — ahí es donde todo se aplana.
//
//   H1  Fraunces 30px ink        →  el nombre de la pantalla
//   SECCION  18px semibold ink   →  qué es este bloque (Catálogo, Rendimiento…)
//   SUBSECCION  15px semibold    →  título de una tarjeta o grupo
//   EYEBROW  11px mayúsc muted   →  rótulos y unidades, el piso de la escala

/** Título de sección: el nivel que ordena la página. Grande y oscuro, se lee de un vistazo. */
export const SECCION = 'text-lg font-semibold tracking-tight text-[#171717]'

/** Bajada de sección: una línea de contexto debajo del título, en cuerpo legible. */
export const SECCION_SUB = 'text-[13px] leading-relaxed text-[#6b6b68]'

/** Título de una tarjeta o grupo dentro de una sección. */
export const SUBSECCION = 'text-[15px] font-semibold tracking-tight text-[#171717]'

/** Micro-rótulo (unidades, contadores, "apagado"). El piso de la escala. */
export const EYEBROW = 'text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8a86]'

/** Texto de ayuda debajo del campo. */
export const AYUDA = 'mt-1.5 text-[13px] leading-relaxed text-[#6b6b68]'

/** Advertencia: ámbar legible sobre fondo claro. */
export const AVISO = 'text-xs leading-relaxed text-amber-700'

/** Botón secundario. */
export const BTN =
  'rounded-md border border-[#e7e7e2] bg-white px-3 py-1.5 text-xs font-medium text-[#3f3f3c] ' +
  'hover:border-[#171717]/25 hover:text-[#171717] transition-all disabled:opacity-30'

// ── Categorías ───────────────────────────────────────────────────────────────
// Cada widget declara su categoría en lib/widgets/tipos.ts. Acá se le pone nombre, color y
// —lo importante— para qué sirve la categoría: elegir widget es elegir qué palanca tocar,
// no qué dibujito queda lindo.
export const CATEGORIAS = {
  conversion: {
    label: 'Conversión',
    icono: '🎯',
    color: '#f0a03c',
    para: 'Empujan la decisión: acercan el pago, la consulta o el clic.',
  },
  confianza: {
    label: 'Confianza',
    icono: '🛡️',
    color: '#6f9e5f',
    para: 'Bajan la desconfianza, que es el freno número uno.',
  },
  captura: {
    label: 'Captura',
    icono: '✉️',
    color: '#9b8cf0',
    para: 'Se quedan con el contacto: quien no compra hoy sigue siendo alcanzable.',
  },
  contenido: {
    label: 'Contenido',
    icono: '📖',
    color: '#5fa8d3',
    para: 'Explican sin vender. Para cuando la duda es qué es esto, no cuánto cuesta.',
  },
} as const

export type CategoriaKey = keyof typeof CATEGORIAS

export const catDe = (k: string) => CATEGORIAS[k as CategoriaKey] ?? CATEGORIAS.contenido

// ── Íconos por tipo ──────────────────────────────────────────────────────────
// Un ícono por widget para poder recorrer el catálogo con la vista en vez de leyendo
// veinte párrafos. Es reconocimiento, no decoración: el texto largo sigue estando, pero
// pasa a segundo plano (tooltip y editor).
//
// El registro de tipos no declara ícono a propósito — un tipo nuevo sin entrada acá cae en
// el genérico y el panel sigue funcionando, que es la regla del motor.
const ICONOS: Record<string, string> = {
  whatsapp_flotante: '💬',
  cta_producto: '🎯',
  barra_accion: '📌',
  resenas: '⭐',
  faq: '❓',
  beneficios: '✅',
  garantia: '🛡️',
  captura_email: '✉️',
  cuotas: '💳',
  envio_estimado: '🚚',
  pasos: '🔢',
  barra_confianza: '🤝',
  comparador: '⚖️',
  especificaciones: '📋',
  banner_anuncio: '📣',
  cuenta_regresiva: '⏳',
  video: '▶️',
  progreso_envio: '📦',
  pack_complementarios: '🎁',
  viendo_ahora: '👀',
  media: '🖼️',
  upsell_upgrade: '🚀',
  crosssell_carrito: '🧩',
  upsell_al_agregar: '🎁',
}

export const iconoDe = (slug: string) => ICONOS[slug] ?? '🧩'
