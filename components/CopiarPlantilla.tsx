'use client'

import { useState } from 'react'

export function CopiarPlantilla({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1800)
    } catch {
      /* clipboard no disponible */
    }
  }

  return (
    <button
      onClick={copiar}
      className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300 transition hover:bg-emerald-400/20"
    >
      {copiado ? '✓ copiado' : '📋 copiar plantilla'}
    </button>
  )
}
