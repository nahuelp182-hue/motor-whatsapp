'use client'
import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'

export function HelpTip({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [pos, setPos]         = useState({ x: 0, y: 0 })
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  function show() {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    // If near top of viewport, show below instead of above
    const above = r.top > 90
    setPos({ x: r.left + r.width / 2, y: above ? r.top - 12 : r.bottom + 12 })
    setVisible(true)
  }

  function hide() { setVisible(false) }

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={show}
        onMouseLeave={hide}
        onClick={e => { e.stopPropagation(); visible ? hide() : show() }}
        className="w-3.5 h-3.5 rounded-full border border-white/30 text-white/45 text-[8px] font-bold inline-flex items-center justify-center cursor-pointer hover:border-orange-400/70 hover:text-orange-400 transition-colors leading-none select-none ml-1.5 flex-shrink-0"
      >?</span>

      {mounted && visible && createPortal(
        <div style={{
          position:      'fixed',
          left:           pos.x,
          top:            pos.y,
          transform:      pos.y < 90
            ? 'translate(-50%, 0%)'        // below
            : 'translate(-50%, -100%)',    // above
          zIndex:         2147483647,
          pointerEvents:  'none',
          fontFamily:    'Manrope, system-ui, sans-serif',
        }}>
          <div style={{
            width:        220,
            padding:      '10px 14px',
            borderRadius: 12,
            fontSize:     11,
            lineHeight:   1.6,
            color:        'rgba(255,255,255,0.92)',
            background:   '#12122a',
            border:       '1px solid rgba(255,255,255,0.22)',
            boxShadow:    '0 12px 48px rgba(0,0,0,0.98), 0 0 0 1px rgba(255,255,255,0.06)',
            textAlign:    'center',
            position:     'relative',
          }}>
            {text}
            {/* Arrow — apunta hacia el ícono */}
            <div style={{
              position:    'absolute',
              [pos.y < 90 ? 'bottom' : 'top']: '100%',
              left:        '50%',
              transform:   'translateX(-50%)',
              borderLeft:  '7px solid transparent',
              borderRight: '7px solid transparent',
              ...(pos.y < 90
                ? { borderBottom: '7px solid #12122a' }
                : { borderTop:    '7px solid #12122a' }),
            }}/>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
