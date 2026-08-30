import { getPool } from '@/lib/db'
import { ultimosDos, analizar, leerYT, type Fila, type Analisis, type YTVideo } from '@/lib/radar'
import { PanelShell } from '@/components/PanelShell'
import { Banda, Seccion, Vacio } from '@/components/panel/Primitivos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function cargar(): Promise<{ a: Analisis; fecha: string | null; yt: YTVideo[] }> {
  const p = getPool()
  const vacio: Analisis = { emergentes: [], contenido: [], compra: [], hayBase: false, fecha: null }
  if (!p) return { a: vacio, fecha: null, yt: [] }
  try {
    const [snaps, yt] = await Promise.all([ultimosDos(p), leerYT(p)])
    if (snaps.length === 0) return { a: vacio, fecha: null, yt }
    const previo = snaps[1]?.consultas ?? null
    return { a: analizar(snaps[0].consultas, previo), fecha: snaps[0].fecha, yt }
  } catch {
    return { a: vacio, fecha: null, yt: [] }
  }
}

function fmtViews(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M'
  if (n >= 1_000) return Math.round(n / 1_000) + 'K'
  return String(n)
}

function TarjetaYouTube({ videos }: { videos: YTVideo[] }) {
  return (
    <section className="rounded-md border border-l-2 border-[var(--pnl-hair)] border-l-[var(--pnl-red)] bg-[var(--pnl-panel)] p-5">
      <h2 className="text-sm font-semibold text-[var(--pnl-red-text)]">Qué performa en YouTube</h2>
      <p className="mb-3 text-[11px] text-[var(--pnl-text-3)]">Videos de tu nicho por vistas — formatos/ángulos que funcionan</p>
      {videos.length === 0 ? (
        <p className="text-xs italic text-[var(--pnl-text-3)]">se llena en el próximo cron</p>
      ) : (
        <div className="flex flex-col">
          {videos.map((v) => (
            <a
              key={v.videoId}
              href={`https://www.youtube.com/watch?v=${v.videoId}`}
              target="_blank"
              rel="noopener"
              className="flex items-start gap-2 border-t border-[var(--pnl-hair)] py-1.5 text-sm text-[var(--pnl-text)] first:border-t-0 hover:text-[var(--pnl-red-text)]"
            >
              <span className="num mt-0.5 shrink-0 rounded bg-[var(--pnl-panel-2)] px-1.5 py-0.5 text-[10px] text-[var(--pnl-text-2)]">
                {fmtViews(v.views)}
              </span>
              <span className="flex-1">
                {v.titulo}
                <span className="block text-[11px] text-[var(--pnl-text-3)]">{v.canal}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </section>
  )
}

function Badge({ estado }: { estado: Fila['estado'] }) {
  if (!estado) return null
  const nuevo = estado === 'NUEVO'
  return (
    <span
      className={[
        'rounded-full px-2 py-0.5 text-[10px] font-bold',
        nuevo
          ? 'bg-[var(--pnl-green)] text-[#04210f]'
          : 'bg-[var(--pnl-lilac)] text-white',
      ].join(' ')}
    >
      {nuevo ? 'NUEVO' : 'SUBE'}
    </span>
  )
}

function Lista({ filas, max }: { filas: Fila[]; max: number }) {
  if (filas.length === 0) return <p className="text-xs italic text-[var(--pnl-text-3)]">nada por ahora</p>
  return (
    <div className="flex flex-col">
      {filas.slice(0, max).map((f) => (
        <a
          key={f.consulta}
          href={`https://www.google.com/search?q=${encodeURIComponent(f.consulta)}`}
          target="_blank"
          rel="noopener"
          className="flex min-h-11 items-center gap-2 border-t border-[var(--pnl-hair)] py-1.5 text-sm text-[var(--pnl-text)] first:border-t-0 hover:text-[var(--pnl-green-text)]"
        >
          <span className="flex-1">{f.consulta}</span>
          <Badge estado={f.estado} />
          <span className="num text-[11px] text-[var(--pnl-text-3)]">x{f.score}</span>
        </a>
      ))}
    </div>
  )
}

function Card({ titulo, sub, filas, max, acento }: {
  titulo: string; sub: string; filas: Fila[]; max: number; acento?: string
}) {
  return (
    <section
      className="rounded-md border border-l-2 border-[var(--pnl-hair)] bg-[var(--pnl-panel)] p-5"
      style={acento ? { borderLeftColor: acento } : undefined}
    >
      <h2
        className="text-sm font-semibold"
        style={{ color: acento ?? 'var(--pnl-text)' }}
      >
        {titulo}
      </h2>
      <p className="mb-3 text-[11px] text-[var(--pnl-text-3)]">{sub}</p>
      <Lista filas={filas} max={max} />
    </section>
  )
}

export default async function RadarPage() {
  const { a, fecha, yt } = await cargar()
  const total = a.emergentes.length + a.contenido.length + a.compra.length + yt.length

  return (
    <PanelShell titulo="Radar de Tendencias" sub={fecha ? `Snapshot ${fecha}` : 'Sin datos aún'}>
      <Seccion>
        <Banda n="01">Qué busca tu público</Banda>
        <p className="max-w-2xl text-xs text-[var(--pnl-text-3)]">
          Lo que tu público realmente busca sobre tus temas (autocultivo, gírgolas, adaptógenos…),
          filtrado a Argentina. No son noticias del día: son ideas de contenido con demanda real y
          durabilidad. <span className="text-[var(--pnl-green-text)]">Emergentes</span> = lo que empezó a
          subir respecto de ayer.
        </p>

        {total === 0 ? (
          <Vacio
            titulo="Todavía no hay snapshot"
            detalle="El radar corre cada mañana (cron diario). Volvé mañana o disparalo manualmente desde /api/cron/radar."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card
              titulo="🚀 Emergentes"
              sub="Nuevo o subiendo vs. ayer — lo caliente del nicho"
              filas={a.emergentes}
              max={30}
              acento="var(--pnl-green)"
            />
            <Card
              titulo="💡 Ideas de contenido"
              sub="Preguntas informacionales — guion de video/post"
              filas={a.contenido}
              max={30}
            />
            <Card
              titulo="🛒 Intención de compra"
              sub="Búsquedas transaccionales — demanda de producto"
              filas={a.compra}
              max={20}
            />
            <TarjetaYouTube videos={yt} />
          </div>
        )}
      </Seccion>
    </PanelShell>
  )
}
