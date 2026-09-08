'use client'

import { useCallback, useEffect, useState } from 'react'
import { ShoppingCart, Megaphone, Truck, Calculator, Target, TriangleAlert } from 'lucide-react'
import { PanelShell } from '@/components/PanelShell'
import { RailOperacion } from '@/components/operacion/Rail'
import {
  Tarjeta, Kpi, Medidor, Encabezado, Aviso,
  DOMINIO, TONO, ars, dec, num, type EstadoTarjeta,
} from '@/components/operacion/ui'
import { EYEBROW } from '@/components/widgets/ui'

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
  rango: '24h' | '7d' | '30d'
  periodo: { since: string; until: string }
  ventasTN: number
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
  envios: { frenados: number; enTransito: number; sinDespachar: number; promedioDias: number | null }
  sinFuente: Record<string, string>
  error?: string
}

const RANGOS = [
  ['24h', '24 h'],
  ['7d', '7 días'],
  ['30d', '30 días'],
] as const

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
  const [rango, setRango] = useState<'24h' | '7d' | '30d'>('7d')
  const [datos, setDatos] = useState<Resumen | null>(null)
  const [cargando, setCargando] = useState(true)
  const [fallo, setFallo] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vivo = true
    void (async () => {
      try {
        const res = await fetch(`/api/operacion/resumen?rango=${rango}`)
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

  const cambiarRango = useCallback((r: '24h' | '7d' | '30d') => {
    setCargando(true)
    setRango(r)
  }, [])

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

  return (
    <PanelShell
      titulo="Operación · Resumen"
      sub={d ? `${d.periodo.since} al ${d.periodo.until}` : 'Cargando período'}
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

      <div className="flex flex-wrap gap-2" role="group" aria-label="Rango">
        {RANGOS.map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => cambiarRango(k)}
            aria-pressed={rango === k}
            className={`h-10 rounded-full border px-4 text-[13px] font-medium ${
              rango === k
                ? 'border-[var(--pnl-track)] bg-[var(--pnl-panel-2)] text-[var(--pnl-text)]'
                : 'border-[var(--pnl-hair)] text-[var(--pnl-text-3)] hover:text-[var(--pnl-text-2)]'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {d && d.envios.frenados > 0 && (
        <Aviso
          tono="crit"
          mensaje={`${d.envios.frenados} ${d.envios.frenados === 1 ? 'envío lleva' : 'envíos llevan'} 8 días o más sin entregar`}
          accion={
            <a href="/operacion/logistica" className="text-[13px] underline underline-offset-4">
              Ver logística
            </a>
          }
        />
      )}

      {d && !d.metaOk && (
        <Aviso tono="warn" mensaje="No se pudo leer el gasto de Meta Ads: el CAC y el retorno de abajo quedan sin calcular. No es un cero, es un dato que falta." />
      )}

      <Encabezado
        titulo="Qué está pasando ahora"
        nota={RANGOS.find(r => r[0] === rango)?.[1]}
        bajada="Cada tarjeta lleva a su pantalla, donde el mismo dato aparece con su derivación completa. Lo que todavía no tiene fuente se lista al final con el motivo, en vez de aparecer como un número."
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores">
        <Kpi
          dominio="web" icono={<ShoppingCart className="size-4" />}
          valor={d ? ars(d.ventasTN) : '—'}
          etiqueta="Ventas en Tiendanube"
          pie={d ? `${num(d.pedidos)} pedidos pagos` : undefined}
          delta={vVentas.texto} deltaTono={vVentas.tono}
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
          valor={d ? num(d.envios.enTransito + d.envios.sinDespachar) : '—'} unidad="envíos"
          etiqueta="Abiertos: en tránsito o sin despachar"
          pie={d ? `${num(d.envios.frenados)} frenados` : undefined}
          delta={d?.envios.frenados ? 'atender hoy' : undefined} deltaTono="crit"
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
          estado={estadoBase}
          error={fallo}
          onReintentar={recargar}
        >
          {d && (
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
                href="/operacion/logistica"
                className="flex h-11 items-center justify-center rounded-md border border-[var(--pnl-hair)] bg-[var(--pnl-panel-2)] text-[13px] font-semibold text-[var(--pnl-text-2)] hover:text-[var(--pnl-text)]"
              >
                Ver logística
              </a>
            </>
          )}
        </Tarjeta>
      </div>

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
