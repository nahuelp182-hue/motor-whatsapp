'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { MARCA, seccionHabilitada } from '@/lib/marca'

function LoginForm() {
  const [password, setPassword]   = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [dots, setDots]           = useState(0)
  const inputRef                  = useRef<HTMLInputElement>(null)
  const router                    = useRouter()
  const searchParams              = useSearchParams()
  // Cada instancia arranca en su propia sección: en una acotada (Osamayor) '/dashboard'
  // está bloqueado por el middleware, así que el default no puede ser fijo.
  const pedido                    = searchParams.get('from')
  const from                      = pedido && seccionHabilitada(pedido) ? pedido : MARCA.inicio

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (!loading) return
    const t = setInterval(() => setDots(d => (d + 1) % 4), 300)
    return () => clearInterval(t)
  }, [loading])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password || loading) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password }),
      })

      if (res.ok) {
        router.push(from)
        router.refresh()
      } else {
        const data = await res.json()
        setError(data.error ?? 'Error al verificar')
        setPassword('')
        inputRef.current?.focus()
      }
    } catch {
      setError('Error de red')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="panel-root min-h-screen flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-xs">

        {/* Logo / título */}
        <div className="text-center mb-8">
          <p className="text-[10px] uppercase tracking-[0.22em] mb-1" style={{ color: 'var(--pnl-amber)' }}>{MARCA.nombre}</p>
          <h1 className="text-lg font-bold" style={{ color: 'var(--pnl-text)' }}>{MARCA.subtitulo}</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--pnl-text-3)' }}>Acceso restringido — ingresá tu clave</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6" style={{ background: 'var(--pnl-panel)', border: '1px solid var(--pnl-hair)' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.15em] mb-2" style={{ color: 'var(--pnl-text-3)' }}>
                Contraseña
              </label>
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  className="w-full rounded-xl pl-4 pr-11 py-3 text-sm focus:outline-none transition-all"
                  style={{
                    background:  'var(--pnl-panel-2)',
                    border:      '1px solid var(--pnl-hair)',
                    color:       'var(--pnl-text)',
                  }}
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-0 top-0 h-full px-3 flex items-center"
                  style={{ color: 'var(--pnl-text-3)' }}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-8-10-8a18.4 18.4 0 0 1 4.22-5.77M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.42 18.42 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s3-8 11-8 11 8 11 8-3 8-11 8-11-8-11-8Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(232,80,58,0.08)', border: '1px solid rgba(232,80,58,0.25)' }}>
                <p className="text-xs" style={{ color: 'var(--pnl-red-text)' }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-40"
              style={{
                background:   'rgba(245,166,35,0.16)',
                border:       '1px solid rgba(245,166,35,0.30)',
                color:        'var(--pnl-amber-soft)',
              }}
            >
              {loading
                ? `Verificando${'.'.repeat(dots)}`
                : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] mt-5" style={{ color: 'var(--pnl-text-3)', opacity: 0.6 }}>
          {MARCA.pie} © {new Date().getFullYear()}
        </p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
