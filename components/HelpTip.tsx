'use client'
import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

export function HelpTip({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  function open(e: React.MouseEvent | React.TouchEvent) {
    e.stopPropagation()
    if (!ref.current) return
    setRect(prev => prev ? null : ref.current!.getBoundingClientRect())
  }
  function close() { setRect(null) }

  useEffect(() => {
    if (!rect) return
    const close = () => setRect(null)
    setTimeout(() => document.addEventListener('click', close), 0)
    return () => document.removeEventListener('click', close)
  }, [rect])

  // Coordenadas de viewport (position:fixed)
  const tipX = rect ? rect.left + rect.width / 2 : 0
  const tipY = rect ? rect.top - 12 : 0

  return (
    <>
      <span
        ref={ref}
        onClick={open}
        onMouseEnter={open}
        onMouseLeave={close}
        className="w-3.5 h-3.5 rounded-full border border-white/30 text-white/45 text-[8px] font-bold inline-flex items-center justify-center cursor-pointer hover:border-orange-400/70 hover:text-orange-400 transition-colors leading-none select-none ml-1.5 flex-shrink-0"
      >?</span>

      {mounted && rect && createPortal(
        <div style={{
          position:  'fixed',           // fijo al viewport, ignora cualquier transform de padres
          left:      tipX,
          top:       tipY,
          transform: 'translate(-50%, -100%)',
          zIndex:    2147483647,        // máximo posible
          pointerEvents: 'none',
          fontFamily: 'Manrope, system-ui, sans-serif',
        }}>
          <div style={{
            width:          220,
            padding:        '10px 14px',
            borderRadius:   12,
            fontSize:       11,
            lineHeight:     1.6,
            color:          'rgba(255,255,255,0.92)',
            background:     '#080814',
            border:         '1px solid rgba(255,255,255,0.18)',
            boxShadow:      '0 8px 32px rgba(0,0,0,0.9)',
            textAlign:      'center',
          }}>
            {text}
            {/* Flecha */}
            <div style={{
              position:    'absolute',
              top:         '100%',
              left:        '50%',
              transform:   'translateX(-50%)',
              borderLeft:  '7px solid transparent',
              borderRight: '7px solid transparent',
              borderTop:   '7px solid #080814',
            }}/>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
