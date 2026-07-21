'use client'

export default function SalirBoton() {
  async function salir() {
    await fetch('/api/acceso', { method: 'DELETE' }).catch(() => {})
    window.location.href = '/guia'
  }
  return (
    <button type="button" className="mic-salir" onClick={salir}>
      Salir
    </button>
  )
}
