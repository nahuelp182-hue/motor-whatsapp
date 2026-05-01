'use client'
import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

export function HelpTip({ text }: { text: string }) {
  const ref     = useRef<HTMLSpanElement>(null)
  const [pos, setPos]       = useState<{ x: number; y: number } | null>(null)
  const [mounted, setMounted] = useState(false)

  // Solo montar en cliente
  useEffect(() => { setMounted(true) }, [])

  function show() {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    setPos({ x: r.left + r.width / 2, y: r.top + window.scrollY })
  }

  function hide() { setPos(null) }

  function toggle(e: React.MouseEvent | React.TouchEvent) {
    e.stopPropagation()
    pos ? hide() : show()
  }

  // Cerrar al hacer click en cualquier parte
  useEffect(() => {
    if (!pos) return
    const close = () => setPos(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [pos])

  return (
    <>
      <span
        ref={ref}
        onClick={toggle}
        onMouseEnter={show}
        onMouseLeave={hide}
        className="w-3.5 h-3.5 rounded-full border border-white/25 text-white/40 text-[8px] font-bold inline-flex items-center justify-center cursor-pointer hover:border-orange-400/60 hover:text-orange-400 transition-colors leading-none select-none ml-1.5 flex-shrink-0"
        aria-label="Ayuda"
      >
        ?
      </span>

      {/* Portal → renderiza directo en document.body, sobre todo */}
      {mounted && pos && createPortal(
        <div
          style={{
            position: 'absolute',
            left:      pos.x,
            top:       pos.y - 10,
            transform: 'translate(-50%, -100%)',
            zIndex:    999999,
            pointerEvents: 'none',
          }}
        >
          {/* Tooltip box */}
          <div style={{
            width:        210,
            padding:      '10px 14px',
            borderRadius: 12,
            fontSize:     11,
            lineHeight:   1.55,
            color:        'rgba(255,255,255,0.88)',
            background:   'rgba(8,8,20,0.97)',
            border:       '1px solid rgba(255,255,255,0.14)',
            boxShadow:    '0 24px 64px rgba(0,0,0,0.85), 0 0 0 0.5px rgba(255,255,255,0.06)',
            textAlign:    'center',
            backdropFilter: 'blur(12px)',
            fontFamily:   'Manrope, system-ui, sans-serif',
          }}>
            {text}

            {/* Flecha abajo */}
            <div style={{
              position:     'absolute',
              top:          '100%',
              left:         '50%',
              transform:    'translateX(-50%)',
              width:         0,
              height:        0,
              borderLeft:   '6px solid transparent',
              borderRight:  '6px solid transparent',
              borderTop:    '6px solid rgba(8,8,20,0.97)',
            }} />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
