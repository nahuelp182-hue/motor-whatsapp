import {
  construirCalendario, fechaLinda, CAT_COLOR, CAT_LABEL, PREP_LABEL,
  type ItemCalendario, type PrepEstado,
} from '@/lib/calendario'
import { CopiarPlantilla } from '@/components/CopiarPlantilla'
import { PanelShell } from '@/components/PanelShell'
import { Banda, Seccion, Kpi } from '@/components/panel/Primitivos'

export const dynamic = 'force-dynamic' // recomputar countdowns en cada visita

const RANGOS = [60, 90, 120, 365]
const RANGO_LABEL = (d: number) => (d >= 365 ? 'Año' : `${d} días`)

// vencido/ahora van en rojo/ámbar (piden acción ya); pronto en ámbar suave
// (que viene); ok se apaga a texto terciario (ya está resuelto, no hay que
// mirarlo). El mismo criterio que separa a un job 'falla' de uno 'ok' en Sistema.
const EST_DOT: Record<PrepEstado, string> = {
  vencido: 'var(--pnl-red)', ahora: 'var(--pnl-amber)', pronto: 'var(--pnl-amber-soft)', ok: 'var(--pnl-green)',
}
const EST_TXT: Record<PrepEstado, string> = {
  vencido: 'text-[var(--pnl-red-text)]',
  ahora: 'text-[var(--pnl-amber)] font-semibold',
  pronto: 'text-[var(--pnl-amber-soft)]',
  ok: 'text-[var(--pnl-text-3)]',
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
    <span className="text-[var(--pnl-amber)] text-xs tracking-tighter" title="relevancia comercial">
      {'★'.repeat(n)}
      <span className="text-[var(--pnl-track)]">{'★'.repeat(5 - n)}</span>
    </span>
  )
}

function TarjetaEvento({ it }: { it: ItemCalendario }) {
  const col = CAT_COLOR[it.categoria]
  return (
    <article
      className="flex flex-col rounded-md border border-[var(--pnl-hair)] border-l-2 bg-[var(--pnl-panel)] p-4"
      style={{ borderLeftColor: col }}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          {/* El número de días es lo que decide, así que va primero y grande
              — no la fecha calendario, que hay que traducir mentalmente. */}
          <div className="num text-xs font-bold uppercase tracking-wide" style={{ color: col }}>
            {countdown(it.faltan)}
          </div>
          <div className="text-xs text-[var(--pnl-text-3)]">{fechaLinda(it.fecha)}</div>
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-[#23262F]"
          style={{ background: col }}
        >
          {CAT_LABEL[it.categoria]}
        </span>
      </header>

      <h2 className="mt-2.5 mb-3 flex items-center gap-2 text-base font-semibold text-[var(--pnl-text)]">
        {it.nombre} <Estrellas n={it.relevancia} />
      </h2>

      <div className="mb-2.5 text-sm text-[var(--pnl-text-2)]">
        <span className="mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold text-[#23262F]" style={{ background: col }}>
          PROMO
        </span>
        {it.promo}
      </div>

      <div className="mb-3 rounded-md bg-[var(--pnl-panel-2)] p-2.5 text-sm italic text-[var(--pnl-text-2)]">
        <span className="mr-1.5 rounded bg-[var(--pnl-track)] px-1.5 py-0.5 text-[10px] font-bold not-italic text-[var(--pnl-text-2)]">
          JUSTIFICATIVO
        </span>
        {it.justificativo}
      </div>

      {it.wsp && (
        <details className="mb-3 text-sm">
          <summary className="min-h-11 cursor-pointer font-medium leading-[44px] text-[var(--pnl-green-text)]">
            Borrador plantilla WhatsApp
          </summary>
          <div className="mt-2 rounded-md border border-[rgba(76,175,125,.2)] bg-[rgba(76,175,125,.06)] p-3">
            <p className="whitespace-pre-wrap text-[var(--pnl-text)]">{it.wsp}</p>
            <div className="mt-2 flex justify-end">
              <CopiarPlantilla texto={it.wsp} />
            </div>
          </div>
        </details>
      )}

      <div className="mt-auto border-t border-dashed border-[var(--pnl-hair)] pt-2.5">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--pnl-text-3)]">Prep · deadlines</div>
        <div className="flex flex-col gap-1">
          {it.prep.map((p) => (
            <div key={p.key} className="flex items-center justify-between gap-2 text-xs">
              <span className={`flex items-center gap-1.5 ${EST_TXT[p.estado]}`}>
                <span className="inline-block size-2 rounded-full" style={{ background: EST_DOT[p.estado] }} />
                {PREP_LABEL[p.key]}
              </span>
              <span className="num text-right text-[11px] text-[var(--pnl-text-3)]">
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
    <PanelShell
      titulo="Calendario comercial"
      sub={`${items.length} fechas en juego · ${urgentes} con acción en ≤10 días`}
      accion={
        <div className="flex rounded-lg border border-[var(--pnl-hair)] bg-[var(--pnl-panel-2)] p-1">
          {RANGOS.map((d) => (
            <a
              key={d}
              href={`/calendario?dias=${d}`}
              aria-current={d === horizonte ? 'page' : undefined}
              className={`flex min-h-9 items-center rounded-md px-3 text-xs transition-colors ${
                d === horizonte ? 'bg-[var(--pnl-track)] text-[var(--pnl-text)]' : 'text-[var(--pnl-text-3)] hover:text-[var(--pnl-text-2)]'
              }`}
            >
              {RANGO_LABEL(d)}
            </a>
          ))}
        </div>
      }
    >
      <Seccion>
        <Banda n="01">Resumen</Banda>
        <div className="grid grid-cols-3 gap-3 sm:max-w-md">
          <Kpi label="Fechas en juego" valor={String(items.length)} />
          <Kpi label="Acción en ≤10 días" valor={String(urgentes)} tono={urgentes ? 'alerta' : undefined} />
          <Kpi label="Meta anual" valor="+20%" tono="bueno" />
        </div>
        <p className="text-xs text-[var(--pnl-text-3)]">
          Cada fecha es un justificativo para una promo. Programá stock, creativos y plantillas WSP con antelación.
        </p>
      </Seccion>

      <Seccion>
        <Banda n="02">Próximas fechas</Banda>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <TarjetaEvento key={it.id} it={it} />
          ))}
        </div>
        {items.length === 0 && (
          <p className="text-sm text-[var(--pnl-text-3)]">No hay fechas en esta ventana.</p>
        )}
      </Seccion>
    </PanelShell>
  )
}
