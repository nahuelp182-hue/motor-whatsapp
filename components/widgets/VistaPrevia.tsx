'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { CARD } from './ui'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Vista previa en vivo. El iframe corre el mic.js real, así que lo que se ve acá es
// literalmente lo que va a ver un visitante: mismo código de dibujo, mismas medidas.
//
// Para que eso valga para TODOS los widgets y no solo para los de texto, el iframe carga un
// escenario: la ficha de producto de Tiendanube (con precio real, botón de compra y carrito
// simulado) o una guía. Media docena de widgets —cuotas, desglose de pack, barra de compra,
// progreso de envío, upsells— leen esos datos de la página y sin ellos no dibujan nada.
// Además viajan los datos que en el sitio pone el servidor: el catálogo de productos y las
// reseñas publicadas. Sin eso, el preview de esos widgets quedaba en blanco.

export type Producto = { id: string; nombre: string; precio: number; imagen: string | null }
export type Resenas = {
  items: Array<Record<string, unknown>>
  promedio: number | null
  total: number
}

type Props = {
  tipo: string
  config: Record<string, unknown>
  /** Contexto del widget: decide con qué escenario arranca la vista previa. */
  contexto?: string
  /** Catálogo real de Tiendanube. Es lo que el servidor manda como `catalogo` en el sitio. */
  productos?: Producto[]
  /** Reseñas publicadas, para el widget de reseñas. */
  resenas?: Resenas
}

// Reseñas de muestra: SOLO se usan cuando todavía no hay ninguna publicada, para que el
// bloque se pueda diseñar antes de tener la primera. En cuanto existe una real, se muestran
// las reales. El pie del panel aclara cuál de las dos cosas se está viendo.
const RESENAS_MUESTRA = [
  {
    nombre: 'Carla M.',
    texto: 'Llegó embalada impecable y en tres días. La usé con gírgolas y salió el primer intento.',
    fecha: 'hace 2 semanas',
    rating: 5,
    fuente: 'whatsapp',
    verificada: true,
    foto: null,
  },
  {
    nombre: 'Diego R.',
    texto: 'Lo que más valoro es que me contestaron cada consulta. El equipo cumple lo que promete.',
    fecha: 'hace 1 mes',
    rating: 5,
    fuente: 'google',
    verificada: true,
    foto: null,
  },
]

export function VistaPrevia({ tipo, config, contexto, productos = [], resenas }: Props) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [listo, setListo] = useState(false)
  const [ancho, setAncho] = useState<'movil' | 'escritorio'>('escritorio')
  // El escenario sale de dónde vive el widget, que acierta casi siempre; queda pisarlo a
  // mano porque un widget de "tienda" también aparece en la ficha de producto. Se deriva en
  // vez de guardarse para que al cambiar de widget vuelva solo al que corresponde.
  const [escenarioElegido, setEscenarioElegido] = useState<'guias' | 'producto' | null>(null)
  const escenario = escenarioElegido ?? (contexto === 'guias' ? 'guias' : 'producto')
  const [producto, setProducto] = useState('')
  const [resultado, setResultado] = useState<{ dibujado: boolean; error: string } | null>(null)

  // Cambiar de escenario, de producto o de ancho recarga el iframe: `esMovil` y el objeto
  // `LS` de Tiendanube se leen UNA vez al arrancar mic.js, igual que en el sitio real. Sin
  // recargar, la regla "solo celular" se vería mal justo en el modo que se quiere revisar.
  // El motor vuelve a avisar «listo» cuando termina de cargar.
  function recargar(cambio: () => void) {
    setListo(false)
    setResultado(null)
    cambio()
  }

  const src = useMemo(() => {
    const p = new URLSearchParams({ e: escenario })
    if (escenario === 'producto' && producto) p.set('p', producto)
    return `/dashboard/widgets/vista-previa?${p.toString()}`
  }, [escenario, producto])

  // El iframe avisa cuando mic.js terminó de cargar. Sin esta señal, el primer envío se
  // pierde y el preview queda en blanco hasta que se toca algún campo.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.mic === 'listo') setListo(true)
      if (e.data?.mic === 'resultado') {
        setResultado({ dibujado: !!e.data.dibujado, error: String(e.data.error ?? '') })
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  // Lo que el servidor agrega en el sitio y acá tiene que agregar el panel: el catálogo
  // resuelto (nombre, precio, imagen por id) y las reseñas publicadas.
  const catalogo = useMemo(() => {
    const m: Record<string, Producto> = {}
    for (const p of productos) m[p.id] = p
    return m
  }, [productos])

  const hayResenasReales = (resenas?.items?.length ?? 0) > 0

  useEffect(() => {
    if (!listo) return
    // Pequeña demora: mientras se escribe un título no hace falta redibujar en cada tecla.
    const t = setTimeout(() => {
      const cantidad = Number(config?.cantidad ?? 6) || 6
      const items = hayResenasReales
        ? (resenas?.items ?? []).slice(0, cantidad)
        : RESENAS_MUESTRA.slice(0, cantidad)
      ref.current?.contentWindow?.postMessage(
        {
          mic: 'preview',
          widget: {
            id: 'preview',
            tipo,
            config,
            reglas: {},
            catalogo,
            datos: items,
            resumen: hayResenasReales
              ? { promedio: resenas?.promedio ?? null, total: resenas?.total ?? 0 }
              : { promedio: 5, total: items.length },
          },
        },
        '*',
      )
    }, 180)
    return () => clearTimeout(t)
  }, [listo, tipo, config, catalogo, resenas, hayResenasReales])

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3.5 py-2.5">
        <span
          className={`h-1.5 w-1.5 rounded-full transition-colors ${
            listo ? 'bg-emerald-500' : 'bg-white/25'
          }`}
          title={listo ? 'Dibujando con el motor real' : 'Cargando el motor…'}
        />
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/50">
          Vista previa en vivo
        </span>
        <div className="ml-auto flex gap-1 rounded-lg bg-muted p-0.5">
          {(['escritorio', 'movil'] as const).map(a => (
            <Button
              key={a}
              type="button"
              size="xs"
              variant={ancho === a ? 'secondary' : 'ghost'}
              onClick={() => recargar(() => setAncho(a))}
              className="text-[11px]"
            >
              {a === 'movil' ? '📱 Celular' : '🖥 Escritorio'}
            </Button>
          ))}
        </div>
      </div>

      {/* Escenario: sobre qué página se dibuja. No es un adorno — es lo que hace que los
          widgets de precio y de carrito tengan de dónde leer. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3.5 py-2.5">
        <div className="flex gap-1 rounded-lg bg-muted p-0.5">
          {([
            ['producto', '🏷️ Ficha de producto'],
            ['guias', '📚 Guía'],
          ] as const).map(([k, label]) => (
            <Button
              key={k}
              type="button"
              size="xs"
              variant={escenario === k ? 'secondary' : 'ghost'}
              onClick={() => recargar(() => setEscenarioElegido(k))}
              className="text-[11px]"
            >
              {label}
            </Button>
          ))}
        </div>

        {escenario === 'producto' && productos.length > 0 && (
          <Select
            value={producto || productos[0].id}
            onValueChange={v => recargar(() => setProducto(String(v)))}
          >
            <SelectTrigger className="h-8 min-w-0 flex-1 text-[12px]">
              <SelectValue placeholder="Producto simulado" />
            </SelectTrigger>
            <SelectContent>
              {productos.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex justify-center bg-black/20 p-3">
        <iframe
          // La clave incluye el ancho: cambiar de celular a escritorio recarga el motor, que
          // es lo que hace que la regla de dispositivo se vea de verdad.
          key={`${src}|${ancho}`}
          ref={ref}
          src={src}
          title="Vista previa del widget"
          className="h-[560px] rounded-xl border border-white/10 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
          style={{ width: ancho === 'movil' ? 390 : '100%' }}
        />
      </div>

      {resultado && !resultado.dibujado && (
        <div className="border-t border-white/10 bg-amber-500/[0.08] px-3.5 py-2.5 text-[12px] leading-relaxed text-amber-100/90">
          ▲ Con esta configuración el widget no dibuja nada — así de invisible quedaría en el
          sitio. Suele faltar un dato (producto, fecha, número) o el escenario no es el suyo:
          mirá los avisos de arriba del formulario.
          {resultado.error && <span className="block text-amber-200/70">Error: {resultado.error}</span>}
        </div>
      )}

      <p className="border-t border-white/10 px-3.5 py-2.5 text-[11px] leading-relaxed text-white/50">
        Es el mismo código que corre en el sitio. En la ficha, el precio, el nombre y la imagen
        son los reales del producto elegido, y el carrito simula una unidad adentro. Los
        widgets que aparecen tras unos segundos o al intentar salir se dibujan acá enseguida, y
        los botones no agregan nada al carrito.
        {!hayResenasReales && ' Las reseñas son de muestra: todavía no hay ninguna publicada.'}
      </p>
    </div>
  )
}
