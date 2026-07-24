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

// ── Modo premium oscuro (24/07/26) ────────────────────────────────────────────
// El panel dejó de ser una isla clara: ahora comparte el tema oscuro glass del resto del
// dashboard (fondo #07070f, tarjetas white/[0.02], acento salvia vía --ac). Los componentes
// shadcn se dan vuelta con la clase `dark` en el <main>; estos tokens cubren lo hardcodeado.

/** Acento holográfico (violeta-índigo) legible sobre oscuro, a tono con el dashboard. */
export const ACENTO = '#a5b4fc'
/** Fuente de títulos — Fraunces, servida por el layout como variable. */
export const TITULO = 'var(--font-fraunces), Georgia, serif'

/** Tarjeta base: glass sutil, igual que las del dashboard. */
export const CARD =
  'rounded-2xl border border-white/[0.06] bg-white/[0.02]'

/** Campo de formulario glass sobre oscuro. */
export const INPUT =
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/80 ' +
  'placeholder:text-white/30 focus:border-white/25 focus:ring-2 focus:ring-white/10 ' +
  'focus:outline-none transition-colors'

/** Rótulo de campo — eyebrow Manrope. */
export const LABEL = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45'

// ── Escala de encabezados ────────────────────────────────────────────────────
// La regla para que la vista descanse: cada nivel tiene que verse claramente más
// grande y más oscuro que el de abajo. No repetir el mismo eyebrow chico para el
// título de una sección y para un rótulo menor — ahí es donde todo se aplana.
//
//   H1  Fraunces 30px ink        →  el nombre de la pantalla
//   SECCION  18px semibold ink   →  qué es este bloque (Catálogo, Rendimiento…)
//   SUBSECCION  15px semibold    →  título de una tarjeta o grupo
//   EYEBROW  11px mayúsc muted   →  rótulos y unidades, el piso de la escala

/** Título de sección: el nivel que ordena la página. Grande y claro, se lee de un vistazo. */
export const SECCION = 'text-xl font-semibold tracking-tight text-white'

/** Bajada de sección: una línea de contexto debajo del título, en cuerpo legible. */
export const SECCION_SUB = 'text-[13px] leading-relaxed text-white/55'

/** Título de una tarjeta o grupo dentro de una sección. */
export const SUBSECCION = 'text-[15px] font-semibold tracking-tight text-white'

/** Micro-rótulo (unidades, contadores, "apagado"). El piso de la escala. */
export const EYEBROW = 'text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45'

// ── Tonos de panel ───────────────────────────────────────────────────────────
// Tarjetas de indicador glass, tintadas con el color de su categoría (menta / celeste /
// durazno / violeta) sobre el fondo oscuro. Tintes muy bajos: el color titula, el número —en
// blanco— manda la lectura. Mismos colores de categoría de más abajo.
export const TONOS = {
  salvia:  { fondo: 'rgb(111 138 95 / 0.13)', borde: 'rgb(111 138 95 / 0.22)' },
  celeste: { fondo: 'rgb(95 168 211 / 0.11)', borde: 'rgb(95 168 211 / 0.20)' },
  durazno: { fondo: 'rgb(240 160 60 / 0.11)', borde: 'rgb(240 160 60 / 0.20)' },
  violeta: { fondo: 'rgb(155 140 240 / 0.11)', borde: 'rgb(155 140 240 / 0.20)' },
} as const

export type TonoKey = keyof typeof TONOS

/** Panel oscuro de contraste: ink casi negro. */
export const PANEL_OSCURO = '#191917'

/** Texto de ayuda debajo del campo. */
export const AYUDA = 'mt-1.5 text-[13px] leading-relaxed text-white/50'

/** Advertencia: ámbar legible sobre oscuro. */
export const AVISO = 'text-xs leading-relaxed text-amber-400'

/** Botón secundario glass. */
export const BTN =
  'rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70 ' +
  'hover:border-white/25 hover:text-white transition-all disabled:opacity-30'

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
