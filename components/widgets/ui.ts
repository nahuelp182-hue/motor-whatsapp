// Piezas visuales compartidas del panel de widgets.
//
// El panel vive dentro del dashboard, que es oscuro (globals.css pone el fondo casi negro y
// el texto blanco). Cualquier clase clara heredada de un formulario suelto queda ilegible,
// así que los estilos de campo se declaran UNA vez acá y todos los editores los usan.

/** Tarjeta de vidrio: el mismo tratamiento que MetricCard en el panel de métricas. */
export const CARD =
  'rounded-2xl border border-white/[0.07] bg-gradient-to-br from-white/[0.04] to-white/[0.01]'

/** Campo de formulario sobre fondo oscuro. */
export const INPUT =
  'w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white ' +
  'placeholder:text-white/25 focus:border-white/25 focus:outline-none transition-colors ' +
  '[&>option]:bg-neutral-900 [&>option]:text-white'

/** Rótulo de campo. */
export const LABEL = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55'

/** Texto de ayuda debajo del campo. */
export const AYUDA = 'mt-1.5 text-xs leading-relaxed text-white/45'

/** Advertencia: ámbar legible sobre oscuro, no el ámbar 700 de fondo blanco. */
export const AVISO = 'text-xs leading-relaxed text-amber-300/90'

/** Botón secundario. */
export const BTN =
  'rounded-xl border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/80 ' +
  'hover:border-white/25 hover:text-white transition-all disabled:opacity-30'

// ── Categorías ───────────────────────────────────────────────────────────────
// Cada widget declara su categoría en lib/widgets/tipos.ts. Acá se le pone nombre, color y
// —lo importante— para qué sirve la categoría: elegir widget es elegir qué palanca tocar,
// no qué dibujito queda lindo.
export const CATEGORIAS = {
  conversion: {
    label: 'Conversión',
    color: '#f0a03c',
    para: 'Empujan la decisión: acercan el pago, la consulta o el clic al momento en que la persona ya está decidiendo.',
  },
  confianza: {
    label: 'Confianza',
    color: '#6f9e5f',
    para: 'Bajan la desconfianza, que es el freno número uno: prueba de otros, garantía, respuestas antes de la duda.',
  },
  captura: {
    label: 'Captura',
    color: '#9b8cf0',
    para: 'Se quedan con el contacto para seguir la conversación después. Quien no compra hoy sigue siendo alcanzable.',
  },
  contenido: {
    label: 'Contenido',
    color: '#5fa8d3',
    para: 'Explican sin vender: datos, video, ficha técnica. Sirven cuando la duda es qué es esto, no cuánto cuesta.',
  },
} as const

export type CategoriaKey = keyof typeof CATEGORIAS

export const catDe = (k: string) => CATEGORIAS[k as CategoriaKey] ?? CATEGORIAS.contenido
