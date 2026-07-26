'use client'

import type { Previsual } from '@/lib/widgets/tipos'

// Dibujo chico de UNA opción de select. Nada de esto es decoración: elegir "esquinas
// redondeadas", "16:9" o "entra desde el costado" es una decisión visual, y leerla escrita
// obliga a imaginarse el resultado. Con veinte widgets para configurar, esa traducción
// mental es la que hace lento el trabajo.
//
// Cada dibujo se arma con divs y los tokens del panel (currentColor sobre `text-primary`
// cuando está elegido): sin imágenes, sin SVG externo, sin nada que se desincronice con lo
// que el sitio dibuja de verdad. Un valor sin caso acá devuelve null y el campo cae solo en
// la lista de texto: agregar `previsual` a un campo nunca puede romper el formulario.

const CAJA = 'flex h-11 w-full items-center justify-center overflow-hidden rounded-md bg-muted p-1.5'

/** Renglones de texto simulados, la muleta de todos los dibujos de página. */
function Renglones({ n = 3, ancho = '100%' }: { n?: number; ancho?: string }) {
  return (
    <div className="w-full space-y-[3px]" style={{ width: ancho }}>
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className="h-[3px] rounded-sm bg-border"
          style={{ width: i === n - 1 ? '65%' : '100%' }}
        />
      ))}
    </div>
  )
}

export function OpcionVisual({ previsual, value }: { previsual: Previsual; value: string }) {
  const contenido = dibujo(previsual, value)
  return contenido ? <div className={CAJA}>{contenido}</div> : null
}

/** ¿Este valor tiene dibujo? Lo consulta el editor para decidir si usa tarjetas o un select. */
export const tieneDibujo = (previsual: Previsual, value: string) => dibujo(previsual, value) !== null

function dibujo(previsual: Previsual, value: string): React.ReactNode {
  switch (previsual) {
    // ── Recuadro alrededor del widget ────────────────────────────────────────
    case 'recuadro': {
      if (value === 'ninguno') {
        return (
          <div className="w-full px-1">
            <Renglones n={3} />
          </div>
        )
      }
      return (
        <div
          className="flex h-full w-full items-center justify-center border-2 border-current px-1.5 text-primary"
          style={{ borderRadius: value === 'redondo' ? 8 : 0 }}
        >
          <Renglones n={2} />
        </div>
      )
    }

    // ── Tipo de línea del recuadro ───────────────────────────────────────────
    case 'linea': {
      const estilo: Record<string, string> = {
        solida: 'solid',
        rayada: 'dashed',
        punteada: 'dotted',
        doble: 'double',
      }
      const css = estilo[value]
      if (!css) return null
      return (
        <div
          className="w-full border-current text-primary"
          style={{ borderTopStyle: css as React.CSSProperties['borderTopStyle'], borderTopWidth: css === 'double' ? 4 : 3 }}
        />
      )
    }

    // ── Animación de entrada ─────────────────────────────────────────────────
    // El gesto se sugiere con la posición de la caja y una flecha: no se anima en bucle
    // porque cinco tarjetas moviéndose a la vez es exactamente el mareo que se vino a evitar.
    case 'animacion': {
      const caja = (extra: React.CSSProperties, flecha: string) => (
        <div className="relative flex h-full w-full items-center justify-center">
          <div
            className="rounded-[3px] border border-current bg-primary/15 text-primary"
            style={{ width: 30, height: 16, ...extra }}
          />
          <span className="absolute right-1 bottom-0.5 text-[10px] leading-none text-primary">{flecha}</span>
        </div>
      )
      if (value === 'subir') return caja({ transform: 'translateY(4px)' }, '↑')
      if (value === 'escala') return caja({ transform: 'scale(0.72)' }, '⤢')
      if (value === 'lado') return caja({ transform: 'translateX(8px)' }, '→')
      if (value === 'ninguna') return caja({ opacity: 0.55 }, '·')
      return null
    }

    // ── Posición del flotante en la pantalla ─────────────────────────────────
    case 'posicion': {
      if (value !== 'derecha' && value !== 'izquierda') return null
      return (
        <div className="relative h-full w-[26px] rounded-[4px] border border-border bg-card">
          <div
            className="absolute bottom-1 h-2.5 w-2.5 rounded-full bg-primary"
            style={value === 'derecha' ? { right: 3 } : { left: 3 }}
          />
        </div>
      )
    }

    // ── Proporción de la imagen ──────────────────────────────────────────────
    // Se dibuja la proporción real, que es la única forma de ver de una que 4:5 es alto y
    // 16:9 es una franja.
    case 'proporcion': {
      const ratio: Record<string, number> = { '16:9': 16 / 9, '4:3': 4 / 3, '1:1': 1, '4:5': 4 / 5 }
      if (value === 'original') {
        return (
          <div className="flex h-full items-center gap-1 text-primary">
            <div className="h-6 w-4 rounded-[2px] border border-dashed border-current" />
            <div className="h-4 w-7 rounded-[2px] border border-dashed border-current" />
          </div>
        )
      }
      const r = ratio[value]
      if (!r) return null
      const alto = r >= 1 ? 26 : 32
      return (
        <div
          className="rounded-[3px] border border-current bg-primary/15 text-primary"
          style={{ height: alto, width: alto * r }}
        />
      )
    }

    // ── Marco de la imagen ───────────────────────────────────────────────────
    case 'marco': {
      const radio: Record<string, number> = { ninguno: 0, suave: 4, redondo: 10, circulo: 999 }
      const r = radio[value]
      if (r === undefined) return null
      return (
        <div
          className="border-2 border-current bg-primary/15 text-primary"
          style={{ width: 30, height: 30, borderRadius: r }}
        />
      )
    }

    // ── Ancho dentro del texto ───────────────────────────────────────────────
    case 'ancho': {
      const w: Record<string, string> = { completo: '100%', medio: '52%', chico: '32%' }
      if (!w[value]) return null
      return (
        <div className="flex w-full flex-col items-center gap-[3px] px-1">
          <div className="h-[3px] w-full rounded-sm bg-border" />
          <div className="h-4 rounded-[3px] bg-primary/45" style={{ width: w[value] }} />
          <div className="h-[3px] w-full rounded-sm bg-border" />
        </div>
      )
    }

    // ── Alineación (estrellas) ───────────────────────────────────────────────
    case 'alineacion': {
      const just: Record<string, string> = {
        izquierda: 'flex-start',
        centro: 'center',
        derecha: 'flex-end',
      }
      if (!just[value]) return null
      return (
        <div className="flex w-full flex-col gap-1 px-1.5">
          <div className="flex gap-[2px] text-[9px] leading-none text-primary" style={{ justifyContent: just[value] }}>
            {'★★★★★'}
          </div>
          <Renglones n={2} />
        </div>
      )
    }

    // ── Ventana emergente vs. bloque en la página ────────────────────────────
    case 'modo': {
      if (value === 'popup') {
        return (
          <div className="relative h-full w-[34px] overflow-hidden rounded-[4px] border border-border bg-card px-1 py-1">
            <div className="space-y-[3px] opacity-40">
              <div className="h-[3px] rounded-sm bg-border" />
              <div className="h-[3px] w-3/4 rounded-sm bg-border" />
              <div className="h-[3px] rounded-sm bg-border" />
            </div>
            <div className="absolute inset-0 bg-black/45" />
            <div className="absolute left-1/2 top-1/2 h-4 w-6 -translate-x-1/2 -translate-y-1/2 rounded-[3px] border border-current bg-primary/70 text-primary" />
          </div>
        )
      }
      if (value === 'bloque') {
        return (
          <div className="flex h-full w-[34px] flex-col justify-center gap-[3px] rounded-[4px] border border-border bg-card px-1">
            <div className="h-[3px] rounded-sm bg-border" />
            <div className="h-4 rounded-[3px] bg-primary/45" />
            <div className="h-[3px] rounded-sm bg-border" />
          </div>
        )
      }
      return null
    }

    default:
      return null
  }
}
