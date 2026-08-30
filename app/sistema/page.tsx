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
  CheckCircle2, ChevronDown, HelpCircle,
  Loader2, RefreshCw, Server, Cloud, Workflow, Monitor,
} from 'lucide-react'
import { PanelShell } from '@/components/PanelShell'
import { Banda, Seccion, Aviso } from '@/components/panel/Primitivos'

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

// 'corriendo' va en lila y no en verde a propósito: no está diciendo que salió bien, está
// diciendo que todavía no se sabe. Confundirlo con OK es la mentira que se quiere evitar.
const COLOR: Record<Estado, string> = {
  ok: 'var(--pnl-green)', falla: 'var(--pnl-red)', atrasado: 'var(--pnl-amber)',
  nunca: 'var(--pnl-text-3)', corriendo: 'var(--pnl-lilac)',
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
    <div className="flex items-start gap-3 border-t border-[var(--pnl-hair)] py-2.5 first:border-t-0">
      <span className="mt-1.5"><Punto estado={j.estado} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="num text-[13px] text-[var(--pnl-text)]">{j.slug}</span>
          <span className="text-[11px] text-[var(--pnl-text-3)]">{hace(j.horas)}</span>
          {/* Se escribe con todas las letras, y no solo con el color del punto, porque es
              el estado que más se malinterpreta: sin la palabra, un job que arrancó recién
              se lee como uno que no reportó. */}
          {j.estado === 'corriendo' && (
            <span className="rounded-full bg-[rgba(126,134,184,.18)] px-2 py-0.5 text-[11px] text-[var(--pnl-lilac-soft)]">
              En proceso
            </span>
          )}
        </div>
        {/* La reseña es lo único que vuelve legible una fila en rojo a las 3 de la mañana. */}
        <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--pnl-text-2)]">{j.que}</p>
        {j.detalle && (
          <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap rounded-md bg-black/30 p-2 font-mono text-[11px] leading-relaxed text-[var(--pnl-red-text)]">
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
    <div className="rounded-md border border-[var(--pnl-hair)] bg-[var(--pnl-panel)]">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={abierto}
      >
        <Icono className="size-4 shrink-0 text-[var(--pnl-text-3)]" aria-hidden />
        <span className="text-sm font-medium text-[var(--pnl-text)]">{NOMBRE_ORIGEN[origen]}</span>
        <span className="text-xs text-[var(--pnl-text-3)]">{jobs.length}</span>
        {rotos > 0 && (
          <span className="rounded-full bg-[rgba(232,80,58,.15)] px-2 py-0.5 text-[11px] text-[var(--pnl-red-text)]">
            {rotos} con problemas
          </span>
        )}
        <ChevronDown
          className={`ml-auto size-4 shrink-0 text-[var(--pnl-text-3)] transition-transform motion-reduce:transition-none ${abierto ? 'rotate-180' : ''}`}
          aria-hidden
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
    <PanelShell
      titulo="Sistema"
      sub={
        d ? (
          sano
            ? `${d.resumen.ok} de ${d.resumen.total} en orden`
            : `${rotos.length} de ${d.resumen.total} con problemas`
        ) : undefined
      }
      accion={
        <button
          onClick={auditar}
          disabled={auditando}
          className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--pnl-hair)] bg-[var(--pnl-panel-2)] px-3.5 text-[13px] font-medium text-[var(--pnl-text)] transition-colors hover:bg-[var(--pnl-track)] disabled:opacity-50"
        >
          {auditando ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
          {auditando ? 'Auditando…' : 'Auditar ahora'}
        </button>
      }
    >
      {aviso && <Aviso>{aviso}</Aviso>}

      <div className="flex gap-0 overflow-x-auto border-b border-[var(--pnl-hair)]">
        {([['estado', 'Estado'], ['gasto', 'Gasto IA']] as const).map(([id, txt]) => (
          <button
            key={id}
            onClick={() => setPestana(id)}
            aria-selected={pestana === id}
            role="tab"
            className={`min-h-11 whitespace-nowrap border-b-2 px-4 text-[13.5px] transition-colors ${
              pestana === id
                ? 'border-[var(--pnl-amber)] font-semibold text-[var(--pnl-text)]'
                : 'border-transparent text-[var(--pnl-text-3)] hover:text-[var(--pnl-text-2)]'
            }`}
          >
            {txt}
          </button>
        ))}
      </div>

      {cargando && <p className="text-sm text-[var(--pnl-text-3)]">Cargando…</p>}

      {d && pestana === 'estado' && (
        <>
          <Seccion>
            <Banda n="01">Necesita atención</Banda>
            {/* Zona de atención: solo lo roto. Si no hay nada, una línea y listo. */}
            {rotos.length > 0 ? (
              <div className="rounded-md border border-l-2 border-[rgba(232,80,58,.28)] border-l-[var(--pnl-red)] bg-[rgba(232,80,58,.07)] p-4">
                {rotos.map((j) => <FilaJob key={j.slug} j={j} />)}
              </div>
            ) : (
              <Aviso tono="ok">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0 text-[var(--pnl-green-text)]" aria-hidden />
                  Todas las automatizaciones corrieron dentro de su cadencia.
                </span>
              </Aviso>
            )}

            {d.resumen.nunca > 0 && (
              <Aviso>
                <span className="flex items-start gap-2">
                  <HelpCircle className="mt-0.5 size-4 shrink-0 text-[var(--pnl-text-3)]" aria-hidden />
                  <span>
                    <strong className="text-[var(--pnl-text)]">{d.resumen.nunca} sin reportar todavía.</strong>{' '}
                    No es lo mismo que caído: son los que aún no llegaron a su primera corrida
                    desde que se instrumentó el sistema. Los mensuales tardan hasta 30 días en aparecer.
                  </span>
                </span>
              </Aviso>
            )}
          </Seccion>

          <Seccion>
            <Banda n="02">Por origen</Banda>
            <div className="flex flex-col gap-3">
              {(['vps', 'github', 'windows', 'vercel'] as Origen[]).map((o) => {
                const jobs = d.jobs.filter((j) => j.origen === o)
                return jobs.length ? <Grupo key={o} origen={o} jobs={jobs} /> : null
              })}
            </div>
          </Seccion>
        </>
      )}

      {d && pestana === 'gasto' && (
        <Seccion>
          <Banda n="01">Gasto de IA</Banda>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="num text-2xl font-semibold">{USD(d.gasto.total)}</span>
            <span className="text-sm text-[var(--pnl-text-3)]">en {d.gasto.desdeDias} días</span>
          </div>

          <div className="overflow-x-auto rounded-md border border-[var(--pnl-hair)] bg-[var(--pnl-panel)]">
            <table className="w-full min-w-[680px] text-left text-[13px]">
              <caption className="sr-only">Gasto de IA por consumidor, últimos {d.gasto.desdeDias} días</caption>
              <thead className="text-[11px] uppercase tracking-wide text-[var(--pnl-text-3)]">
                <tr className="border-b border-[var(--pnl-hair)]">
                  <th scope="col" className="px-4 py-2.5 font-medium">Consumidor</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">USD</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Por llamada</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Llamadas</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Búsquedas</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Caché</th>
                </tr>
              </thead>
              <tbody>
                {d.gasto.consumidores.map((c) => (
                  <tr key={c.canal} className="border-b border-[var(--pnl-hair)] last:border-0">
                    <td className="px-4 py-2.5">
                      <span className="num text-[var(--pnl-text)]">{c.canal}</span>
                      <span className="ml-2 text-[11px] text-[var(--pnl-text-3)]">{c.proveedor}</span>
                    </td>
                    <td className="num px-3 py-2.5 text-right text-[var(--pnl-text)]">{USD(c.usd)}</td>
                    <td className="num px-3 py-2.5 text-right text-[var(--pnl-text-2)]">{USD(c.usdPorLlamada)}</td>
                    <td className="num px-3 py-2.5 text-right text-[var(--pnl-text-2)]">{NUM(c.llamadas)}</td>
                    <td className="num px-3 py-2.5 text-right text-[var(--pnl-text-2)]">
                      {c.busquedas ? NUM(c.busquedas) : '—'}
                    </td>
                    <td className="num px-3 py-2.5 text-right text-[var(--pnl-text-2)]">
                      {c.cachePct >= 1 ? `${c.cachePct.toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                ))}
                {d.gasto.consumidores.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-[var(--pnl-text-3)]">Sin datos todavía</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-[var(--pnl-hair)] bg-[var(--pnl-panel)] px-4 py-3 text-[12.5px] leading-relaxed text-[var(--pnl-text-2)]">
            <p>
              <strong className="text-[var(--pnl-text)]">USD por llamada importa tanto como el total.</strong>{' '}
              Un consumidor caro por llamada se arregla tocando el prompt o las herramientas;
              uno caro por volumen, bajando la frecuencia. Con solo el total, los dos se ven igual.
            </p>
            <p>
              <strong className="text-[var(--pnl-text)]">La búsqueda web casi no cuesta por sí misma</strong>{' '}
              (USD 10 cada 1.000), pero sus resultados vuelven como tokens de entrada. Ahí está
              el gasto real: la palanca es <code className="text-[var(--pnl-text)]">max_uses</code>, no el modelo.
            </p>
            <p>
              Esto es una estimación propia calculada con la tabla de precios del código.
              El número facturado está en{' '}
              <a href="https://platform.claude.com/cost" target="_blank" rel="noopener"
                 className="text-[var(--pnl-amber)] underline underline-offset-2">la consola de Anthropic</a>.
              El consumo de Claude Code no aparece acá: va por suscripción, no por API.
            </p>
          </div>
        </Seccion>
      )}
    </PanelShell>
  )
}
