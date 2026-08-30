// Piezas visuales compartidas del panel de widgets y de reseñas.
//
// Sistema de diseño: grafito + ámbar (el mismo del panel entero, ver globals.css
// y componentes/panel/Primitivos.tsx). Reemplaza al "Neutro premium + salvia"
// del 23/07/26. Los tokens se declaran UNA vez acá y todos los editores los
// usan, así widgets, reseñas y el resto del panel comparten superficie.

/** Acento del panel: ámbar. */
export const ACENTO = 'var(--pnl-amber)'
/** Fuente de títulos — Barlow Semi Condensed, la del resto del panel. */
export const TITULO = "'Barlow Semi Condensed', 'Barlow', sans-serif"

/** Tarjeta base: superficie opaca, igual que las del resto del panel. */
export const CARD =
  'rounded-md border border-[var(--pnl-hair)] bg-[var(--pnl-panel)]'

/** Campo de formulario. */
export const INPUT =
  'w-full rounded-md border border-[var(--pnl-hair)] bg-[var(--pnl-panel-2)] px-3 py-2 text-sm text-[var(--pnl-text)] ' +
  'placeholder:text-[var(--pnl-text-3)] focus:border-[var(--pnl-track)] focus-visible:outline-2 focus-visible:outline-[var(--pnl-amber)] ' +
  'transition-colors'

/** Rótulo de campo — eyebrow. */
export const LABEL = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--pnl-text-3)]'

// ── Escala de encabezados ────────────────────────────────────────────────────
// La regla para que la vista descanse: cada nivel tiene que verse claramente más
// grande y más oscuro que el de abajo. No repetir el mismo eyebrow chico para el
// título de una sección y para un rótulo menor — ahí es donde todo se aplana.
//
//   H1  30px        →  el nombre de la pantalla
//   SECCION  18px semibold   →  qué es este bloque (Catálogo, Rendimiento…)
//   SUBSECCION  15px semibold    →  título de una tarjeta o grupo
//   EYEBROW  11px mayúsc muted   →  rótulos y unidades, el piso de la escala

/** Título de sección: el nivel que ordena la página. Grande y claro, se lee de un vistazo. */
export const SECCION = 'text-xl font-semibold tracking-tight text-[var(--pnl-text)]'

/** Bajada de sección: una línea de contexto debajo del título, en cuerpo legible. */
export const SECCION_SUB = 'text-[13px] leading-relaxed text-[var(--pnl-text-2)]'

/** Título de una tarjeta o grupo dentro de una sección. */
export const SUBSECCION = 'text-[15px] font-semibold tracking-tight text-[var(--pnl-text)]'

/** Micro-rótulo (unidades, contadores, "apagado"). El piso de la escala. */
export const EYEBROW = 'text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--pnl-text-3)]'

// ── Tonos de panel ───────────────────────────────────────────────────────────
// Tarjetas de indicador tintadas con el color de su categoría (menta / celeste / durazno /
// violeta). Tintes muy bajos: el color titula, el número —en blanco— manda la lectura.
// Mismos colores de categoría de más abajo.
export const TONOS = {
  salvia:  { fondo: 'color-mix(in srgb, var(--pnl-green) 10%, var(--pnl-panel))', borde: 'color-mix(in srgb, var(--pnl-green) 22%, transparent)' },
  celeste: { fondo: 'color-mix(in srgb, var(--pnl-lilac) 10%, var(--pnl-panel))', borde: 'color-mix(in srgb, var(--pnl-lilac) 22%, transparent)' },
  durazno: { fondo: 'color-mix(in srgb, var(--pnl-amber) 10%, var(--pnl-panel))', borde: 'color-mix(in srgb, var(--pnl-amber) 22%, transparent)' },
  violeta: { fondo: 'color-mix(in srgb, var(--pnl-lilac-soft) 10%, var(--pnl-panel))', borde: 'color-mix(in srgb, var(--pnl-lilac-soft) 22%, transparent)' },
} as const

export type TonoKey = keyof typeof TONOS

/** Panel oscuro de contraste. */
export const PANEL_OSCURO = 'var(--pnl-page)'

/** Texto de ayuda debajo del campo. */
export const AYUDA = 'mt-1.5 text-[13px] leading-relaxed text-[var(--pnl-text-2)]'

/** Advertencia: ámbar, la misma línea de contraste que el resto del panel. */
export const AVISO = 'text-xs leading-relaxed text-[var(--pnl-amber)]'

/** Botón secundario. */
export const BTN =
  'min-h-9 rounded-md border border-[var(--pnl-hair)] bg-[var(--pnl-panel-2)] px-3 py-1.5 text-xs font-medium text-[var(--pnl-text-2)] ' +
  'hover:border-[var(--pnl-track)] hover:text-[var(--pnl-text)] transition-all disabled:opacity-30'

// ── Categorías ───────────────────────────────────────────────────────────────
// Cada widget declara su categoría en lib/widgets/tipos.ts. Acá se le pone nombre, color y
// —lo importante— para qué sirve la categoría: elegir widget es elegir qué palanca tocar,
// no qué dibujito queda lindo.
// Los colores van en hex (no var(--pnl-*)) porque el código los concatena con
// transparencia (`${cat.color}22`, `${cat.color}88`) en varias tarjetas — eso
// no es válido sobre un var(). Son los mismos hex que los tokens --pnl-amber,
// --pnl-green, --pnl-lilac y --pnl-lilac-soft.
export const CATEGORIAS = {
  conversion: {
    label: 'Conversión',
    icono: '🎯',
    color: '#F5A623',
    para: 'Empujan la decisión: acercan el pago, la consulta o el clic.',
  },
  confianza: {
    label: 'Confianza',
    icono: '🛡️',
    color: '#4CAF7D',
    para: 'Bajan la desconfianza, que es el freno número uno.',
  },
  captura: {
    label: 'Captura',
    icono: '✉️',
    color: '#7E86B8',
    para: 'Se quedan con el contacto: quien no compra hoy sigue siendo alcanzable.',
  },
  contenido: {
    label: 'Contenido',
    icono: '📖',
    color: '#969DC9',
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
  corte_despacho: '🕒',
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
