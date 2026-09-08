'use client'

import { useCallback, useEffect, useState } from 'react'
import { Package, Factory, Gauge, ClipboardList } from 'lucide-react'
import { PanelShell } from '@/components/PanelShell'
import { RailOperacion } from '@/components/operacion/Rail'
import { FiltroMaestro, useRangoMaestro } from '@/components/operacion/FiltroMaestro'
import {
  Tarjeta, Kpi, Medidor, Encabezado, Aviso,
  DOMINIO, TONO, ars, dec, num, type EstadoTarjeta,
} from '@/components/operacion/ui'
import { INPUT, LABEL, EYEBROW } from '@/components/widgets/ui'

// Producción.
//
// Única pantalla que pide datos: el stock se cuenta a mano. Por eso el formulario está
// arriba de todo y no escondido en un menú — si cargarlo cuesta, no se carga, y todo lo
// que se deriva del conteo queda mintiendo en silencio.

/** A partir de acá el conteo deja de servir para decidir y la pantalla lo dice. */
const CONTEO_VIEJO = 7

type Produccion = {
  conteo: { unidades: number; fecha: string; nota: string | null; antiguedadDias: number } | null
  ritmoDiario: number | null
  pedidos: number
  ventanaDias: number
  etiqueta: string
  coberturaDias: number | null
  puntoReposicion: number | null
  quiebre: string | null
  capacidad: number
  costoUnitario: number
  leadTime: number
  margenUnitario: number
  ociosa: number | null
  margenOcioso: number | null
  error?: string
}

const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

export default function ProduccionPage() {
  const { rango, aplicar } = useRangoMaestro()
  const [datos, setDatos] = useState<Produccion | null>(null)
  const [cargando, setCargando] = useState(true)
  const [fallo, setFallo] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)

  const [unidades, setUnidades] = useState('')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [avisoForm, setAvisoForm] = useState<string | null>(null)

  useEffect(() => {
    if (!rango) return
    let vivo = true
    setCargando(true)
    void (async () => {
      try {
        const res = await fetch(`/api/operacion/produccion?desde=${rango.desde}&hasta=${rango.hasta}`)
        const j = (await res.json()) as Produccion
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

  const guardar = useCallback(async () => {
    const n = Number(unidades)
    if (!Number.isInteger(n) || n < 0) {
      setAvisoForm('Poné un número entero de unidades.')
      return
    }
    setGuardando(true)
    setAvisoForm(null)
    try {
      const res = await fetch(`/api/operacion/produccion?desde=${rango?.desde}&hasta=${rango?.hasta}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unidades: n, nota: nota || undefined }),
      })
      const j = (await res.json()) as Produccion
      if (!res.ok) throw new Error(j.error ?? `respuesta ${res.status}`)
      setDatos(j)
      setUnidades('')
      setNota('')
      setAvisoForm('Conteo guardado.')
    } catch (e) {
      setAvisoForm(e instanceof Error ? e.message : 'no se pudo guardar')
    } finally {
      setGuardando(false)
    }
  }, [unidades, nota])

  // Un fallo SOLO vacía la pantalla cuando no hay nada previo que mostrar. Si ya había
  // datos, se conservan y el fallo se avisa arriba: el último dato bueno con su hora es más
  // útil que una pantalla en blanco, que es exactamente lo que dice hacer lib/operacion.
  const estadoBase: EstadoTarjeta = cargando && !datos ? 'cargando' : fallo && !datos ? 'error' : 'normal'
  const d = datos
  const viejo = d?.conteo && d.conteo.antiguedadDias >= CONTEO_VIEJO
  const urgente = d?.coberturaDias != null && d.coberturaDias <= d.leadTime

  return (
    <PanelShell
      titulo="Operación · Producción"
      sub={d?.conteo ? `Último conteo: ${fechaLarga(d.conteo.fecha)}` : 'Sin conteos cargados'}
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
        nota="El ritmo de venta se calcula sobre los días del rango, y de él salen la cobertura, el punto de reposición y la fecha de quiebre. Con ventanas cortas el ritmo es ruidoso: una semana sin pedidos dispara la cobertura a meses."
      />

      {fallo && datos && (
        <Aviso tono="warn" mensaje={`No se pudo actualizar: ${fallo}. Lo de abajo es el último dato bueno.`} />
      )}

      {viejo && (
        <Aviso
          tono="warn"
          mensaje={`El último conteo es de hace ${d!.conteo!.antiguedadDias} días. El stock que ves puede no ser el real.`}
        />
      )}
      {urgente && (
        <Aviso
          tono="crit"
          mensaje={`El stock alcanza para ${dec(d!.coberturaDias!)} días y los componentes tardan ${d!.leadTime} en llegar: si el pedido no sale, hay días sin stock.`}
        />
      )}

      <Encabezado
        titulo="¿Qué armo esta semana?"
        bajada="Única pantalla que pide datos: el stock se cuenta a mano. Todo lo demás se deriva de ese número, así que si el conteo está viejo se avisa arriba en vez de mostrarlo como si fuera de hoy."
      />

      <Tarjeta
        dominio="prod" icono={<ClipboardList className="size-3.5" />}
        titulo="Cargar conteo"
        sub="Unidades terminadas, en total. Se guarda cada conteo: la serie es lo que después permite ver el ritmo real."
        estado="normal"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[140px]">
            <label className={LABEL} htmlFor="unidades">Unidades</label>
            <input
              id="unidades" className={INPUT} inputMode="numeric" value={unidades}
              onChange={e => setUnidades(e.target.value)} placeholder="7"
            />
          </div>
          <div className="min-w-[220px] flex-1">
            <label className={LABEL} htmlFor="nota">Nota (opcional)</label>
            <input
              id="nota" className={INPUT} value={nota} maxLength={280}
              onChange={e => setNota(e.target.value)} placeholder="faltan 2 cúpulas"
            />
          </div>
          <button
            type="button" onClick={() => void guardar()} disabled={guardando || !unidades}
            className="h-11 rounded-md bg-[var(--pnl-amber)] px-5 text-[13px] font-semibold text-[#23262F] disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : 'Guardar conteo'}
          </button>
        </div>
        {avisoForm && <p className="text-xs text-[var(--pnl-text-2)]">{avisoForm}</p>}
        {d?.conteo?.nota && (
          <p className="text-xs text-[var(--pnl-text-3)]">Última nota: {d.conteo.nota}</p>
        )}
      </Tarjeta>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores de producción">
        <Kpi
          dominio="prod" icono={<Package className="size-4" />}
          valor={d?.conteo ? num(d.conteo.unidades) : '—'} unidad="u"
          etiqueta="Stock de incubadoras terminadas"
          pie={d?.conteo ? `contado el ${fechaLarga(d.conteo.fecha)}` : 'todavía sin conteo'}
          delta={viejo ? `dato de hace ${d!.conteo!.antiguedadDias} días` : undefined}
          deltaTono="warn"
        />
        <Kpi
          dominio="prod" icono={<Gauge className="size-4" />}
          valor={d?.coberturaDias != null ? dec(d.coberturaDias) : '—'} unidad="días"
          etiqueta="Cobertura al ritmo de venta actual"
          pie={d ? `componentes: ${d.leadTime} días de espera` : undefined}
          delta={urgente ? 'menos que el lead time' : undefined}
          deltaTono="crit"
        />
        <Kpi
          dominio="web" icono={<Factory className="size-4" />}
          valor={d ? `${num(d.pedidos)} / ${num(d.capacidad)}` : '—'} unidad="u"
          etiqueta="Pedidos del mes contra la capacidad"
          pie="el techo es la demanda, no la fábrica"
        />
        <Kpi
          dominio="ml" icono={<Package className="size-4" />}
          valor={d ? ars(d.costoUnitario) : '—'}
          etiqueta="Costo de armado por unidad"
          pie="supuesto medido el 21/08/2026"
        />
      </section>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Tarjeta
          dominio="prod" icono={<Gauge className="size-3.5" />}
          titulo="Cobertura de stock"
          critica={urgente}
          sub="Lo que decide si hay que armar no es cuántas unidades hay, sino cuántos días duran al ritmo al que se venden."
          estado={estadoBase === 'normal' && (!d?.conteo || d.ritmoDiario === null) ? 'sin_fuente' : estadoBase}
          falta={
            !d?.conteo
              ? 'Falta el primer conteo de stock. Cargalo arriba: sin ese número no hay cobertura, ni punto de reposición, ni alerta de quiebre.'
              : 'No hubo pedidos pagos en el período elegido, así que no hay ritmo de venta con el que dividir. La cobertura sería infinita y diría "hay de sobra" justo cuando no se está vendiendo. Probá con un rango más largo.'
          }
          error={fallo}
          onReintentar={recargar}
        >
          {d?.conteo && d.ritmoDiario !== null && (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[
                  { n: dec(d.coberturaDias!), u: 'días', l: 'Cobertura al ritmo actual', c: urgente ? TONO.crit : TONO.ok },
                  { n: dec(d.puntoReposicion!), u: 'u', l: 'Punto de reposición', c: TONO.warn },
                  { n: dec(d.ritmoDiario, 2), u: 'u/día', l: `Ritmo de venta (${d.ventanaDias} días)`, c: 'var(--pnl-text)' },
                ].map(b => (
                  <div key={b.l} className="flex flex-col gap-1 rounded-md border border-[var(--pnl-hair)] bg-[var(--pnl-panel-2)] p-3">
                    <span className="num text-xl font-bold leading-tight" style={{ color: b.c }}>
                      {b.n}<span className="ml-1 text-[10px] font-medium uppercase text-[var(--pnl-text-3)]">{b.u}</span>
                    </span>
                    <span className="text-[11px] leading-snug text-[var(--pnl-text-3)]">{b.l}</span>
                  </div>
                ))}
              </div>
              <Medidor
                etiqueta={`Cobertura contra el lead time de ${d.leadTime} días`}
                valor={`${dec(d.coberturaDias!)} d`}
                pct={(d.coberturaDias! / (d.leadTime * 2)) * 100}
                color={urgente ? 'var(--pnl-red)' : DOMINIO.prod.color}
                marca={50}
              />
              <p className="text-[13px] leading-relaxed text-[var(--pnl-text-2)]">
                Las {num(d.conteo.unidades)} unidades duran {dec(d.coberturaDias!)} días, y los componentes
                tardan {d.leadTime} en llegar
                {d.quiebre && <> — al ritmo actual el stock se termina el {fechaLarga(d.quiebre)}</>}.
                Cuando la cobertura queda por debajo del lead time se vende igual y se entrega tarde, que es
                exactamente lo que después aparece como reclamo en Logística.
              </p>
            </>
          )}
        </Tarjeta>

        <Tarjeta
          dominio="prod" icono={<Factory className="size-3.5" />}
          titulo="Lo que la capacidad ociosa deja sobre la mesa"
          sub="No es una pérdida contable: es margen que existiría si hubiera demanda para las 65 unidades."
          estado={estadoBase === 'normal' && d?.ociosa == null ? 'sin_fuente' : estadoBase}
          falta="Sin pedidos en el período elegido no hay con qué comparar la capacidad."
          error={fallo}
          onReintentar={recargar}
        >
          {d?.ociosa != null && (
            <>
              <div className="flex flex-col gap-2">
                {[
                  { k: 'Capacidad instalada', v: `${num(d.capacidad)} u/mes`, n: 'el máximo que se puede armar' },
                  // Mensualizado: la capacidad es por mes, así que comparar contra los
                  // pedidos crudos de una ventana de 7 días diría que sobra capacidad siempre.
                  { k: 'Pedidos (ritmo mensual)', v: `${num(Math.round((d.ritmoDiario ?? 0) * 30))} u/mes`, n: `${dec(((d.ritmoDiario ?? 0) * 30 / d.capacidad) * 100)} % de la capacidad` },
                  { k: 'Ociosa', v: `${num(d.ociosa)} u/mes`, n: 'ni comprada ni vendida' },
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
                  <span className="font-semibold">Margen que representa</span>
                  <span className="num ml-auto font-bold" style={{ color: DOMINIO.prod.color }}>
                    {ars(d.margenOcioso!)}
                  </span>
                </div>
              </div>
              <Medidor
                etiqueta="Capacidad usada"
                valor={`${num(Math.round((d.ritmoDiario ?? 0) * 30))} de ${num(d.capacidad)} u`}
                pct={((d.ritmoDiario ?? 0) * 30 / d.capacidad) * 100}
                color={DOMINIO.prod.color}
              />
              <p className="text-[13px] leading-relaxed text-[var(--pnl-text-2)]">
                Ese número es el argumento de Adquisición: la fábrica no es el límite. Llenar la capacidad
                ociosa es un problema de demanda, y ahí es donde el techo de CAC decide cuánto se puede
                gastar para conseguirla.
              </p>
              <p className={EYEBROW}>
                Se calcula contra los pedidos del mes, que es lo que efectivamente hubo que armar
              </p>
            </>
          )}
        </Tarjeta>
      </div>
    </PanelShell>
  )
}
