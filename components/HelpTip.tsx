'use client'

export function HelpTip({ text }: { text: string }) {
  return (
    <span className="relative inline-block ml-1.5 flex-shrink-0 group/tip">

      {/* Ícono ? */}
      <span className="w-3.5 h-3.5 rounded-full border border-white/30 text-white/45 text-[8px] font-bold inline-flex items-center justify-center cursor-pointer group-hover/tip:border-orange-400/70 group-hover/tip:text-orange-400 transition-colors leading-none select-none">
        ?
      </span>

      {/* Tooltip — aparece arriba, centrado sobre el ícono */}
      <span
        className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2
                   opacity-0 invisible pointer-events-none
                   group-hover/tip:opacity-100 group-hover/tip:visible
                   transition-opacity duration-150 z-[9999] w-[220px]"
        style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}
      >
        <span
          className="block relative text-center"
          style={{
            padding:      '10px 14px',
            borderRadius: 12,
            fontSize:     11,
            lineHeight:   1.6,
            color:        'rgba(255,255,255,0.93)',
            background:   'rgb(14,14,40)',
            border:       '1px solid rgba(255,255,255,0.28)',
            boxShadow:    '0 16px 56px rgba(0,0,0,0.98), 0 0 0 1px rgba(255,255,255,0.08)',
          }}
        >
          {text}
          {/* Flecha apuntando abajo hacia el ícono */}
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 block"
            style={{
              borderLeft:  '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop:   '6px solid rgb(14,14,40)',
            }}
          />
        </span>
      </span>
    </span>
  )
}
