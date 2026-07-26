import { PALETA, UBICACIONES, type Campo } from '@/lib/widgets/tipos'

// Resumen de una sección plegada del editor: "Redondeado · Sage · 2 px".
//
// Es lo que hace que plegar no sea esconder. Genérico a propósito —lee la declaración del
// campo, no el widget— así un tipo nuevo tiene resumen sin escribir una línea.

const corto = (s: string, n = 34) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)

/** Un campo, resumido en pocas palabras. Devuelve null si no aporta nada leerlo. */
function unCampo(campo: Campo, config: Record<string, unknown> | undefined): string | null {
  const v = config?.[campo.key]

  switch (campo.tipo) {
    case 'booleano':
      // Solo lo prendido: enumerar lo apagado llena el renglón de ruido.
      return v === true ? corto(campo.label.replace(/\s*\(.*?\)\s*/g, '')) : null

    case 'select':
      return campo.opciones?.find(o => o.value === String(v ?? ''))?.label ?? null

    case 'ubicacion':
      return UBICACIONES.find(u => u.value === String(v ?? ''))?.label ?? null

    case 'color': {
      const s = String(v ?? '')
      return PALETA.find(p => p.value === s)?.label.replace(/\s*\(.*?\)/, '') ?? (s.startsWith('#') ? s : null)
    }

    case 'lista': {
      const n = Array.isArray(v) ? v.length : 0
      return n === 0 ? null : `${n} ${n === 1 ? 'ítem' : 'ítems'}`
    }

    case 'media':
      return v ? 'Archivo cargado' : null

    case 'numero': {
      // El rótulo suele traer la unidad entre paréntesis ("Grosor del trazo (px)"): se la
      // rescata, que es justamente lo que le da sentido al número suelto.
      const unidad = /\(([^)]+)\)/.exec(campo.label)?.[1] ?? ''
      return v === undefined || v === null || v === '' ? null : `${v}${unidad ? ' ' + unidad : ''}`
    }

    case 'producto':
    case 'enlace':
    case 'url':
      return null

    case 'emoji':
      return v ? String(v) : null

    default: {
      const s = String(v ?? '').trim()
      return s ? corto(s) : null
    }
  }
}

/** Estado de un grupo de campos en una línea. Vacío si no hay nada cargado todavía. */
export function resumenDeGrupo(campos: Campo[], config: Record<string, unknown> | undefined): string {
  const partes: string[] = []
  for (const c of campos) {
    const s = unCampo(c, config)
    if (s) partes.push(s)
    if (partes.length === 3) break
  }
  return corto(partes.join(' · '), 72)
}
