'use client'

import { useCallback, useEffect, useState } from 'react'
import { Wallet, CircleCheck, Hourglass, TrendingUp, RefreshCw, ArrowLeftRight } from 'lucide-react'
import { PanelShell } from '@/components/PanelShell'
import { RailOperacion } from '@/components/operacion/Rail'
import { FiltroMaestro, useRangoMaestro } from '@/components/operacion/FiltroMaestro'
import {
  Tarjeta, Kpi, Medidor, Pastilla, Encabezado, Aviso,
  DOMINIO, TONO, ars, dec, type EstadoTarjeta,
} from '@/components/operacion/ui'

// Caja.
//
// La distinción que sostiene la pantalla: cobrado ≠ disponible. MercadoPago retiene una
// parte del neto, así que el número grande de "vendimos tanto" no es plata en mano. Liberado
// y pendiente van siempre separados, nunca sumados en un solo indicador.

type LineaCaja = { nombre: string; bruto: number; neto: number; liberado: number; pendiente: number }
type Corte = {
  id: string; desde: string; hasta: string
  bruto: number; neto: number; liberado: number; pendiente: number
  lineas: LineaCaja[]
}
type Caja = {
  actual: Corte | null
  previo: Corte | null
  cortes: Corte[]
  etiqueta: string
  fueraDelRango: number
  comparacion: Array<{ concepto: string; actual: number; previo: number; variacion: number }>
  comisiones: number | null
  ciclo: { inventario: number | null; cobro: number; pago: number; total: number | null }
  retencionDias: number
  error?: string
}

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'long' })

const COLOR_LINEA = [DOMINIO.web.color, DOMINIO.ml.color, 'var(--pnl-text-3)']

export default function CajaPage() {
  const { rango, aplicar } = useRangoMaestro()
  const [datos, setDatos] = useState<Caja | null>(null)
  const [cargando, setCargando] = useState(true)
  const [fallo, setFallo] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    if (!rango) return
    let vivo = true
    setCargando(true)
    void (async () => {
      try {
        const res = await fetch(`/api/operacion/caja?desde=${rango.desde}&hasta=${rango.hasta}`)
        const j = (await res.json()) as Caja
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
  const a = d?.actual
  const sinCorte = estadoBase === 'normal' && !a

  const FALTA_CORTE =
    'Todavía no llegó ningún corte. Lo calcula el script del VPS (tiene los tokens de MercadoPago que Vercel no tiene) y lo empuja a POST /api/operacion/caja con el CRON_SECRET. Hasta que ese cron corra, esta pantalla no tiene nada real que mostrar — y un corte inventado sería exactamente el número que después se usa para decidir si alcanza la plata.'

  return (
    <PanelShell
      titulo="Operación · Caja"
      sub={a ? `Quincena ${fecha(a.desde)} al ${fecha(a.hasta)}` : 'Sin cortes cargados'}
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

      <FiltroMaestro
        rango={rango}
        onCambio={aplicar}
        nota="El corte de caja es quincenal: lo calcula el VPS, que tiene los tokens de MercadoPago. El rango elige qué quincenas se listan, no parte una por la mitad — un corte parcial sería plata que nadie calculó."
      />

      {fallo && datos && (
        <Aviso tono="warn" mensaje={`No se pudo actualizar: ${fallo}. Lo de abajo es el último dato bueno.`} />
      )}

      <Encabezado
        titulo="¿Estamos donde queríamos?"
        nota={a ? `${fecha(a.desde)} al ${fecha(a.hasta)}` : undefined}
        bajada="Las líneas son las del corte quincenal que ya corre en el VPS. Cobrado no es lo mismo que disponible: MercadoPago retiene una parte y la libera después."
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores de caja">
        <Kpi
          dominio="web" icono={<Wallet className="size-4" />}
          valor={a ? ars(a.neto) : '—'}
          etiqueta="Neto cobrado en la quincena"
          pie={a ? `bruto ${ars(a.bruto)}` : 'sin corte'}
        />
        <Kpi
          dominio="prod" icono={<CircleCheck className="size-4" />}
          valor={a ? ars(a.liberado) : '—'}
          etiqueta="Disponible para usar hoy"
          pie={a && a.neto ? `${dec((a.liberado / a.neto) * 100)} % del neto` : undefined}
        />
        <Kpi
          dominio="ml" icono={<Hourglass className="size-4" />}
          valor={a ? ars(a.pendiente) : '—'}
          etiqueta="Retenido por MercadoPago"
          pie={d ? `se libera en ${d.retencionDias} días` : undefined}
        />
        <Kpi
          dominio="prod" icono={<TrendingUp className="size-4" />}
          valor={d?.comisiones != null ? dec(d.comisiones * 100) : '—'} unidad="%"
          etiqueta="Comisiones de MercadoPago y Tiendanube"
          pie="lo que separa el bruto del neto"
        />
      </section>

      <Tarjeta
        dominio="web" icono={<Wallet className="size-3.5" />}
        titulo="Las líneas del corte"
        sub="Liberado + pendiente = neto, en cada fila y en el total. Si no cerrara, el corte se rechaza al entrar."
        estado={sinCorte ? 'sin_fuente' : estadoBase}
        falta={FALTA_CORTE}
        error={fallo}
        onReintentar={recargar}
      >
        {a && (
          <>
            <div className="overflow-x-auto rounded-md border border-[var(--pnl-hair)]">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    {['Línea', 'Bruto', 'Neto', 'Liberado', 'Pendiente'].map((t, i) => (
                      <th key={t} scope="col" className={`whitespace-nowrap border-b border-[var(--pnl-hair)] bg-[var(--pnl-panel-2)] px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-[var(--pnl-text-3)] ${i ? 'text-right' : 'text-left'}`}>
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-[var(--pnl-panel-2)] font-bold">
                    <td className="whitespace-nowrap border-b border-[var(--pnl-hair)] px-3 py-2.5">Total quincena</td>
                    {[a.bruto, a.neto, a.liberado, a.pendiente].map((v, i) => (
                      <td key={i} className="num whitespace-nowrap border-b border-[var(--pnl-hair)] px-3 py-2.5 text-right">{ars(v)}</td>
                    ))}
                  </tr>
                  {a.lineas.map((l, i) => (
                    <tr key={l.nombre}>
                      <td className="whitespace-nowrap border-b border-[var(--pnl-hair)] px-3 py-2.5">
                        <span className="mr-2 inline-block size-2 rounded-sm" style={{ background: COLOR_LINEA[i % COLOR_LINEA.length] }} aria-hidden />
                        {l.nombre}
                      </td>
                      {[l.bruto, l.neto, l.liberado, l.pendiente].map((v, j) => (
                        <td key={j} className="num whitespace-nowrap border-b border-[var(--pnl-hair)] px-3 py-2.5 text-right">{ars(v)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs leading-relaxed text-[var(--pnl-text-3)]">
              La diferencia entre bruto y neto son las comisiones de MercadoPago y Tiendanube.
            </p>
          </>
        )}
      </Tarjeta>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Tarjeta
          dominio="prod" icono={<RefreshCw className="size-3.5" />}
          titulo="Ciclo de conversión de efectivo"
          sub="Cuántos días pasan entre que sale la plata para fabricar y entra la del cliente. Si da negativo, el proveedor financia la operación."
          estado={estadoBase === 'normal' && d?.ciclo.total == null ? 'sin_fuente' : estadoBase}
          falta="Faltan los días de inventario, que salen de la cobertura de stock: hace falta un conteo cargado en Producción y pedidos con los que calcular el ritmo de venta."
          error={fallo}
          onReintentar={recargar}
        >
          {d?.ciclo.total != null && (
            <>
              <div className="flex items-center gap-2">
                <Pastilla tono={d.ciclo.total < 0 ? 'ok' : 'warn'}>
                  {d.ciclo.total < 0 ? 'negativo' : 'positivo'}
                </Pastilla>
                <span className="text-[13px] text-[var(--pnl-text-2)]">
                  {d.ciclo.total < 0
                    ? `El dinero entra ${dec(Math.abs(d.ciclo.total))} días antes de que haya que pagarlo`
                    : `Hay que poner plata ${dec(d.ciclo.total)} días antes de cobrarla`}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { k: 'Días de inventario', v: dec(d.ciclo.inventario!), n: 'lo que tarda en venderse el stock' },
                  { k: 'Días hasta cobrar', v: dec(d.ciclo.cobro), n: 'retención de MercadoPago' },
                  { k: 'Días para pagar', v: `−${dec(d.ciclo.pago)}`, n: 'plazo con proveedores' },
                ].map(f => (
                  <div key={f.k} className="flex items-start gap-3 text-[13px]">
                    <span className="min-w-0 text-[var(--pnl-text-2)]">
                      {f.k}
                      <span className="block text-[11px] text-[var(--pnl-text-3)]">{f.n}</span>
                    </span>
                    <span className="num ml-auto font-semibold">{f.v}</span>
                  </div>
                ))}
                <div className="flex items-center gap-3 border-t border-[var(--pnl-hair)] pt-2 text-[13px]">
                  <span className="font-semibold">Ciclo de efectivo</span>
                  <span className="num ml-auto font-bold" style={{ color: d.ciclo.total < 0 ? TONO.ok : TONO.warn }}>
                    {dec(d.ciclo.total)} días
                  </span>
                </div>
              </div>
              <p className="text-[13px] leading-relaxed text-[var(--pnl-text-2)]">
                {d.ciclo.total < 0
                  ? 'Crecer no exige poner plata antes: cada venta se cobra antes de que venza el pago de los componentes. El límite para escalar es la demanda y el techo de CAC, no la caja.'
                  : 'Cada venta nueva exige poner plata antes de cobrarla: acá la caja sí es un límite para escalar.'}
              </p>
            </>
          )}
        </Tarjeta>

        <Tarjeta
          dominio="web" icono={<ArrowLeftRight className="size-3.5" />}
          titulo="Contra la quincena anterior"
          sub="Un número solo no dice nada. Contra el período anterior, sí."
          estado={sinCorte ? 'sin_fuente' : estadoBase === 'normal' && d?.comparacion.length === 0 ? 'vacio' : estadoBase}
          vacio="Es el primer corte cargado: todavía no hay una quincena anterior con la que compararlo."
          falta={FALTA_CORTE}
          error={fallo}
          onReintentar={recargar}
        >
          {d && d.comparacion.length > 0 && (
            <>
              <div className="flex flex-col gap-3">
                {d.comparacion.map(c => (
                  <div key={c.concepto} className="flex flex-col gap-1">
                    <div className="flex items-baseline text-[13px]">
                      <span className="text-[var(--pnl-text-2)]">{c.concepto}</span>
                      <span className="num ml-auto font-semibold">
                        {ars(c.actual)}
                        <span className="ml-2 text-[11px]" style={{ color: c.variacion >= 0 ? TONO.ok : TONO.crit }}>
                          {c.variacion >= 0 ? '▲' : '▼'} {dec(Math.abs(c.variacion))} %
                        </span>
                      </span>
                    </div>
                    <span className="num text-[11px] text-[var(--pnl-text-3)]">anterior: {ars(c.previo)}</span>
                  </div>
                ))}
              </div>
              {d.comisiones != null && (
                <Medidor
                  etiqueta="Comisiones sobre el bruto"
                  valor={`${dec(d.comisiones * 100)} %`}
                  pct={d.comisiones * 100 * 5 /* la escala llega a 20%: a escala 0-100 no se vería moverse */}
                  color={DOMINIO.ml.color}
                />
              )}
            </>
          )}
        </Tarjeta>
        <Tarjeta
          dominio="prod" icono={<TrendingUp className="size-3.5" />}
          titulo="Margen bruto de la quincena"
          sub="Objetivo declarado: 60 %."
          estado="sin_fuente"
          falta="El corte trae bruto y neto, pero no el costo de la mercadería vendida, y sin eso no hay margen bruto. Lo que sí sale de esos dos números —neto sobre bruto— son las comisiones (~6 %): compararlas contra el 60 % daba verde siempre, que es un indicador que no puede ponerse en rojo. Se resuelve cuando el corte del VPS mande el costo por línea."
        />
      </div>
    </PanelShell>
  )
}
