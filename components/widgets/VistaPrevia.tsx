'use client'

import { useEffect, useRef, useState } from 'react'
import { CARD, ACENTO } from './ui'

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
      <div className="flex items-center gap-2 border-b border-[#e7e7e2] px-3.5 py-2.5">
        <span
          className={`h-1.5 w-1.5 rounded-full transition-colors ${
            listo ? 'bg-emerald-500' : 'bg-[#c9c9c4]'
          }`}
          title={listo ? 'Dibujando con el motor real' : 'Cargando el motor…'}
        />
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#737373]">
          Vista previa en vivo
        </span>
        <div className="ml-auto flex gap-1 rounded-lg bg-[#f4f4f1] p-0.5">
          {(['escritorio', 'movil'] as const).map(a => (
            <button
              key={a}
              type="button"
              onClick={() => setAncho(a)}
              className="rounded-md px-2.5 py-1 text-[11px] font-medium transition-all"
              style={
                ancho === a
                  ? { background: '#eef1e9', color: ACENTO }
                  : { color: '#737373' }
              }
            >
              {a === 'movil' ? '📱 Celular' : '🖥 Escritorio'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-center bg-[#f0f0ec] p-3">
        <iframe
          ref={ref}
          src="/dashboard/widgets/vista-previa"
          title="Vista previa del widget"
          className="h-[560px] rounded-xl border border-[#e7e7e2] bg-white shadow-[0_8px_30px_rgba(23,23,23,0.10)]"
          style={{ width: ancho === 'movil' ? 390 : '100%' }}
        />
      </div>

      <p className="border-t border-[#e7e7e2] px-3.5 py-2.5 text-[11px] leading-relaxed text-[#737373]">
        Es el mismo código que corre en el sitio, sobre un texto de ejemplo. Los widgets que
        aparecen tras unos segundos o al intentar salir se dibujan acá enseguida.
      </p>
    </div>
  )
}
