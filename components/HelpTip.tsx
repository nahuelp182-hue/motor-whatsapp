'use client'

export function HelpTip({ text }: { text: string }) {
  return (
    <span className="relative group/tip inline-flex items-center ml-1 flex-shrink-0">
      <span className="w-3 h-3 rounded-full border border-white/20 text-white/30 text-[8px] font-bold flex items-center justify-center cursor-help hover:border-white/50 hover:text-white/60 transition-colors leading-none select-none">
        ?
      </span>
      {/* Tooltip */}
      <span className="
        pointer-events-none absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2
        w-48 px-3 py-2 rounded-xl text-[10px] text-white/80 leading-relaxed
        bg-[#0d0d1f]/95 border border-white/10 shadow-2xl backdrop-blur-md
        opacity-0 scale-95 group-hover/tip:opacity-100 group-hover/tip:scale-100
        transition-all duration-150 origin-bottom
        whitespace-normal text-center
      ">
        {text}
        {/* Arrow */}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white/10" />
      </span>
    </span>
  )
}
