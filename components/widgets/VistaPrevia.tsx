'use client'

import { useEffect, useRef, useState } from 'react'

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
    <div className="rounded-lg border border-neutral-200">
      <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2">
        <span className="text-xs font-medium text-neutral-600">Vista previa</span>
        <div className="ml-auto flex gap-1">
          {(['escritorio', 'movil'] as const).map(a => (
            <button
              key={a}
              type="button"
              onClick={() => setAncho(a)}
              className={`rounded px-2 py-0.5 text-xs ${
                ancho === a ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600'
              }`}
            >
              {a === 'movil' ? 'Celular' : 'Escritorio'}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-center bg-neutral-100 p-3">
        <iframe
          ref={ref}
          src="/dashboard/widgets/vista-previa"
          title="Vista previa del widget"
          className="h-[460px] rounded border border-neutral-200 bg-white"
          style={{ width: ancho === 'movil' ? 390 : '100%' }}
        />
      </div>
      <p className="border-t border-neutral-200 px-3 py-2 text-xs leading-relaxed text-neutral-500">
        Es el mismo código que corre en el sitio, sobre un texto de ejemplo. Los widgets que
        aparecen tras unos segundos o al intentar salir se dibujan acá enseguida.
      </p>
    </div>
  )
}
