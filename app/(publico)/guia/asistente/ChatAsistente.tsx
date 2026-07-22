'use client'

import { useEffect, useRef, useState } from 'react'

type Turno = { role: 'user' | 'assistant'; content: string; guia?: string | null; whatsapp?: string | null }

const TITULOS_GUIA: Record<string, string> = {
  'los-dos-vitales': 'Las dos cosas que definen el resultado',
  'donde-conseguir-insumos': 'Qué necesitás además del equipo',
  'como-funciona-la-incubadora': 'Cómo funciona la incubadora',
}

function saludoInicial(nombre: string | null): Turno {
  return {
    role: 'assistant',
    content: nombre
      ? `¡Hola, ${nombre}! Soy el asistente de Micelium®. Ya sé qué equipo tenés y cómo viene tu ` +
        'envío, así que preguntame directamente lo que necesites.'
      : '¡Hola! Soy el asistente de Micelium®. Te ayudo con dudas del equipo, el cultivo o tu ' +
        'compra. ¿Qué querés saber?',
  }
}

function sid(): string {
  try {
    const k = 'mic-sid'
    let v = localStorage.getItem(k)
    if (!v) {
      v = (crypto.randomUUID?.() ?? String(Math.random())).slice(0, 36)
      localStorage.setItem(k, v)
    }
    return v
  } catch {
    return 'anon'
  }
}

export default function ChatAsistente({ nombreCliente = null }: { nombreCliente?: string | null }) {
  const [turnos, setTurnos] = useState<Turno[]>(() => [saludoInicial(nombreCliente)])
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(false)
  const finRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turnos, cargando])

  async function enviar(e?: React.FormEvent) {
    e?.preventDefault()
    const m = texto.trim()
    if (!m || cargando) return

    const nuevos: Turno[] = [...turnos, { role: 'user', content: m }]
    setTurnos(nuevos)
    setTexto('')
    setCargando(true)

    try {
      // El turno 0 es siempre el saludo del asistente: no va en el historial que se manda.
      const historial = nuevos.slice(1).map(t => ({ role: t.role, content: t.content }))
      const r = await fetch('/api/asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: m, historial, sid: sid() }),
      })
      const d = await r.json()
      setTurnos(t => [
        ...t,
        {
          role: 'assistant',
          content: d.respuesta ?? 'Perdoná, no pude responder. Probá de nuevo.',
          guia: d.guia ?? null,
          whatsapp: d.whatsapp ?? null,
        },
      ])
    } catch {
      setTurnos(t => [
        ...t,
        {
          role: 'assistant',
          content: 'Se cortó la conexión. Escribinos por WhatsApp y te damos una mano.',
          whatsapp: '543512145521',
        },
      ])
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="mic-chat">
      <div className="mic-chat-hilo">
        {turnos.map((t, i) => (
          <div key={i} className={`mic-msg mic-msg-${t.role}`}>
            <div className="mic-burbuja">{t.content}</div>
            {t.guia && TITULOS_GUIA[t.guia] && (
              <a className="mic-msg-guia" href={`/guia/${t.guia}`}>
                Leer: {TITULOS_GUIA[t.guia]} →
              </a>
            )}
            {t.whatsapp && (
              <a className="mic-msg-wa" href={`https://wa.me/${t.whatsapp}`}>
                Seguir por WhatsApp con una persona →
              </a>
            )}
          </div>
        ))}
        {cargando && (
          <div className="mic-msg mic-msg-assistant">
            <div className="mic-burbuja mic-escribiendo">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        <div ref={finRef} />
      </div>

      <form className="mic-chat-form" onSubmit={enviar}>
        <input
          className="mic-chat-input"
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Escribí tu consulta…"
          maxLength={1000}
          disabled={cargando}
          autoFocus
        />
        <button className="mic-chat-enviar" type="submit" disabled={cargando || !texto.trim()}>
          Enviar
        </button>
      </form>
      <p className="mic-chat-nota">
        Es un asistente automático. Para el estado de un cultivo o una falla, te pasamos con
        una persona del equipo.
      </p>
    </div>
  )
}
