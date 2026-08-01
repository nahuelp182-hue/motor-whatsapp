'use client'

// Solapa Sistema — estado de las 46 automatizaciones y gasto de IA.
//
// EL PRINCIPIO DE DISEÑO: cuando todo anda, esta pantalla está casi vacía.
//
// Un muro de 46 tarjetas verdes entrena a no mirar. Lo que está roto va arriba y solo; el
// inventario completo queda plegado para cuando alguien lo busque a propósito.
//
// Las dos pestañas no compiten: el estado se mira todos los días en cinco segundos, el
// gasto una vez por mes con calma. Meterlos en un mismo scroll arruina los dos. El
// veredicto global y el botón viven ARRIBA de las pestañas porque valen para las dos.
import { useCallback, useEffect, useState } from 'react'
import {
  Activity, AlertTriangle, CheckCircle2, ChevronDown, HelpCircle,
  Loader2, RefreshCw, Server, Cloud, Workflow, Monitor, DollarSign,
} from 'lucide-react'
import { SidebarNav } from '@/components/SidebarNav'

type Estado = 'ok' | 'atrasado' | 'falla' | 'nunca' | 'corriendo'
type Origen = 'vps' | 'vercel' | 'github' | 'windows'

type Job = {
  slug: string; que: string; origen: Origen; estado: Estado
  horas: number | null; detalle: string | null; maxHoras: number
}
type Consumidor = {
  canal: string; proveedor: string; llamadas: number; usd: number
  usdPorLlamada: number; tokensEntrada: number; tokensSalida: number
  busquedas: number; cachePct: number
}
type Datos = {
  jobs: Job[]
  resumen: { total: number; ok: number; falla: number; atrasado: number; nunca: number; corriendo: number }
  gasto: { consumidores: Consumidor[]; total: number; desdeDias: number }
}

const USD = (n: number) => `USD ${n < 0.01 && n > 0 ? n.toFixed(4) : n.toFixed(2)}`
const NUM = (n: number) => new Intl.NumberFormat('es-AR').format(n)

function hace(h: number | null): string {
  if (h === null) return 'nunca'
  if (h < 1) return `hace ${Math.round(h * 60)} min`
  if (h < 48) return `hace ${Math.round(h)} h`
  return `hace ${Math.round(h / 24)} días`
}

// 'corriendo' va en azul y no en verde a propósito: no está diciendo que salió bien, está
// diciendo que todavía no se sabe. Confundirlo con OK es la mentira que se quiere evitar.
const COLOR: Record<Estado, string> = {
  ok: '#34d399', falla: '#f87171', atrasado: '#fbbf24', nunca: '#94a3b8', corriendo: '#60a5fa',
}
const ETIQUETA: Record<Estado, string> = {
  ok: 'OK', falla: 'Falló', atrasado: 'Atrasado', nunca: 'Sin reportar', corriendo: 'En proceso',
}
const ICONO_ORIGEN = { vps: Server, vercel: Cloud, github: Workflow, windows: Monitor }
const NOMBRE_ORIGEN = { vps: 'VPS', vercel: 'Vercel', github: 'GitHub Actions', windows: 'Windows' }

function Punto({ estado }: { estado: Estado }) {
  return (
    <span
      className="inline-block size-2 shrink-0 rounded-full"
      style={{ backgroundColor: COLOR[estado], boxShadow: `0 0 8px ${COLOR[estado]}88` }}
      aria-label={ETIQUETA[estado]}
    />
  )
}

function FilaJob({ j }: { j: Job }) {
  return (
    <div className="flex items-start gap-3 border-t border-white/[0.06] py-2.5 first:border-t-0">
      <span className="mt-1.5"><Punto estado={j.estado} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono text-[13px] text-white/90">{j.slug}</span>
          <span className="text-[11px] text-white/35">{hace(j.horas)}</span>
          {/* Se escribe con todas las letras, y no solo con el color del punto, porque es
              el estado que más se malinterpreta: sin la palabra, un job que arrancó recién
              se lee como uno que no reportó. */}
          {j.estado === 'corriendo' && (
            <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] text-sky-300">
              En proceso
            </span>
          )}
        </div>
        {/* La reseña es lo único que vuelve legible una fila en rojo a las 3 de la mañana. */}
        <p className="mt-0.5 text-[12.5px] leading-snug text-white/55">{j.que}</p>
        {j.detalle && (
          <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-2 font-mono text-[11px] leading-relaxed text-red-300/80">
            {j.detalle}
          </pre>
        )}
      </div>
    </div>
  )
}

function Grupo({ origen, jobs }: { origen: Origen; jobs: Job[] }) {
  const [abierto, setAbierto] = useState(false)
  const Icono = ICONO_ORIGEN[origen]
  const rotos = jobs.filter((j) => j.estado === 'falla' || j.estado === 'atrasado').length

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0e0e16]">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={abierto}
      >
        <Icono className="size-4 shrink-0 text-white/40" />
        <span className="text-sm font-medium text-white/85">{NOMBRE_ORIGEN[origen]}</span>
        <span className="text-xs text-white/35">{jobs.length}</span>
        {rotos > 0 && (
          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] text-red-300">
            {rotos} con problemas
          </span>
        )}
        <ChevronDown
          className={`ml-auto size-4 shrink-0 text-white/30 transition-transform ${abierto ? 'rotate-180' : ''}`}
        />
      </button>
      {abierto && (
        <div className="px-4 pb-3">
          {jobs.map((j) => <FilaJob key={j.slug} j={j} />)}
        </div>
      )}
    </div>
  )
}

export default function SistemaPage() {
  const [d, setD] = useState<Datos | null>(null)
  const [cargando, setCargando] = useState(true)
  const [auditando, setAuditando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [pestana, setPestana] = useState<'estado' | 'gasto'>('estado')

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/sistema/estado', { cache: 'no-store' })
      if (r.ok) setD(await r.json())
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function auditar() {
    setAuditando(true)
    setAviso(null)
    try {
      const r = await fetch('/api/sistema/auditoria', { method: 'POST' })
      const j = await r.json()
      // El 429 del VPS no es un error: es el freno de 60 s haciendo su trabajo. Decir
      // "falló" ahí manda a buscar un problema que no existe.
      if (j.ocupado) setAviso('Hay una auditoría reciente o en curso. Esperá un momento.')
      else if (!r.ok) setAviso(j.error ?? 'No se pudo auditar')
      else setAviso('Auditoría completa.')
      await cargar()
    } catch {
      setAviso('No se pudo hablar con el VPS')
    } finally {
      setAuditando(false)
    }
  }

  const rotos = d?.jobs.filter((j) => j.estado === 'falla' || j.estado === 'atrasado') ?? []
  const sano = d && rotos.length === 0

  return (
    <div className="min-h-screen bg-[#08080d] lg:pl-[248px]">
      <SidebarNav />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <header className="mb-5 flex flex-wrap items-center gap-3">
          <Activity className="size-5 text-cyan-300" />
          <h1 className="text-lg font-semibold text-white">Sistema</h1>
          {d && (
            <span className="flex items-center gap-2 text-sm text-white/55">
              {sano ? (
                <><CheckCircle2 className="size-4 text-emerald-400" />
                  {d.resumen.ok} de {d.resumen.total} en orden</>
              ) : (
                <><AlertTriangle className="size-4 text-red-400" />
                  {rotos.length} de {d.resumen.total} con problemas</>
              )}
            </span>
          )}
          <button
            onClick={auditar}
            disabled={auditando}
            className="ml-auto flex items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-3.5 py-2 text-[13px] font-medium text-cyan-200 transition-colors hover:bg-cyan-400/15 disabled:opacity-50"
          >
            {auditando ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {auditando ? 'Auditando…' : 'Auditar ahora'}
          </button>
        </header>

        {aviso && (
          <p className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-white/70">
            {aviso}
          </p>
        )}

        <div className="mb-5 flex gap-1 border-b border-white/[0.08]">
          {([['estado', 'Estado', Activity], ['gasto', 'Gasto IA', DollarSign]] as const).map(
            ([id, txt, Ico]) => (
              <button
                key={id}
                onClick={() => setPestana(id)}
                className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13.5px] transition-colors ${
                  pestana === id
                    ? 'border-cyan-400 text-white'
                    : 'border-transparent text-white/45 hover:text-white/70'
                }`}
              >
                <Ico className="size-4" />{txt}
              </button>
            ),
          )}
        </div>

        {cargando && <p className="text-sm text-white/40">Cargando…</p>}

        {d && pestana === 'estado' && (
          <div className="flex flex-col gap-4">
            {/* Zona de atención: solo lo roto. Si no hay nada, una línea y listo. */}
            {rotos.length > 0 ? (
              <section className="rounded-2xl border border-red-500/25 bg-red-500/[0.04] p-4">
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-300">
                  <AlertTriangle className="size-4" />Necesita atención
                </h2>
                {rotos.map((j) => <FilaJob key={j.slug} j={j} />)}
              </section>
            ) : (
              <p className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-3 text-sm text-emerald-300/90">
                <CheckCircle2 className="size-4" />
                Todas las automatizaciones corrieron dentro de su cadencia.
              </p>
            )}

            {d.resumen.nunca > 0 && (
              <p className="flex items-start gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5 text-[12.5px] text-white/50">
                <HelpCircle className="mt-0.5 size-4 shrink-0 text-white/30" />
                <span>
                  <strong className="text-white/70">{d.resumen.nunca} sin reportar todavía.</strong>{' '}
                  No es lo mismo que caído: son los que aún no llegaron a su primera corrida
                  desde que se instrumentó el sistema. Los mensuales tardan hasta 30 días en aparecer.
                </span>
              </p>
            )}

            {(['vps', 'github', 'windows', 'vercel'] as Origen[]).map((o) => {
              const jobs = d.jobs.filter((j) => j.origen === o)
              return jobs.length ? <Grupo key={o} origen={o} jobs={jobs} /> : null
            })}
          </div>
        )}

        {d && pestana === 'gasto' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-2xl font-semibold text-white">{USD(d.gasto.total)}</span>
              <span className="text-sm text-white/45">en {d.gasto.desdeDias} días</span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0e0e16]">
              <table className="w-full min-w-[680px] text-left text-[13px]">
                <thead className="text-[11px] uppercase tracking-wide text-white/35">
                  <tr className="border-b border-white/[0.08]">
                    <th className="px-4 py-2.5 font-medium">Consumidor</th>
                    <th className="px-3 py-2.5 text-right font-medium">USD</th>
                    <th className="px-3 py-2.5 text-right font-medium">Por llamada</th>
                    <th className="px-3 py-2.5 text-right font-medium">Llamadas</th>
                    <th className="px-3 py-2.5 text-right font-medium">Búsquedas</th>
                    <th className="px-3 py-2.5 text-right font-medium">Caché</th>
                  </tr>
                </thead>
                <tbody>
                  {d.gasto.consumidores.map((c) => (
                    <tr key={c.canal} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-white/85">{c.canal}</span>
                        <span className="ml-2 text-[11px] text-white/30">{c.proveedor}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-white/90">{USD(c.usd)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-white/60">{USD(c.usdPorLlamada)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-white/50">{NUM(c.llamadas)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-white/50">
                        {c.busquedas ? NUM(c.busquedas) : '—'}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-white/50">
                        {c.cachePct >= 1 ? `${c.cachePct.toFixed(0)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                  {d.gasto.consumidores.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-6 text-center text-white/35">Sin datos todavía</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-[12.5px] leading-relaxed text-white/50">
              <p>
                <strong className="text-white/70">USD por llamada importa tanto como el total.</strong>{' '}
                Un consumidor caro por llamada se arregla tocando el prompt o las herramientas;
                uno caro por volumen, bajando la frecuencia. Con solo el total, los dos se ven igual.
              </p>
              <p>
                <strong className="text-white/70">La búsqueda web casi no cuesta por sí misma</strong>{' '}
                (USD 10 cada 1.000), pero sus resultados vuelven como tokens de entrada. Ahí está
                el gasto real: la palanca es <code className="text-white/70">max_uses</code>, no el modelo.
              </p>
              <p>
                Esto es una estimación propia calculada con la tabla de precios del código.
                El número facturado está en{' '}
                <a href="https://platform.claude.com/cost" target="_blank" rel="noopener"
                   className="text-cyan-300/80 underline underline-offset-2">la consola de Anthropic</a>.
                El consumo de Claude Code no aparece acá: va por suscripción, no por API.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
