'use client'

import { useState } from 'react'

// Dos puertas, con jerarquía deliberada: el email es lo que el cliente tiene siempre a mano;
// el número de pedido lo obliga a buscar un mail viejo. Por eso el email es el camino por
// defecto y el número queda como recuperación, un click más abajo.
//
// La tercera puerta, la que de verdad usa la mayoría, no está en esta pantalla: es el enlace
// pre-autenticado que va en cada mail nuestro (/e/<token>). Esta página es para quien lo
// perdió.
type Modo = 'email' | 'pedido'

export default function FormAcceso({ aviso }: { aviso?: 'vencido' | 'usado' }) {
  const [modo, setModo] = useState<Modo>('email')
  const [email, setEmail] = useState('')
  const [orden, setOrden] = useState('')
  const [factor, setFactor] = useState('')
  const [error, setError] = useState('')
  const [listo, setListo] = useState('')
  const [cargando, setCargando] = useState(false)

  async function porEmail(e: React.FormEvent) {
    e.preventDefault()
    if (cargando) return
    setError('')
    setCargando(true)
    try {
      const r = await fetch('/api/acceso/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) setListo(d.mensaje ?? 'Si esa dirección tiene una compra, te llega el acceso.')
      else setError(d.error ?? 'No pudimos procesar el pedido.')
    } catch {
      setError('Se cortó la conexión. Probá de nuevo en un momento.')
    } finally {
      setCargando(false)
    }
  }

  async function porPedido(e: React.FormEvent) {
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

  if (listo) {
    return (
      <div className="mic-acceso">
        <p className="mic-p">{listo}</p>
        <p className="mic-chat-nota">
          El enlace vence en 7 días y sirve una sola vez. Al abrirlo, este navegador queda
          reconocido por 30 días.
        </p>
      </div>
    )
  }

  return (
    <>
      {aviso && (
        <p className="mic-acceso-error">
          {aviso === 'usado'
            ? 'Ese enlace ya se usó. Pedí uno nuevo con tu email y te llega al instante.'
            : 'Ese enlace venció. Pedí uno nuevo con tu email y te llega al instante.'}
        </p>
      )}

      {modo === 'email' ? (
        <form className="mic-acceso" onSubmit={porEmail}>
          <label className="mic-campo">
            <span>Tu email</span>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="el mismo con el que compraste"
              maxLength={120}
              required
              autoFocus
            />
            <small>Te mandamos un enlace que te deja adentro, sin contraseña.</small>
          </label>

          {error && <p className="mic-acceso-error">{error}</p>}

          <button className="mic-boton" type="submit" disabled={cargando}>
            {cargando ? 'Enviando…' : 'Enviarme el acceso'}
          </button>

          <p className="mic-chat-nota">
            ¿No usás más ese correo?{' '}
            <button type="button" className="mic-link-boton" onClick={() => setModo('pedido')}>
              Entrar con el número de pedido
            </button>
          </p>
        </form>
      ) : (
        <form className="mic-acceso" onSubmit={porPedido}>
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
            <button type="button" className="mic-link-boton" onClick={() => setModo('email')}>
              Mejor mandame el acceso por email
            </button>
          </p>
        </form>
      )}
    </>
  )
}
