'use client'
import { useRef, useState } from 'react'

export function HelpTip({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  function show() {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    setPos({
      x: r.left + r.width / 2,
      y: r.top,
    })
  }

  function hide() { setPos(null) }

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={show}
        onMouseLeave={hide}
        onTouchStart={show}
        onTouchEnd={hide}
        className="w-3.5 h-3.5 rounded-full border border-white/25 text-white/35 text-[8px] font-bold inline-flex items-center justify-center cursor-help hover:border-white/60 hover:text-white/70 transition-colors leading-none select-none ml-1 flex-shrink-0"
      >
        ?
      </span>

      {/* Portal fijo — nunca se corta por overflow de ningún padre */}
      {pos && (
        <span
          className="fixed z-[9999] pointer-events-none"
          style={{ left: pos.x, top: pos.y - 8, transform: 'translate(-50%, -100%)' }}
        >
          <span className="block w-52 px-3 py-2.5 rounded-xl text-[11px] text-white/85 leading-relaxed bg-[#0d0d1f]/98 border border-white/15 shadow-2xl backdrop-blur-md text-center">
            {text}
            <span className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-white/15 block" />
          </span>
        </span>
      )}
    </>
  )
}
