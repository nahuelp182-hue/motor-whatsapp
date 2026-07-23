'use client'

import { useEffect, useRef, useState } from 'react'
import { CARD } from './ui'

// Vista previa en vivo. El iframe corre el mic.js real, así que lo que se ve acá es
// literalmente lo que va a ver un visitante: mismo código de dibujo, mismas medidas.

type Props = {
  tipo: string
  config: Record<string, unknown>
}

export function VistaPrevia({ tipo, config }: Props) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [listo, setListo] = useState(false)
  const [ancho, setAncho] = useState<'movil' | 'escritorio'>('escritorio')

  // El iframe avisa cuando mic.js terminó de cargar. Sin esta señal, el primer envío se
  // pierde y el preview queda en blanco hasta que se toca algún campo.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.mic === 'listo') setListo(true)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  useEffect(() => {
    if (!listo) return
    // Pequeña demora: mientras se escribe un título no hace falta redibujar en cada tecla.
    const t = setTimeout(() => {
      ref.current?.contentWindow?.postMessage(
        { mic: 'preview', widget: { id: 'preview', tipo, config, reglas: {} } },
        '*',
      )
    }, 180)
    return () => clearTimeout(t)
  }, [listo, tipo, config])

  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex items-center gap-2 border-b border-white/[0.07] px-3.5 py-2.5">
        <span
          className={`h-1.5 w-1.5 rounded-full transition-colors ${
            listo ? 'bg-emerald-400' : 'bg-white/25'
          }`}
          title={listo ? 'Dibujando con el motor real' : 'Cargando el motor…'}
        />
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/55">
          Vista previa en vivo
        </span>
        <div className="ml-auto flex gap-1 rounded-lg bg-white/[0.04] p-0.5">
          {(['escritorio', 'movil'] as const).map(a => (
            <button
              key={a}
              type="button"
              onClick={() => setAncho(a)}
              className="rounded-md px-2.5 py-1 text-[11px] font-medium transition-all"
              style={
                ancho === a
                  ? { background: 'rgb(var(--ac) / 0.18)', color: 'rgb(var(--ac))' }
                  : { color: 'rgba(255,255,255,0.45)' }
              }
            >
              {a === 'movil' ? '📱 Celular' : '🖥 Escritorio'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-center bg-black/25 p-3">
        <iframe
          ref={ref}
          src="/dashboard/widgets/vista-previa"
          title="Vista previa del widget"
          className="h-[560px] rounded-xl border border-white/10 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
          style={{ width: ancho === 'movil' ? 390 : '100%' }}
        />
      </div>

      <p className="border-t border-white/[0.07] px-3.5 py-2.5 text-[11px] leading-relaxed text-white/45">
        Es el mismo código que corre en el sitio, sobre un texto de ejemplo. Los widgets que
        aparecen tras unos segundos o al intentar salir se dibujan acá enseguida.
      </p>
    </div>
  )
}
