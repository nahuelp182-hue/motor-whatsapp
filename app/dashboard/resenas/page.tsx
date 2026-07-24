'use client'

import { useCallback, useEffect, useState } from 'react'
import { CARD, BTN, ACENTO, TITULO } from '@/components/widgets/ui'

// Moderación de reseñas. Las del formulario público nacen pendientes y no se muestran en el
// sitio hasta que se aprueban acá. Las de WhatsApp/Google entran ya aprobadas (son verificadas),
// pero también se pueden ocultar desde acá si hiciera falta.

type Resena = {
  id: string
  autor: string
  texto: string
  rating: number | null
  source: 'whatsapp' | 'google' | 'form'
  approved: boolean
  producto: string | null
  foto: string | null
  fecha: string
}

const FUENTE: Record<string, { label: string; color: string }> = {
  whatsapp: { label: 'WhatsApp', color: '#25693f' },
  google: { label: 'Google', color: '#3f6fb0' },
  form: { label: 'Formulario', color: '#8a6a2f' },
}

/** Estrellas editables: clic fija el puntaje. Sirve sobre todo para las de WhatsApp, que
    llegan sin estrellas y conviene puntuar a mano según lo que dice el texto. */
function Estrellas({ n, onSet }: { n: number | null; onSet: (v: number) => void }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="tracking-[1px] text-[17px]">
        {[1, 2, 3, 4, 5].map(i => (
          <button
            key={i}
            type="button"
            onClick={() => onSet(i)}
            title={`${i} estrella${i > 1 ? 's' : ''}`}
            style={{ color: n && i <= n ? '#e8a838' : '#d9d4cb', lineHeight: 1 }}
            className="cursor-pointer hover:scale-110 transition-transform"
          >
            ★
          </button>
        ))}
      </span>
      {!n && <span className="text-[#a3a3a0] text-[11px]">sin puntaje — clic para asignar</span>}
    </span>
  )
}

export default function ResenasPage() {
  const [resenas, setResenas] = useState<Resena[]>([])
  const [pendientes, setPendientes] = useState(0)
  const [filtro, setFiltro] = useState<'pendientes' | 'aprobadas' | 'todas'>('pendientes')
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    const r = await fetch(`/api/resenas?estado=${filtro}`)
    const d = await r.json()
    setResenas(d.resenas ?? [])
    setPendientes(d.pendientes ?? 0)
    setCargando(false)
  }, [filtro])

  useEffect(() => { cargar() }, [cargar])

  async function aprobar(id: string, approved: boolean) {
    await fetch('/api/resenas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, approved }),
    })
    cargar()
  }

  async function fijarRating(id: string, rating: number) {
    // Optimista: se ve el cambio al toque y se persiste en segundo plano.
    setResenas(rs => rs.map(r => (r.id === id ? { ...r, rating } : r)))
    await fetch('/api/resenas', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, rating }),
    })
  }

  async function descartar(id: string) {
    if (!confirm('¿Descartar esta reseña? No se puede deshacer.')) return
    await fetch(`/api/resenas?id=${id}`, { method: 'DELETE' })
    cargar()
  }

  const TABS: { key: typeof filtro; label: string }[] = [
    { key: 'pendientes', label: `Pendientes${pendientes ? ` (${pendientes})` : ''}` },
    { key: 'aprobadas', label: 'Publicadas' },
    { key: 'todas', label: 'Todas' },
  ]

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-3xl text-[#171717]" style={{ fontFamily: TITULO }}>Reseñas</h1>
      <p className="mt-1 text-[13px] leading-relaxed text-[#6b6b68]">
        Las reseñas del formulario del sitio quedan acá pendientes hasta que las aprobás.
        Las de WhatsApp y Google entran ya publicadas.
      </p>

      <div className="mt-6 flex gap-2">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setFiltro(t.key)}
            className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
              filtro === t.key ? 'text-white' : 'text-[#3f3f3c] hover:text-[#171717]'
            }`}
            style={filtro === t.key ? { background: ACENTO } : { background: '#f0efe9' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {cargando && <p className="text-sm text-[#a3a3a0]">Cargando…</p>}
        {!cargando && resenas.length === 0 && (
          <div className={`${CARD} p-8 text-center text-sm text-[#a3a3a0]`}>
            No hay reseñas {filtro === 'pendientes' ? 'pendientes' : 'para mostrar'}.
          </div>
        )}
        {resenas.map(r => {
          const f = FUENTE[r.source] ?? FUENTE.form
          return (
            <div key={r.id} className={`${CARD} p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#171717]">{r.autor}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                      style={{ background: f.color }}
                    >
                      {f.label}
                    </span>
                    {!r.approved && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                        Pendiente
                      </span>
                    )}
                  </div>
                  <div className="mt-1"><Estrellas n={r.rating} onSet={v => fijarRating(r.id, v)} /></div>
                  {r.producto && (
                    <div className="mt-1 text-[11px] text-[#8a8a86]">📦 {r.producto}</div>
                  )}
                </div>
                <span className="shrink-0 text-[11px] text-[#a3a3a0]">{r.fecha}</span>
              </div>
              {r.foto && (
                // eslint-disable-next-line @next/next/no-img-element
                <a href={r.foto} target="_blank" rel="noopener noreferrer">
                  <img src={r.foto} alt="" className="mt-2 max-h-40 rounded-lg border border-[#e7e7e2]" />
                </a>
              )}
              <p className="mt-2 text-sm leading-relaxed text-[#3f3f3c]">{r.texto}</p>
              <div className="mt-3 flex gap-2">
                {r.approved ? (
                  <button className={BTN} onClick={() => aprobar(r.id, false)}>Ocultar</button>
                ) : (
                  <button
                    className="rounded-md px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
                    style={{ background: ACENTO }}
                    onClick={() => aprobar(r.id, true)}
                  >
                    Aprobar y publicar
                  </button>
                )}
                <button
                  className={`${BTN} hover:!border-red-300 hover:!text-red-600`}
                  onClick={() => descartar(r.id)}
                >
                  Descartar
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
