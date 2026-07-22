'use client'

import { useState } from 'react'

/**
 * Captura de email a cambio de la guía en PDF. Reusa /api/lead (valida formato + MX real,
 * manda el PDF y suscribe en Tiendanube), así el lead entra al mismo circuito que ya existe
 * y de ahí sube a la audiencia de Meta. No es un formulario nuevo: es el mismo, en el lugar
 * donde la persona ya demostró interés leyendo.
 */
export default function CapturaEmail() {
  const [email, setEmail] = useState('')
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok' | 'error'>('idle')
  const [error, setError] = useState('')

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (estado === 'enviando') return
    setEstado('enviando')
    setError('')
    try {
      const r = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok && d.ok) {
        setEstado('ok')
        return
      }
      setEstado('error')
      setError(
        d.error === 'dominio'
          ? 'Ese dominio de correo no parece existir. ¿Lo revisás?'
          : d.error === 'formato'
            ? 'Revisá que el correo esté bien escrito.'
            : 'No pudimos enviarte la guía ahora. Probá de nuevo en un rato.',
      )
    } catch {
      setEstado('error')
      setError('Se cortó la conexión. Probá de nuevo.')
    }
  }

  if (estado === 'ok') {
    return (
      <div className="mic-captura">
        <h3>Listo, revisá tu correo</h3>
        <p>
          Te mandamos la guía para lograr tu primer cultivo. Si no la ves, mirá en spam o
          promociones.
        </p>
      </div>
    )
  }

  return (
    <div className="mic-captura">
      <h3>Llevate la guía del primer cultivo</h3>
      <p>
        Las 4 etapas del cultivo, las 3 razones por las que la mayoría fracasa y las variedades
        más fáciles para arrancar. Te la mandamos por correo, gratis.
      </p>
      <form className="mic-captura-form" onSubmit={enviar}>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          maxLength={160}
          required
          aria-label="Tu correo"
        />
        <button className="mic-boton" type="submit" disabled={estado === 'enviando'}>
          {estado === 'enviando' ? 'Enviando…' : 'Quiero la guía'}
        </button>
      </form>
      {estado === 'error' && <p className="mic-acceso-error">{error}</p>}
      <p className="mic-captura-nota">Un correo con la guía. Nada de spam.</p>
    </div>
  )
}
