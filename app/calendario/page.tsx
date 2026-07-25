import {
  construirCalendario, fechaLinda, CAT_COLOR, CAT_LABEL, PREP_LABEL,
  type ItemCalendario, type PrepEstado,
} from '@/lib/calendario'
import { CopiarPlantilla } from '@/components/CopiarPlantilla'
import { SidebarNav } from '@/components/SidebarNav'
import { FondoHolografico } from '@/components/FondoHolografico'

export const dynamic = 'force-dynamic' // recomputar countdowns en cada visita

const RANGOS = [60, 90, 120, 365]
const RANGO_LABEL = (d: number) => (d >= 365 ? 'Año' : `${d} días`)

const EST_DOT: Record<PrepEstado, string> = {
  vencido: '#f87171', ahora: '#fb923c', pronto: '#fbbf24', ok: '#4ade80',
}
const EST_TXT: Record<PrepEstado, string> = {
  vencido: 'text-red-400', ahora: 'text-orange-400 font-semibold', pronto: 'text-amber-300', ok: 'text-white/45',
}

function countdown(faltan: number): string {
  if (faltan < 0) return 'en curso'
  if (faltan === 0) return 'HOY'
  return `faltan ${faltan} días`
}

function prepWhen(faltan: number): string {
  if (faltan < 0) return `venció hace ${-faltan}d`
  if (faltan === 0) return 'hoy'
  return `en ${faltan}d`
}

function Estrellas({ n }: { n: number }) {
  return (
    <span className="text-amber-400/90 text-xs tracking-tighter" title="relevancia comercial">
      {'★'.repeat(n)}
      <span className="text-white/20">{'★'.repeat(5 - n)}</span>
    </span>
  )
}

function Tarjeta({ it }: { it: ItemCalendario }) {
  const col = CAT_COLOR[it.categoria]
  const urgente = it.faltan >= 0 && it.faltan <= 10
  return (
    <article
      className="rounded-2xl border bg-[#0e0e16] p-4 flex flex-col"
      style={{ borderColor: urgente ? col + '66' : 'rgba(255,255,255,0.06)', borderLeft: `4px solid ${col}` }}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-wide" style={{ color: col }}>
            {countdown(it.faltan)}
          </div>
          <div className="text-xs text-white/40">{fechaLinda(it.fecha)}</div>
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-black/80"
          style={{ background: col }}
        >
          {CAT_LABEL[it.categoria]}
        </span>
      </header>

      <h2 className="mt-2.5 mb-3 flex items-center gap-2 text-base font-semibold text-white/90">
        {it.nombre} <Estrellas n={it.relevancia} />
      </h2>

      <div className="mb-2.5 text-sm text-white/80">
        <span className="mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold text-black/80" style={{ background: col }}>
          PROMO
        </span>
        {it.promo}
      </div>

      <div className="mb-3 rounded-xl bg-[#111119] p-2.5 text-sm italic text-white/75">
        <span className="mr-1.5 rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-bold not-italic text-white/70">
          JUSTIFICATIVO
        </span>
        {it.justificativo}
      </div>

      {it.wsp && (
        <details className="mb-3 text-sm">
          <summary className="cursor-pointer font-medium text-emerald-300">📱 Borrador plantilla WhatsApp</summary>
          <div className="mt-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] p-3">
            <p className="whitespace-pre-wrap text-emerald-100/90">{it.wsp}</p>
            <div className="mt-2 flex justify-end">
              <CopiarPlantilla texto={it.wsp} />
            </div>
          </div>
        </details>
      )}

      <div className="mt-auto border-t border-dashed border-white/10 pt-2.5">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/35">Prep · deadlines</div>
        <div className="space-y-1">
          {it.prep.map((p) => (
            <div key={p.key} className="flex items-center justify-between gap-2 text-xs">
              <span className={`flex items-center gap-1.5 ${EST_TXT[p.estado]}`}>
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: EST_DOT[p.estado] }} />
                {PREP_LABEL[p.key]}
              </span>
              <span className="text-right text-[11px] text-white/40">
                límite {fechaLinda(p.limite)} · {prepWhen(p.faltan)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ dias?: string }>
}) {
  const sp = await searchParams
  const horizonte = RANGOS.includes(Number(sp.dias)) ? Number(sp.dias) : 90
  const items = construirCalendario(horizonte)
  const urgentes = items.filter((i) => i.faltan >= 0 && i.faltan <= 10).length

  return (
    <div className="fx-holo fx-charts relative isolate min-h-screen bg-[#0a0a12] text-white max-lg:pt-14 lg:pl-[256px]">
      <SidebarNav />
      <FondoHolografico />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">📅 Calendario Comercial Vivo</h1>
            <a href="/dashboard" className="text-xs text-white/40 hover:text-white/70">← Volver al dashboard</a>
          </div>
          <div className="flex rounded-xl border border-white/[0.08] bg-[#0e0e16] p-1">
            {RANGOS.map((d) => (
              <a
                key={d}
                href={`/calendario?dias=${d}`}
                className={`rounded-lg px-3 py-1 text-xs transition ${
                  d === horizonte ? 'bg-white/[0.1] text-white' : 'text-white/50 hover:text-white/80'
                }`}
              >
                {RANGO_LABEL(d)}
              </a>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mb-5 grid grid-cols-3 gap-2 sm:max-w-md">
          <div className="rounded-2xl border border-white/[0.06] bg-[#0e0e16] p-3">
            <div className="text-lg font-semibold">{items.length}</div>
            <div className="text-[11px] text-white/45">fechas en juego</div>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-[#0e0e16] p-3">
            <div className="text-lg font-semibold" style={{ color: urgentes ? '#fb923c' : undefined }}>{urgentes}</div>
            <div className="text-[11px] text-white/45">acción en ≤10 días</div>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-[#0e0e16] p-3">
            <div className="text-lg font-semibold text-emerald-400">+20%</div>
            <div className="text-[11px] text-white/45">meta anual</div>
          </div>
        </div>

        <p className="mb-4 text-xs text-white/35">
          Cada fecha es un justificativo para una promo. Programá stock, creativos y plantillas WSP con antelación.
        </p>

        {/* Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <Tarjeta key={it.id} it={it} />
          ))}
        </div>

        {items.length === 0 && (
          <p className="text-sm text-white/40">No hay fechas en esta ventana.</p>
        )}
      </div>
    </div>
  )
}
