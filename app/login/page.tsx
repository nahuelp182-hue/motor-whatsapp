'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { MARCA, seccionHabilitada } from '@/lib/marca'

function LoginForm() {
  const [password, setPassword]   = useState('')
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
    <main
      className="min-h-screen flex items-center justify-center p-4 font-sans"
      style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(249,115,22,0.08) 0%, transparent 60%), #07070f' }}
    >
      <div className="w-full max-w-xs">

        {/* Logo / título */}
        <div className="text-center mb-8">
          <p className="text-[10px] uppercase tracking-[0.22em] text-orange-400/60 mb-1">{MARCA.nombre}</p>
          <h1 className="text-lg font-bold text-white">{MARCA.subtitulo}</h1>
          <p className="text-xs text-white/35 mt-1">Acceso restringido — ingresá tu clave</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/[0.08] p-6"
          style={{ background: '#111119' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.15em] text-white/40 mb-2">
                Contraseña
              </label>
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="••••••••"
                className="w-full rounded-xl border border-white/10 bg-[#14141c] px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-orange-500/40 focus:bg-[#191922] transition-all"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-40"
              style={{
                background:   'rgba(249,115,22,0.18)',
                border:       '1px solid rgba(249,115,22,0.28)',
                color:        '#fb923c',
              }}
            >
              {loading
                ? `Verificando${'.'.repeat(dots)}`
                : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-white/15 mt-5">
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
