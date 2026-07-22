'use client'

import { useState } from 'react'

export default function FormContacto() {
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (cargando) return
    setError('')
    setCargando(true)
    const datos = Object.fromEntries(new FormData(e.currentTarget) as unknown as Iterable<[string, string]>)
    try {
      const r = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      })
      if (r.ok) {
        setEnviado(true)
        return
      }
      const d = await r.json().catch(() => ({}))
      setError(d.error ?? 'No pudimos enviar tu consulta. Probá de nuevo en un momento.')
    } catch {
      setError('Se cortó la conexión. Probá de nuevo o escribinos por WhatsApp.')
    } finally {
      setCargando(false)
    }
  }

  if (enviado) {
    return (
      <div className="mic-cierre" style={{ marginTop: '2.5rem' }}>
        <h3>Recibimos tu consulta</h3>
        <p>
          Te respondemos al correo que nos dejaste, normalmente dentro del día. Si es urgente,
          escribinos por WhatsApp y lo vemos al toque.
        </p>
        <a className="mic-boton" href="https://wa.me/543512145521">
          Escribir por WhatsApp
        </a>
      </div>
    )
  }

  return (
    <form className="mic-acceso" onSubmit={enviar} style={{ maxWidth: '34rem' }}>
      <label className="mic-campo">
        <span>Tu nombre</span>
        <input name="nombre" maxLength={80} required autoComplete="name" />
      </label>

      <label className="mic-campo">
        <span>Tu email</span>
        <input name="email" type="email" maxLength={160} required autoComplete="email" />
        <small>Ahí te respondemos.</small>
      </label>

      <label className="mic-campo">
        <span>Tu consulta</span>
        <textarea name="mensaje" rows={6} maxLength={3000} required minLength={10} />
      </label>

      {/* Honeypot: invisible para personas, tentador para bots. */}
      <input
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
      />

      {error && <p className="mic-acceso-error">{error}</p>}

      <button className="mic-boton" type="submit" disabled={cargando}>
        {cargando ? 'Enviando…' : 'Enviar consulta'}
      </button>
    </form>
  )
}
