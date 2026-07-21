'use client'

import { useState } from 'react'

export default function FormAcceso() {
  const [orden, setOrden] = useState('')
  const [factor, setFactor] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (cargando) return
    setError('')
    setCargando(true)
    try {
      const r = await fetch('/api/acceso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orden, factor }),
      })
      if (r.ok) {
        // Recarga dura para que el server component lea la cookie recién puesta.
        window.location.href = '/mi-equipo'
        return
      }
      const d = await r.json().catch(() => ({}))
      setError(d.error ?? 'No pudimos verificar esos datos.')
    } catch {
      setError('Se cortó la conexión. Probá de nuevo en un momento.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <form className="mic-acceso" onSubmit={enviar}>
      <label className="mic-campo">
        <span>Número de pedido</span>
        <input
          value={orden}
          onChange={e => setOrden(e.target.value)}
          inputMode="numeric"
          placeholder="Ej: 1234"
          maxLength={20}
          required
          autoFocus
        />
      </label>

      <label className="mic-campo">
        <span>Últimos 4 dígitos de tu teléfono</span>
        <input
          value={factor}
          onChange={e => setFactor(e.target.value)}
          inputMode="numeric"
          placeholder="Ej: 4821"
          maxLength={20}
          required
        />
        <small>También sirve tu DNI.</small>
      </label>

      {error && <p className="mic-acceso-error">{error}</p>}

      <button className="mic-boton" type="submit" disabled={cargando}>
        {cargando ? 'Verificando…' : 'Entrar'}
      </button>

      <p className="mic-chat-nota">
        ¿No encontrás tu número de pedido? Está en el mail de confirmación de la compra. Si no
        lo tenés a mano, escribinos por WhatsApp y te damos una mano.
      </p>
    </form>
  )
}
