'use client'

import { useCallback, useEffect, useState } from 'react'
import { Megaphone, Target, Calculator, TrendingUp, RefreshCw } from 'lucide-react'
import { PanelShell } from '@/components/PanelShell'
import { RailOperacion } from '@/components/operacion/Rail'
import {
  Tarjeta, Kpi, Medidor, Pastilla, Encabezado, Aviso,
  DOMINIO, TONO, ars, dec, num, type EstadoTarjeta, type Tono,
} from '@/components/operacion/ui'
import { EYEBROW } from '@/components/widgets/ui'
import { FiltroMaestro, useRangoMaestro } from '@/components/operacion/FiltroMaestro'

// Adquisición.
//
// La pantalla evita la trampa central del tema: llamar CAC al gasto dividido por los
// pedidos. Ese número mezcla las ventas orgánicas con las de pauta y baja solo cuando
// vende el orgánico, así que premia justo lo que no se está pagando. Acá se muestra
// rotulado como lo que es —un piso— y el incremental queda declarado como pendiente.

type Canal = { key: string; label: string; color: string; orders: number; revenue: number }
type Adset = { id: string; nombre: string; campana: string | null; spend: number; frecuencia: number | null; activo: boolean }
type Escenario = { gastoDia: number; cac: number; ventasMes: number; margenMes: number; estado: string }

type Adquisicion = {
  periodo: { since: string; until: string; dias: number }
  etiqueta: string
  gasto: number
  metaOk: boolean
  pedidos: number
  facturacion: number
  costoPorPedido: number | null
  techoCac: number
  retorno: number | null
  margenPorPedido: number
  ltv: number
  sensibilidadMix: Array<{ mix: number; etiqueta: string; retorno: number | null; actual: boolean }>
  canales: Canal[]
  adsets: Adset[]
  umbralFrecuencia: number
  escenarios: Escenario[]
  elasticidad: number
  error?: string
}

const TONO_ESTADO: Record<string, Tono> = {
  actual: 'neutro', 'en curso': 'ok', 'el techo': 'warn', fuera: 'crit',
}

export default function AdquisicionPage() {
  const { rango, aplicar } = useRangoMaestro()
  const [datos, setDatos] = useState<Adquisicion | null>(null)
  const [cargando, setCargando] = useState(true)
  const [fallo, setFallo] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    if (!rango) return
    let vivo = true
    setCargando(true)
    void (async () => {
      try {
        const res = await fetch(`/api/operacion/adquisicion?desde=${rango.desde}&hasta=${rango.hasta}`)
        const j = (await res.json()) as Adquisicion
        if (!res.ok) throw new Error(j.error ?? `respuesta ${res.status}`)
        if (vivo) { setDatos(j); setFallo(null) }
      } catch (e) {
        if (vivo) setFallo(e instanceof Error ? e.message : 'no se pudo cargar')
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [rango, recarga])

  const recargar = useCallback(() => { setCargando(true); setRecarga(n => n + 1) }, [])

  // Un fallo SOLO vacía la pantalla cuando no hay nada previo que mostrar. Si ya había
  // datos, se conservan y el fallo se avisa arriba: el último dato bueno con su hora es más
  // útil que una pantalla en blanco, que es exactamente lo que dice hacer lib/operacion.
  const estadoBase: EstadoTarjeta = cargando && !datos ? 'cargando' : fallo && !datos ? 'error' : 'normal'
  const d = datos
  const [soloActivos, setSoloActivos] = useState(false)
  const quemados = d?.adsets.filter(a => (a.frecuencia ?? 0) >= d.umbralFrecuencia) ?? []
  const frecMax = d?.adsets.reduce<number | null>((m, a) => (a.frecuencia != null && (m === null || a.frecuencia > m) ? a.frecuencia : m), null) ?? null
  const adsetsVisibles = d ? (soloActivos ? d.adsets.filter(a => a.activo) : d.adsets) : []

  return (
    <PanelShell
      titulo="Operación · Adquisición"
      sub={d ? `${d.periodo.since} al ${d.periodo.until}` : 'Cargando período'}
      accion={
        <button
          type="button" onClick={recargar} disabled={cargando}
          className="h-10 rounded-md border border-[var(--pnl-hair)] bg-[var(--pnl-panel-2)] px-4 text-[13px] font-semibold text-[var(--pnl-text-2)] hover:text-[var(--pnl-text)] disabled:opacity-50"
        >
          {cargando ? 'Actualizando…' : 'Actualizar'}
        </button>
      }
    >
      <RailOperacion />

      {fallo && datos && (
        <Aviso tono="warn" mensaje={`No se pudo actualizar: ${fallo}. Lo de abajo es el último dato bueno.`} />
      )}

      <FiltroMaestro
        rango={rango}
        onCambio={aplicar}
        nota="El gasto diario y la elasticidad se calculan sobre los días del rango. Con ventanas cortas el promedio diario es más ruidoso: un solo día flojo lo mueve mucho."
      />


      {d && !d.metaOk && (
        <Aviso tono="warn" mensaje="No se pudo leer Meta Ads. Lo que depende del gasto queda sin calcular; los pedidos y la atribución de Tiendanube siguen siendo reales." />
      )}
      {quemados.length > 0 && (
        <Aviso
          tono="warn"
          mensaje={`${quemados.length} ${quemados.length === 1 ? 'conjunto pasó' : 'conjuntos pasaron'} la frecuencia ${dec(d!.umbralFrecuencia)}: el mismo público ya vio el anuncio demasiadas veces`}
        />
      )}

      <Encabezado
        titulo="¿La plata que entra, vuelve?"
        nota={d?.etiqueta}
        bajada="Lo que se muestra es lo que se puede sostener con datos: gasto real de Meta, pedidos reales de Tiendanube y frecuencia por conjunto. El CAC incremental —el único que decide si escalar o cortar— necesita días de holdout y todavía no está."
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores">
        <Kpi
          dominio="crm" icono={<Megaphone className="size-4" />}
          valor={d && d.metaOk ? ars(d.gasto) : '—'}
          etiqueta={d ? `Gasto en Meta · ${d.etiqueta}` : 'Gasto en Meta'}
          pie={d && d.metaOk ? `${ars(d.gasto / d.periodo.dias)} por día` : 'no se pudo leer'}
        />
        <Kpi
          dominio="crm" icono={<Target className="size-4" />}
          valor={d?.costoPorPedido != null ? ars(d.costoPorPedido) : '—'}
          etiqueta="Gasto ÷ pedidos (piso, no el CAC)"
          pie={d ? `techo declarado ${ars(d.techoCac)}` : undefined}
          delta={d?.costoPorPedido != null && d.costoPorPedido > d.techoCac ? 'por encima del techo' : undefined}
          deltaTono="crit"
        />
        <Kpi
          dominio="web" icono={<Calculator className="size-4" />}
          valor={d ? num(d.pedidos) : '—'} unidad="pedidos"
          etiqueta="Pedidos pagos en el período"
          pie={d ? `${ars(d.facturacion)} facturados` : undefined}
        />
        <Kpi
          dominio="ml" icono={<RefreshCw className="size-4" />}
          valor={frecMax != null ? dec(frecMax) : '—'} unidad="x"
          etiqueta="Frecuencia máxima por conjunto"
          pie={d ? `umbral de recambio: ${dec(d.umbralFrecuencia)}` : undefined}
          delta={d && frecMax != null && frecMax >= d.umbralFrecuencia ? 'toca recambio creativo' : undefined}
          deltaTono="warn"
        />
      </section>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Tarjeta
          dominio="crm" icono={<Target className="size-3.5" />}
          titulo="El CAC incremental"
          sub="El número que decide si conviene escalar o cortar."
          estado="sin_fuente"
          falta="Se mide comparando las compras de los días con pauta contra el piso orgánico de los días sin pauta (holdout). Hoy no hay ni el registro de qué días estuvo prendida cada campaña ni suficientes días apagada para tener piso. Mientras tanto, el gasto ÷ pedidos de arriba es un techo del costo real, nunca el CAC."
        />

        <Tarjeta
          dominio="web" icono={<Calculator className="size-3.5" />}
          titulo="De dónde vienen los pedidos"
          sub="Clasificación de Tiendanube por lo que capturó al momento del clic (utm, fbclid)."
          estado={estadoBase === 'normal' && d?.canales.length === 0 ? 'vacio' : estadoBase}
          vacio="Sin pedidos pagos en el período."
          error={fallo}
          onReintentar={recargar}
        >
          {d && (
            <>
              <div className="flex flex-col gap-2">
                {d.canales.map(c => (
                  <div key={c.key} className="flex items-center gap-3 text-[13px]">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
                    <span className="min-w-0 truncate text-[var(--pnl-text-2)]">{c.label}</span>
                    <span className="num ml-auto whitespace-nowrap font-semibold">
                      {num(c.orders)} · {ars(c.revenue)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-[var(--pnl-text-3)]">
                Es atribución de último clic con lo que el navegador traía: un cliente que vio el
                anuncio y entró después escribiendo la dirección cae en orgánico. Por eso esto ordena
                canales, no reparte el mérito.
              </p>
            </>
          )}
        </Tarjeta>
      </div>

      <Tarjeta
        dominio="ml" icono={<RefreshCw className="size-3.5" />}
        titulo="Desgaste por conjunto de anuncios"
        sub="La frecuencia avisa antes que el costo: cuando el mismo público ya vio el anuncio demasiadas veces, el CPA sube sin que haya cambiado nada."
        estado={estadoBase === 'normal' && d?.adsets.length === 0 ? 'vacio' : estadoBase}
        vacio="Ningún conjunto con entrega en el período. Con la cuenta pausada esto es lo esperable."
        error={fallo}
        onReintentar={recargar}
      >
        {d && d.adsets.length > 0 && (
          <div className="flex flex-col gap-3">
            <label className="ml-auto flex items-center gap-2 text-xs text-[var(--pnl-text-2)]">
              <input
                type="checkbox"
                checked={soloActivos}
                onChange={e => setSoloActivos(e.target.checked)}
                className="size-3.5 accent-[var(--pnl-green)]"
              />
              Solo activos ahora
            </label>
            {adsetsVisibles.length === 0 && (
              <p className="py-2 text-center text-[13px] text-[var(--pnl-text-3)]">
                Ningún conjunto activo en este momento.
              </p>
            )}
            {adsetsVisibles.map(a => (
              <div key={a.id} className="flex items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{
                    background: a.activo ? 'var(--pnl-green)' : 'var(--pnl-text-3)',
                    boxShadow: a.activo ? '0 0 6px var(--pnl-green)' : undefined,
                  }}
                  title={a.activo ? 'Activo ahora' : 'No activo ahora'}
                  aria-hidden
                />
                <span className="sr-only">{a.activo ? 'Activo ahora' : 'No activo ahora'}</span>
                <div className="min-w-0 flex-1">
                  <Medidor
                    etiqueta={`${a.nombre}${a.campana ? ` · ${a.campana}` : ''} — ${ars(a.spend)}`}
                    valor={a.frecuencia != null ? `${dec(a.frecuencia)}x` : 'sin entrega'}
                    pct={((a.frecuencia ?? 0) / (d.umbralFrecuencia * 1.5)) * 100}
                    color={(a.frecuencia ?? 0) >= d.umbralFrecuencia ? 'var(--pnl-red)' : DOMINIO.ml.color}
                    marca={(1 / 1.5) * 100}
                  />
                </div>
              </div>
            ))}
            <p className="text-xs leading-relaxed text-[var(--pnl-text-3)]">
              La marca vertical es el umbral de {dec(d.umbralFrecuencia)}. Un conjunto recién entregado
              no se juzga por esto: hacen falta 72 h y volumen antes de mover nada. El punto verde es el
              estado de la cuenta ahora mismo, no el del período mostrado arriba.
            </p>
          </div>
        )}
      </Tarjeta>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Tarjeta
          dominio="crm" icono={<Calculator className="size-3.5" />}
          titulo="Unit economics"
          sub="Supuesto declarado: 60% incubadora y 40% apícola. Si el mix cambia, cambia todo lo de abajo."
          estado={estadoBase === 'normal' && d?.costoPorPedido == null ? 'sin_fuente' : estadoBase}
          falta="Sin gasto de Meta o sin pedidos en el período no hay costo por pedido, y sin eso no hay retorno que calcular."
          error={fallo}
          onReintentar={recargar}
        >
          {d?.costoPorPedido != null && (
            <>
              <div className="flex flex-col gap-2">
                {[
                  { k: 'Margen de contribución', v: ars(d.margenPorPedido), n: 'ponderado por el mix' },
                  { k: 'Valor de vida del cliente', v: ars(d.ltv), n: 'margen × 1,049 de recompra' },
                  { k: 'Costo por pedido', v: ars(d.costoPorPedido), n: 'gasto ÷ pedidos, no el incremental' },
                ].map(f => (
                  <div key={f.k} className="flex items-start gap-3 text-[13px]">
                    <span className="min-w-0 text-[var(--pnl-text-2)]">
                      {f.k}
                      <span className="block text-[11px] text-[var(--pnl-text-3)]">{f.n}</span>
                    </span>
                    <span className="num ml-auto whitespace-nowrap font-semibold">{f.v}</span>
                  </div>
                ))}
                <div className="flex items-center gap-3 border-t border-[var(--pnl-hair)] pt-2 text-[13px]">
                  <span className="font-semibold">Retorno</span>
                  <span className="num ml-auto text-base font-bold" style={{ color: TONO.ok }}>
                    {d.retorno != null ? `${dec(d.retorno)}x` : '—'}
                  </span>
                </div>
              </div>

              <p className={EYEBROW}>Qué pasa si el mix no es 60/40</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {d.sensibilidadMix.map(s => (
                  <div
                    key={s.etiqueta}
                    className="flex flex-col items-center gap-1 rounded-md border p-3"
                    style={{
                      borderColor: s.actual ? 'color-mix(in srgb, var(--pnl-green) 45%, transparent)' : 'var(--pnl-hair)',
                      background: s.actual ? 'color-mix(in srgb, var(--pnl-green) 10%, transparent)' : 'var(--pnl-panel-2)',
                    }}
                  >
                    <span className="num text-sm font-bold" style={{ color: s.actual ? TONO.ok : 'var(--pnl-text-2)' }}>
                      {s.retorno != null ? `${dec(s.retorno)}x` : '—'}
                    </span>
                    <span className="num text-[10px] text-[var(--pnl-text-3)]">mix {s.etiqueta}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs leading-relaxed text-[var(--pnl-text-3)]">
                El número cambia mucho según el mix, pero la conclusión no: en todos los escenarios cada
                peso vuelve varias veces. Lo que se mueve es cuánto margen hay para escalar, no si conviene.
              </p>
            </>
          )}
        </Tarjeta>

        <Tarjeta
          dominio="prod" icono={<TrendingUp className="size-3.5" />}
          titulo="¿Cuánto se puede escalar?"
          sub="Escenarios, no una predicción."
          estado={estadoBase === 'normal' && d?.escenarios.length === 0 ? 'sin_fuente' : estadoBase}
          falta="Necesita gasto y pedidos en el mismo período para tener un punto de partida desde el cual proyectar."
          error={fallo}
          onReintentar={recargar}
        >
          {d && d.escenarios.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-md border border-[var(--pnl-hair)]">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr>
                      {['Gasto diario', 'CAC estimado', 'Ventas / mes', 'Margen / mes', 'Estado'].map((t, i) => (
                        <th key={t} scope="col" className={`whitespace-nowrap border-b border-[var(--pnl-hair)] bg-[var(--pnl-panel-2)] px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-[var(--pnl-text-3)] ${i > 0 && i < 4 ? 'text-right' : 'text-left'}`}>
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.escenarios.map(e => (
                      <tr key={e.gastoDia}>
                        <td className="num whitespace-nowrap border-b border-[var(--pnl-hair)] px-3 py-2.5">{ars(e.gastoDia)}</td>
                        <td className="num whitespace-nowrap border-b border-[var(--pnl-hair)] px-3 py-2.5 text-right" style={{ color: TONO[TONO_ESTADO[e.estado] ?? 'neutro'] }}>{ars(e.cac)}</td>
                        <td className="num whitespace-nowrap border-b border-[var(--pnl-hair)] px-3 py-2.5 text-right">{dec(e.ventasMes)}</td>
                        <td className="num whitespace-nowrap border-b border-[var(--pnl-hair)] px-3 py-2.5 text-right">{ars(e.margenMes)}</td>
                        <td className="whitespace-nowrap border-b border-[var(--pnl-hair)] px-3 py-2.5">
                          <Pastilla tono={TONO_ESTADO[e.estado] ?? 'neutro'}>{e.estado}</Pastilla>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: TONO.warn }}>
                La curva de CAC NO está medida: se asume que sube {dec(d.elasticidad * 100)} % cada vez que
                se duplica el gasto diario, porque los públicos baratos se agotan primero. Hasta tener dos
                tramos de gasto sostenidos, las filas de abajo son una hipótesis y no una promesa.
              </p>
            </>
          )}
        </Tarjeta>
      </div>
    </PanelShell>
  )
}
