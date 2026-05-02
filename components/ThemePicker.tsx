'use client'
import { useState } from 'react'

export const THEMES = [
  { id: 'micelium', name: 'Micelium', ac: '249 115 22',  acHex: '#f97316', bg: '#07070f' },
  { id: 'notion',   name: 'Notion',   ac: '129 140 248', acHex: '#818cf8', bg: '#0b0b18' },
  { id: 'powerbi',  name: 'PowerBI',  ac: '250 204 21',  acHex: '#facc15', bg: '#0d0b04' },
  { id: 'jade',     name: 'Jade',     ac: '52 211 153',  acHex: '#34d399', bg: '#04100a' },
  { id: 'cyan',     name: 'Cyan',     ac: '6 182 212',   acHex: '#06b6d4', bg: '#040d10' },
  { id: 'rose',     name: 'Rosa',     ac: '244 63 94',   acHex: '#f43f5e', bg: '#100406' },
  { id: 'slate',    name: 'Pizarra',  ac: '148 163 184', acHex: '#94a3b8', bg: '#0e0f11' },
  { id: 'amber',    name: 'Ámbar',    ac: '251 191 36',  acHex: '#fbbf24', bg: '#0d0901' },
  { id: 'violet',   name: 'Violeta',  ac: '167 139 250', acHex: '#a78bfa', bg: '#0a0812' },
  { id: 'sky',      name: 'Cielo',    ac: '56 189 248',  acHex: '#38bdf8', bg: '#04090f' },
]

export type Theme = (typeof THEMES)[0]

export function ThemePicker({ current, onChange }: {
  current: string
  onChange: (t: Theme) => void
}) {
  const [open, setOpen] = useState(false)
  const active = THEMES.find(t => t.id === current) ?? THEMES[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        title="Cambiar tema de colores"
        className="flex items-center gap-1.5 rounded-xl border border-white/10 hover:border-white/20 px-2.5 py-1.5 text-[10px] text-white/50 hover:text-white/70 transition-all"
      >
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: active.acHex }} />
        <span>Tema</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-[calc(100%+6px)] z-50 rounded-2xl border border-white/[0.12] p-4 shadow-2xl w-[196px]"
            style={{ background: '#0c0c1e' }}
          >
            <p className="text-[9px] uppercase tracking-[0.18em] text-white/30 mb-3">Colores del panel</p>
            <div className="grid grid-cols-5 gap-2.5">
              {THEMES.map(t => (
                <button
                  key={t.id}
                  title={t.name}
                  onClick={() => { onChange(t); setOpen(false) }}
                  className="flex flex-col items-center gap-1 group"
                >
                  <span
                    className="w-7 h-7 rounded-full block transition-all duration-150"
                    style={{
                      background:    t.acHex,
                      outline:       current === t.id ? '2px solid white' : 'none',
                      outlineOffset: 2,
                      transform:     current === t.id ? 'scale(1.15)' : undefined,
                      opacity:       current === t.id ? 1 : 0.65,
                    }}
                  />
                  <span className="text-[8px] text-white/30 group-hover:text-white/60 leading-none">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
