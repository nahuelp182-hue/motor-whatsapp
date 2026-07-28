import { getPool } from '@/lib/db'
import { ultimosDos, analizar, leerYT, type Fila, type Analisis, type YTVideo } from '@/lib/radar'
import { SidebarNav } from '@/components/SidebarNav'
import { FondoHolografico } from '@/components/FondoHolografico'

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
    <section className="rounded-2xl border bg-[#0e0e16] p-5" style={{ borderColor: '#ef444455' }}>
      <h2 className="text-sm font-semibold" style={{ color: '#f87171' }}>📺 Qué performa en YouTube</h2>
      <p className="mb-3 text-[11px] text-white/40">Videos de tu nicho por vistas — formatos/ángulos que funcionan</p>
      {videos.length === 0 ? (
        <p className="text-xs italic text-white/35">se llena en el próximo cron</p>
      ) : (
        <div className="flex flex-col">
          {videos.map((v) => (
            <a
              key={v.videoId}
              href={`https://www.youtube.com/watch?v=${v.videoId}`}
              target="_blank"
              rel="noopener"
              className="flex items-start gap-2 border-t border-white/[0.05] py-1.5 text-sm text-white/85 first:border-t-0 hover:text-red-300"
            >
              <span className="mt-0.5 shrink-0 rounded bg-[#191922] px-1.5 py-0.5 text-[10px] text-white/60">
                {fmtViews(v.views)}
              </span>
              <span className="flex-1">
                {v.titulo}
                <span className="block text-[11px] text-white/35">{v.canal}</span>
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
      className="rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ background: nuevo ? '#4ade80' : '#3a5bd8', color: nuevo ? '#04210f' : '#fff' }}
    >
      {nuevo ? 'NUEVO' : 'SUBE'}
    </span>
  )
}

function Lista({ filas, max }: { filas: Fila[]; max: number }) {
  if (filas.length === 0) return <p className="text-xs italic text-white/35">nada por ahora</p>
  return (
    <div className="flex flex-col">
      {filas.slice(0, max).map((f) => (
        <a
          key={f.consulta}
          href={`https://www.google.com/search?q=${encodeURIComponent(f.consulta)}`}
          target="_blank"
          rel="noopener"
          className="flex items-center gap-2 border-t border-white/[0.05] py-1.5 text-sm text-white/85 first:border-t-0 hover:text-emerald-300"
        >
          <span className="flex-1">{f.consulta}</span>
          <Badge estado={f.estado} />
          <span className="text-[11px] text-white/30">x{f.score}</span>
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
      className="rounded-2xl border bg-[#0e0e16] p-5"
      style={{ borderColor: acento ? acento + '55' : 'rgba(255,255,255,0.06)' }}
    >
      <h2 className="text-sm font-semibold" style={{ color: acento ?? '#e8eaed' }}>{titulo}</h2>
      <p className="mb-3 text-[11px] text-white/40">{sub}</p>
      <Lista filas={filas} max={max} />
    </section>
  )
}

export default async function RadarPage() {
  const { a, fecha, yt } = await cargar()
  const total = a.emergentes.length + a.contenido.length + a.compra.length + yt.length

  return (
    <div className="fx-holo fx-charts relative isolate min-h-screen bg-[#0a0a12] text-white max-lg:pt-14 lg:pl-[256px]">
      <SidebarNav />
      <FondoHolografico />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">🌱 Radar de Tendencias</h1>
            <a href="/dashboard" className="text-xs text-white/40 hover:text-white/70">← Volver al dashboard</a>
          </div>
          <div className="text-right text-[11px] text-white/40">
            {fecha ? <>Snapshot {fecha}</> : 'Sin datos aún'}
          </div>
        </div>

        <p className="mb-5 max-w-2xl text-xs text-white/40">
          Lo que tu público realmente busca sobre tus temas (autocultivo, gírgolas, adaptógenos…),
          filtrado a Argentina. No son noticias del día: son ideas de contenido con demanda real y
          durabilidad. <span className="text-emerald-300/80">Emergentes</span> = lo que empezó a
          subir respecto de ayer.
        </p>

        {total === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-[#0e0e16] p-6 text-sm text-white/60">
            Todavía no hay snapshot. El radar corre cada mañana (cron diario). Volvé mañana
            o disparalo manualmente desde <code className="text-white/80">/api/cron/radar</code>.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card
              titulo="🚀 Emergentes"
              sub="Nuevo o subiendo vs. ayer — lo caliente del nicho"
              filas={a.emergentes}
              max={30}
              acento="#4ade80"
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
      </div>
    </div>
  )
}
