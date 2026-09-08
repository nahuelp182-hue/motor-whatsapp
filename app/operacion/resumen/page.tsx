'use client'

import { useCallback, useEffect, useState } from 'react'
import { ShoppingCart, Megaphone, Truck, Calculator, Target, TriangleAlert, Store, MousePointerClick } from 'lucide-react'
import { PanelShell } from '@/components/PanelShell'
import { RailOperacion } from '@/components/operacion/Rail'
import {
  Tarjeta, Kpi, Medidor, Encabezado, Aviso,
  DOMINIO, TONO, ars, dec, num, type EstadoTarjeta,
} from '@/components/operacion/ui'
import { EYEBROW } from '@/components/widgets/ui'
import { FiltroMaestro, useRangoMaestro } from '@/components/operacion/FiltroMaestro'
import { type Rango } from '@/lib/operacion/rango'

// Resumen: qué está pasando ahora.
//
// La vista de arranque. Cada tarjeta lleva a su pantalla, donde el mismo dato aparece con
// su derivación completa — el Resumen no calcula nada propio, muestra lo que las secciones
// ya calcularon.
//
// La mitad del panel original todavía no tiene fuente (MercadoLibre, stock, MercadoPago,
// conversión web). Esa mitad se lista al final, con el motivo de cada una: es más útil
// saber qué falta y por qué que ver una tarjeta con un número inventado.

type Resumen = {
  rango: Rango
  etiqueta: string
  periodo: { since: string; until: string }
  ventasTN: number
  ventasTotales: number | null
  ml: {
    ventas: number; pedidos: number; ticket: number | null
    ventasPrev: number; pedidosPrev: number
    porCanal: Array<{ canal: string; ventas: number; pedidos: number }>
    reputacion: { nivel: string; completadas: number; canceladas: number; reclamos: number | null; demoras: number | null; leido: string } | null
    corte: string | null; fresco: boolean
  }
  web: {
    ga4: { ok: boolean; sesiones: number; usuarios: number; comprasGa4: number; motivo: string | null }
    conversion: number | null
  }
  pedidos: number
  ticket: number | null
  varVentas: number | null
  varPedidos: number | null
  gastoMeta: number
  metaOk: boolean
  cacBruto: number | null
  retorno: number | null
  margenPorPedido: number
  techoCac: number
  envios: {
    frenados: number; enTransito: number; sinDespachar: number; promedioDias: number | null
    corte: string | null; fresco: boolean; horasDesdeCorte: number | null
  }
  sinFuente: Record<string, string>
  error?: string
}


/** Una variación se muestra con su signo y su color; si no hay base con qué comparar, no se muestra. */
function delta(v: number | null, invertir = false) {
  if (v === null) return { texto: undefined, tono: 'neutro' as const }
  const bueno = invertir ? v <= 0 : v >= 0
  return {
    texto: `${v >= 0 ? '▲' : '▼'} ${dec(Math.abs(v))} % vs período previo`,
    tono: bueno ? ('ok' as const) : ('crit' as const),
  }
}

export default function ResumenPage() {
  const { rango, aplicar } = useRangoMaestro()
  const [datos, setDatos] = useState<Resumen | null>(null)
  const [cargando, setCargando] = useState(true)
  const [fallo, setFallo] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    // Se espera a tener rango: el hook devuelve null en el primer render (en el servidor no
    // hay URL que leer), y pedir con el default para después repetir con el real sería
    // hacer dos veces una consulta que sale a Tiendanube, Meta y GA4.
    if (!rango) return
    let vivo = true
    setCargando(true)
    void (async () => {
      try {
        const res = await fetch(`/api/operacion/resumen?desde=${rango.desde}&hasta=${rango.hasta}`)
        const j = (await res.json()) as Resumen
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

  const recargar = useCallback(() => {
    setCargando(true)
    setRecarga(n => n + 1)
  }, [])

  // Un fallo SOLO vacía la pantalla cuando no hay nada previo que mostrar. Si ya había
  // datos, se conservan y el fallo se avisa arriba: el último dato bueno con su hora es más
  // útil que una pantalla en blanco, que es exactamente lo que dice hacer lib/operacion.
  const estadoBase: EstadoTarjeta = cargando && !datos ? 'cargando' : fallo && !datos ? 'error' : 'normal'
  const d = datos
  const vVentas = delta(d?.varVentas ?? null)
  const vPedidos = delta(d?.varPedidos ?? null)
  // Los links internos llevan el rango, igual que los del Rail: pasar de una pantalla a otra
  // por un botón de la propia pantalla no puede resetear el filtro.
  const hrefLogistica = rango
    ? `/operacion/logistica?desde=${rango.desde}&hasta=${rango.hasta}`
    : '/operacion/logistica'
  const vMl = delta(
    d && d.ml.fresco && d.ml.ventasPrev ? ((d.ml.ventas - d.ml.ventasPrev) / d.ml.ventasPrev) * 100 : null,
  )

  return (
    <PanelShell
      titulo="Operación · Resumen"
      sub={d ? d.etiqueta : 'Cargando período'}
      accion={
        <button
          type="button"
          onClick={recargar}
          disabled={cargando}
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

      <FiltroMaestro rango={rango} onCambio={aplicar} />


      {d && d.envios.fresco && d.envios.frenados > 0 && (
        <Aviso
          tono="crit"
          mensaje={`${d.envios.frenados} ${d.envios.frenados === 1 ? 'envío lleva' : 'envíos llevan'} 8 días o más sin entregar`}
          accion={
            <a href={hrefLogistica} className="text-[13px] underline underline-offset-4">
              Ver logística
            </a>
          }
        />
      )}

      {d && !d.envios.fresco && (
        <Aviso
          tono="warn"
          mensaje={
            d.envios.corte
              ? `Los envíos no se actualizan desde hace ${dec(d.envios.horasDesdeCorte ?? 0)} h. Los números de logística son de esa hora, no de ahora.`
              : 'Nunca se guardó el estado de los envíos. Logística no muestra ceros: no tiene con qué contar.'
          }
        />
      )}

      {d && !d.metaOk && (
        <Aviso tono="warn" mensaje="No se pudo leer el gasto de Meta Ads: el CAC y el retorno de abajo quedan sin calcular. No es un cero, es un dato que falta." />
      )}

      <Encabezado
        titulo="Qué está pasando ahora"
        nota={d?.etiqueta}
        bajada="Cada tarjeta lleva a su pantalla, donde el mismo dato aparece con su derivación completa. Lo que todavía no tiene fuente se lista al final con el motivo, en vez de aparecer como un número."
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Indicadores">
        <Kpi
          dominio="web" icono={<ShoppingCart className="size-4" />}
          // Con el push de ML caído se muestra Tiendanube y se dice que es solo Tiendanube.
          // Presentar TN como si fuera el total sería el mismo cero mentiroso de siempre,
          // disfrazado de suma.
          valor={d ? ars(d.ventasTotales ?? d.ventasTN) : '—'}
          etiqueta={d && d.ventasTotales === null ? 'Ventas en Tiendanube (falta ML)' : 'Ventas totales'}
          pie={d ? (d.ventasTotales !== null ? `TN ${ars(d.ventasTN)} · ML ${ars(d.ml.ventas)}` : `${num(d.pedidos)} pedidos pagos`) : undefined}
          delta={vVentas.texto} deltaTono={vVentas.tono}
        />
        <Kpi
          dominio="crm" icono={<Store className="size-4" />}
          valor={d && d.ml.fresco ? ars(d.ml.ventas) : '—'}
          etiqueta="Ventas en MercadoLibre"
          pie={d ? (d.ml.fresco ? `${num(d.ml.pedidos)} pedidos · ${d.ml.reputacion?.nivel ?? 'reputación sin leer'}` : 'el VPS no empujó datos') : undefined}
          delta={vMl.texto} deltaTono={vMl.tono}
        />
        <Kpi
          dominio="web" icono={<MousePointerClick className="size-4" />}
          valor={d?.web.conversion != null ? `${dec(d.web.conversion)} %` : '—'}
          etiqueta="Conversión web"
          // Se rotula de dónde sale cada mitad: es una tasa que mezcla dos fuentes a
          // propósito, y sin el rótulo alguien la va a comparar contra la de GA4 y no va a dar.
          pie={d ? (d.web.conversion != null ? `${num(d.web.ga4.sesiones)} sesiones GA4 · ${num(d.pedidos)} pedidos TN` : 'sin sesiones de GA4') : undefined}
        />
        <Kpi
          dominio="web" icono={<Calculator className="size-4" />}
          valor={d?.ticket != null ? ars(d.ticket) : '—'}
          etiqueta="Ticket promedio"
          pie={d ? `${num(d.pedidos)} pedidos en el período` : undefined}
          delta={vPedidos.texto} deltaTono={vPedidos.tono}
        />
        <Kpi
          dominio="crm" icono={<Megaphone className="size-4" />}
          valor={d && d.metaOk ? ars(d.gastoMeta) : '—'}
          etiqueta="Gasto en Meta Ads"
          pie={d && !d.metaOk ? 'no se pudo leer' : 'del mismo período'}
        />
        <Kpi
          dominio="log" icono={<Truck className="size-4" />}
          valor={d && d.envios.fresco ? num(d.envios.enTransito + d.envios.sinDespachar) : '—'}
          unidad={d && d.envios.fresco ? 'envíos' : undefined}
          etiqueta="Abiertos: en tránsito o sin despachar"
          // Sin corte fresco el cero no significa "no hay envíos abiertos", significa que
          // nadie los contó. Mostrarlo como 0 es afirmar que la operación está limpia.
          pie={d ? (d.envios.fresco ? `${num(d.envios.frenados)} frenados` : 'sin dato fresco') : undefined}
          delta={d?.envios.fresco && d.envios.frenados ? 'atender hoy' : undefined} deltaTono="crit"
        />
      </section>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Tarjeta
          dominio="crm" icono={<Target className="size-3.5" />}
          titulo="¿La plata que entra, vuelve?"
          sub="Con el gasto de Meta y los pedidos del período. No es el CAC incremental: es el piso honesto que se puede calcular sin holdout."
          estado={estadoBase === 'normal' && (!d || d.cacBruto === null) ? 'sin_fuente' : estadoBase}
          falta="Hace falta gasto de Meta y pedidos en el mismo período. Con la cuenta pausada o sin pedidos, el cociente no existe — y mostrarlo como cero diría que adquirir sale gratis."
          error={fallo}
          onReintentar={recargar}
        >
          {d?.cacBruto != null && (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[
                  { n: ars(d.cacBruto), l: 'Costo por pedido (gasto ÷ pedidos)', c: d.cacBruto > d.techoCac ? TONO.crit : TONO.ok },
                  { n: d.retorno != null ? `${dec(d.retorno)}x` : '—', l: 'Retorno sobre ese costo', c: TONO.ok },
                  { n: ars(d.margenPorPedido), l: 'Margen por pedido (mix 60/40)', c: 'var(--pnl-text)' },
                ].map(b => (
                  <div key={b.l} className="flex flex-col gap-1 rounded-md border border-[var(--pnl-hair)] bg-[var(--pnl-panel-2)] p-3">
                    <span className="num text-xl font-bold leading-tight" style={{ color: b.c }}>{b.n}</span>
                    <span className="text-[11px] leading-snug text-[var(--pnl-text-3)]">{b.l}</span>
                  </div>
                ))}
              </div>
              <Medidor
                etiqueta={`Contra el techo de ${ars(d.techoCac)}`}
                valor={ars(d.cacBruto)}
                pct={(d.cacBruto / d.techoCac) * 100}
                color={d.cacBruto > d.techoCac ? 'var(--pnl-red)' : DOMINIO.crm.color}
                marca={100}
              />
              <p className="text-xs leading-relaxed text-[var(--pnl-text-3)]">
                Divide TODO el gasto de Meta por TODOS los pedidos, vengan de donde vengan: sobreestima
                lo que cuesta un cliente de Meta y subestima el efecto de la pauta sobre el orgánico.
                El número que decide es el incremental, y para eso hacen falta días de holdout.
              </p>
            </>
          )}
        </Tarjeta>

        <Tarjeta
          dominio="log" icono={<Truck className="size-3.5" />}
          titulo="Logística de un vistazo"
          sub="El detalle, los umbrales y el histórico están en su pantalla."
          estado={estadoBase === 'normal' && d && !d.envios.fresco ? 'sin_fuente' : estadoBase}
          falta="El cron que guarda el estado de cada envío no dejó un corte reciente. Los conteos existen pero serían de otro momento, y no hay forma de distinguirlos de la operación de hoy."
          error={fallo}
          onReintentar={recargar}
        >
          {d && d.envios.fresco && (
            <>
              <div className="flex flex-col gap-2">
                {[
                  { k: 'Frenados (8 días o más)', v: num(d.envios.frenados), c: d.envios.frenados ? TONO.crit : TONO.neutro },
                  { k: 'En tránsito', v: num(d.envios.enTransito), c: 'var(--pnl-text)' },
                  { k: 'Pagados sin despachar', v: num(d.envios.sinDespachar), c: d.envios.sinDespachar ? TONO.warn : TONO.neutro },
                  { k: 'Promedio a destino', v: d.envios.promedioDias != null ? `${dec(d.envios.promedioDias)} d` : 'sin medir', c: 'var(--pnl-text)' },
                ].map(f => (
                  <div key={f.k} className="flex items-center gap-3 text-[13px]">
                    <span className="text-[var(--pnl-text-2)]">{f.k}</span>
                    <span className="num ml-auto font-semibold" style={{ color: f.c }}>{f.v}</span>
                  </div>
                ))}
              </div>
              <a
                href={hrefLogistica}
                className="flex h-11 items-center justify-center rounded-md border border-[var(--pnl-hair)] bg-[var(--pnl-panel-2)] text-[13px] font-semibold text-[var(--pnl-text-2)] hover:text-[var(--pnl-text)]"
              >
                Ver logística
              </a>
            </>
          )}
        </Tarjeta>
      </div>

      <Tarjeta
        dominio="crm" icono={<Store className="size-3.5" />}
        titulo="MercadoLibre"
        sub="MICELIUMSTORE. Lo empuja el VPS, que es el dueño único del token: Vercel no puede consultar la API sin invalidarlo."
        estado={estadoBase === 'normal' && d && !d.ml.fresco ? 'sin_fuente' : estadoBase}
        falta="El cron del VPS no empujó ventas ni reputación. Sin eso no se sabe si no hubo ventas o si nadie preguntó, y la apicultura es estacional: en temporada baja las dos cosas se ven igual."
        error={fallo}
        onReintentar={recargar}
      >
        {d && d.ml.fresco && (
          <>
            <div className="flex flex-col gap-2">
              {d.ml.porCanal.map(c => (
                <div key={c.canal} className="flex items-center gap-3 text-[13px]">
                  <span className="capitalize text-[var(--pnl-text-2)]">{c.canal}</span>
                  <span className="text-[11px] text-[var(--pnl-text-3)]">{num(c.pedidos)} ped.</span>
                  <span className="num ml-auto font-semibold text-[var(--pnl-text)]">{ars(c.ventas)}</span>
                </div>
              ))}
              {d.ml.porCanal.length === 0 && (
                <p className="text-[13px] text-[var(--pnl-text-3)]">
                  Sin ventas en el período. El dato es fresco: se consultó y no hubo. La apicultura
                  factura de octubre a enero, así que fuera de esa ventana esto es lo esperado.
                </p>
              )}
            </div>
            {d.ml.reputacion && (
              <div className="flex flex-col gap-1 rounded-md border border-[var(--pnl-hair)] bg-[var(--pnl-panel-2)] p-3">
                <span className="num text-lg font-bold" style={{ color: d.ml.reputacion.nivel.includes('green') ? TONO.ok : TONO.warn }}>
                  {d.ml.reputacion.nivel}
                </span>
                <span className="text-[11px] leading-snug text-[var(--pnl-text-3)]">
                  {num(d.ml.reputacion.completadas)} completadas · {num(d.ml.reputacion.canceladas)} canceladas
                </span>
              </div>
            )}
          </>
        )}
      </Tarjeta>

      <Tarjeta
        dominio="prod" icono={<TriangleAlert className="size-3.5" />}
        titulo="Lo que este panel todavía no puede mostrar"
        sub="Y por qué. La lista se achica sola a medida que cada fuente entra."
        estado="normal"
      >
        <div className="flex flex-col gap-3">
          {Object.entries(d?.sinFuente ?? {}).map(([que, porque]) => (
            <div key={que} className="flex flex-col gap-1 rounded-md border border-dashed border-[var(--pnl-hair)] p-3">
              <span className={EYEBROW}>{que}</span>
              <p className="text-[13px] leading-relaxed text-[var(--pnl-text-2)]">{porque}</p>
            </div>
          ))}
        </div>
      </Tarjeta>
    </PanelShell>
  )
}
