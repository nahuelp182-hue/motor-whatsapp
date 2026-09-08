'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Truck, PackageX, Package, Clock, TriangleAlert, MapPin, ChartNoAxesColumn, Gauge } from 'lucide-react'
import { PanelShell } from '@/components/PanelShell'
import { RailOperacion } from '@/components/operacion/Rail'
import { FiltroMaestro, useRangoMaestro } from '@/components/operacion/FiltroMaestro'
import { PISO_ABIERTOS_DIAS } from '@/lib/operacion/rango'
import {
  Tarjeta, Kpi, Medidor, Pastilla, Encabezado, Aviso,
  DOMINIO, TONO, dec, num, type EstadoTarjeta, type Tono,
} from '@/components/operacion/ui'
import { CARD, EYEBROW } from '@/components/widgets/ui'

// Logística: qué envío está por convertirse en reclamo.
//
// La pregunta que contesta la pantalla no es "cuántos envíos hay" sino cuál hay que
// atender HOY. Por eso el orden por defecto es días en tránsito y no fecha de despacho:
// el que más lleva esperando es el que está más cerca del reclamo.
//
// Los datos salen de Postgres (los junta el cron `operacion-envios`), nunca de Andreani en
// vivo: la pantalla abre rápido y una caída de Andreani muestra el último dato bueno con
// su hora en vez de dejar todo en blanco.

const PLAZO_MAX = 5 // días prometidos en la web; el eje de los medidores llega a 8

type FilaEnvio = {
  tracking: string
  referencia: string
  origen: string
  destino: string | null
  producto: string | null
  estado: string
  dias: number | null
  accion: 'Reclamar' | 'Avisar' | 'Despachar' | null
  error: string | null
}

type Logistica = {
  corte: string | null
  historicoDesde: string | null
  kpis: {
    frenados: number; enTransito: number; sinDespachar: number
    promedioDias: number | null; promedioDespacho: number | null; promedioCorreo: number | null
    entregadosMedidos: number
  }
  abiertos: FilaEnvio[]
  cumplimiento: { dentro: number; total: number; pct: number | null }
  porProvincia: Array<{ provincia: string; dias: number; entregas: number }>
  porSemana: Array<{ semana: string; dias: number; entregas: number }>
  error?: string
}

const ETIQUETA_ESTADO: Record<string, { texto: string; tono: Tono }> = {
  sin_despachar: { texto: 'sin despachar', tono: 'warn' },
  en_transito: { texto: 'en tránsito', tono: 'neutro' },
  en_sucursal: { texto: 'en sucursal', tono: 'ok' },
  entregado: { texto: 'entregado', tono: 'ok' },
  sin_dato: { texto: 'sin dato', tono: 'neutro' },
  no_trackeable: { texto: 'sin seguimiento', tono: 'neutro' },
}

/** El color de los días sale del umbral, no del estado: 8 días es rojo aunque el correo diga "en tránsito". */
function tonoDias(dias: number | null): Tono {
  if (dias === null) return 'neutro'
  if (dias >= 8) return 'crit'
  if (dias >= 5) return 'warn'
  return 'neutro'
}

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })

const horaCorta = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

type Orden = { col: 'dias' | 'destino' | 'referencia' | 'estado'; dir: 'asc' | 'desc' }

export default function LogisticaPage() {
  const { rango, aplicar } = useRangoMaestro()
  const [datos, setDatos] = useState<Logistica | null>(null)
  const [cargando, setCargando] = useState(true)
  const [fallo, setFallo] = useState<string | null>(null)
  const [orden, setOrden] = useState<Orden>({ col: 'dias', dir: 'desc' })

  // La carga se dispara con un contador y no llamando a una función desde el efecto: el
  // estado se toca dentro del callback asincrónico, nunca en el cuerpo del efecto (eso
  // encadena renders). `vivo` corta el seteo si la pantalla se desmontó a mitad del fetch.
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    if (!rango) return
    let vivo = true
    setCargando(true)
    void (async () => {
      try {
        const res = await fetch(`/api/operacion/logistica?desde=${rango.desde}&hasta=${rango.hasta}`)
        const j = (await res.json()) as Logistica
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

  const cargar = useCallback(() => {
    setCargando(true)
    setRecarga(n => n + 1)
  }, [])

  const filas = useMemo(() => {
    if (!datos) return []
    const xs = [...datos.abiertos]
    xs.sort((a, b) => {
      const x = a[orden.col] ?? '', y = b[orden.col] ?? ''
      const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es')
      return orden.dir === 'asc' ? r : -r
    })
    return xs
  }, [datos, orden])

  // El estado de cada tarjeta se decide una vez y con la misma regla: nada de `datos?.x ?? 0`,
  // que es justo lo que hace pasar un dato que no llegó por un cero real.
  // Un fallo SOLO vacía la pantalla cuando no hay nada previo que mostrar. Si ya había
  // datos, se conservan y el fallo se avisa arriba: el último dato bueno con su hora es más
  // útil que una pantalla en blanco, que es exactamente lo que dice hacer lib/operacion.
  const estadoBase: EstadoTarjeta = cargando && !datos ? 'cargando' : fallo && !datos ? 'error' : 'normal'
  const k = datos?.kpis
  const hayHistorico = (datos?.cumplimiento.total ?? 0) > 0

  // El aviso mira el más viejo DE LOS FRENADOS, no el primero de la tabla: la tabla se
  // puede reordenar por cualquier columna, y con orden por destino el aviso hablaba de un
  // envío cualquiera como si fuera el más urgente.
  const masViejo = [...filas]
    .filter(f => f.estado !== 'sin_despachar' && f.estado !== 'no_trackeable')
    .sort((a, b) => (b.dias ?? -1) - (a.dias ?? -1))[0]
  const aviso = masViejo && masViejo.dias !== null && masViejo.dias >= 8
    ? `El pedido #${masViejo.referencia} lleva ${masViejo.dias} días sin entregar${masViejo.destino ? ` a ${masViejo.destino}` : ''} — el más viejo abierto`
    : null

  return (
    <PanelShell
      titulo="Operación · Logística"
      sub={
        datos?.corte
          ? `Últimos 21 días · dato del ${horaCorta(datos.corte)}`
          : 'Últimos 21 días'
      }
      accion={
        <button
          type="button"
          onClick={cargar}
          disabled={cargando}
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
        nota={`El rango recorta el histórico (cumplimiento, demora por provincia y por semana). Los envíos abiertos se muestran siempre desde los últimos ${PISO_ABIERTOS_DIAS} días como mínimo: achicar el filtro no puede esconder un envío frenado.`}
      />

      {fallo && datos && (
        <Aviso tono="warn" mensaje={`No se pudo actualizar: ${fallo}. Lo de abajo es el último dato bueno.`} />
      )}

      {aviso && <Aviso tono="crit" mensaje={aviso} />}

      <Encabezado
        titulo="¿Qué envío está por convertirse en reclamo?"
        nota="últimos 21 días"
        bajada="Ordenado por días en tránsito, no por fecha de despacho: el que más tiempo lleva esperando es el que hay que atender primero. Los umbrales son 5 días para avisar y 8 para reclamar — a los 8 el reclamo del cliente ya entró."
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores de logística">
        <Kpi
          dominio="log" icono={<TriangleAlert className="size-4" />}
          valor={k ? num(k.frenados) : '—'} unidad="envíos"
          etiqueta="Frenados · 8 días o más sin entregar"
          pie={k?.frenados ? 'requieren reclamo' : 'ninguno hoy'}
          delta={k?.frenados ? 'atender hoy' : undefined} deltaTono="crit"
        />
        <Kpi
          dominio="log" icono={<Truck className="size-4" />}
          valor={k ? num(k.enTransito) : '—'} unidad="envíos"
          etiqueta="En tránsito con tracking propio"
          pie="Tiendanube · Andreani"
        />
        <Kpi
          dominio="ml" icono={<Package className="size-4" />}
          valor={k ? num(k.sinDespachar) : '—'} unidad="envíos"
          etiqueta="Pagados y todavía sin despachar"
          pie="incluye los apícolas pendientes"
        />
        <Kpi
          dominio="log" icono={<Clock className="size-4" />}
          valor={k?.promedioDias != null ? dec(k.promedioDias) : '—'} unidad="días"
          etiqueta="Compra a entrega"
          pie={
            k?.promedioDias != null
              ? `sobre ${num(k.entregadosMedidos)} entregas medidas · plazo prometido 2 a 5`
              : 'todavía sin entregas medidas'
          }
        />
      </section>

      <Tarjeta
        dominio="log" icono={<Clock className="size-3.5" />}
        titulo="¿Dónde se van los días?"
        sub="El total partido en sus dos mitades, porque se arreglan de forma distinta: una se resuelve armando y despachando antes, la otra hay que reclamársela al correo."
        estado={estadoBase === 'normal' && k?.promedioDespacho == null ? 'sin_fuente' : estadoBase}
        falta="Hacen falta entregas con fecha de ingreso a Andreani. Se completa sola a medida que el cron registra envíos nuevos."
        error={fallo}
        onReintentar={cargar}
      >
        {k?.promedioDespacho != null && (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { n: dec(k.promedioDespacho), l: 'De la compra al ingreso en Andreani', s: 'lo maneja Micelium: armado y despacho' },
                { n: k.promedioCorreo != null ? dec(k.promedioCorreo) : '—', l: 'Del ingreso a la entrega', s: 'lo maneja el correo' },
                { n: k.promedioDias != null ? dec(k.promedioDias) : '—', l: 'Total, punta a punta', s: 'es lo que vive el cliente' },
              ].map(b => (
                <div key={b.l} className="flex flex-col gap-1 rounded-md border border-[var(--pnl-hair)] bg-[var(--pnl-panel-2)] p-3">
                  <span className="num text-xl font-bold leading-tight text-[var(--pnl-text)]">{b.n} <span className="text-[12px] font-medium text-[var(--pnl-text-3)]">días</span></span>
                  <span className="text-[11px] leading-snug text-[var(--pnl-text-2)]">{b.l}</span>
                  <span className="text-[11px] leading-snug text-[var(--pnl-text-3)]">{b.s}</span>
                </div>
              ))}
            </div>
            <p className="text-xs leading-relaxed text-[var(--pnl-text-3)]">
              La fecha de entrega es la que informa Andreani en su timeline, no la hora en que el
              cron la consultó. La distinción importa: sellar la entrega con el momento de la
              lectura funciona mientras el cron corra seguido, pero convierte cualquier carga
              histórica en un promedio inventado. Del lado de la compra, Tiendanube no expone la
              fecha de despacho y se usa la de la orden, así que esa mitad es conservadora.
            </p>
          </>
        )}
      </Tarjeta>

      <Tarjeta
        dominio="log" icono={<Truck className="size-3.5" />}
        titulo="Envíos abiertos, por antigüedad"
        sub="Todo lo pagado que aún no está entregado. Clic en una columna para reordenar."
        estado={estadoBase === 'normal' && filas.length === 0 ? 'vacio' : estadoBase}
        vacio="Ningún envío abierto: todo lo despachado figura entregado."
        error={fallo}
        ultimoDato={datos?.corte ? horaCorta(datos.corte) : null}
        onReintentar={cargar}
      >
        <div className="overflow-x-auto rounded-md border border-[var(--pnl-hair)]">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {([
                  ['Pedido', 'referencia'], ['Canal', null], ['Destino', 'destino'],
                  ['Producto', null], ['Estado', 'estado'], ['Días', 'dias'], ['Acción', null],
                ] as const).map(([titulo, col]) => (
                  <th
                    key={titulo}
                    scope="col"
                    aria-sort={col && orden.col === col ? (orden.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`whitespace-nowrap border-b border-[var(--pnl-hair)] bg-[var(--pnl-panel-2)] px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-[var(--pnl-text-3)] ${
                      titulo === 'Días' ? 'text-right' : ''
                    } ${col ? 'cursor-pointer select-none' : ''}`}
                    onClick={col ? () => setOrden(o => ({ col, dir: o.col === col && o.dir === 'desc' ? 'asc' : 'desc' })) : undefined}
                  >
                    {col ? (
                      // Un botón real y no un th con onClick: ordenar tiene que funcionar
                      // con teclado, y el área táctil llega a 44px con el padding de la celda.
                      <button type="button" className="inline-flex items-center gap-1">
                        {titulo}
                        <span aria-hidden style={{ opacity: orden.col === col ? 1 : 0.35 }}>
                          {orden.col === col ? (orden.dir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </button>
                    ) : titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map(f => {
                const e = ETIQUETA_ESTADO[f.estado] ?? { texto: f.estado, tono: 'neutro' as Tono }
                return (
                  <tr key={f.tracking} className="hover:bg-[var(--pnl-panel-2)]">
                    <td className="num whitespace-nowrap border-b border-[var(--pnl-hair)] px-3 py-2.5">#{f.referencia}</td>
                    <td className="whitespace-nowrap border-b border-[var(--pnl-hair)] px-3 py-2.5" style={{ color: f.origen === 'ml' ? DOMINIO.ml.color : DOMINIO.web.color }}>
                      {f.origen === 'ml' ? 'MercadoLibre' : 'Tiendanube'}
                    </td>
                    <td className="whitespace-nowrap border-b border-[var(--pnl-hair)] px-3 py-2.5">{f.destino ?? '—'}</td>
                    <td className="max-w-[26ch] truncate border-b border-[var(--pnl-hair)] px-3 py-2.5 text-[var(--pnl-text-2)]" title={f.producto ?? ''}>
                      {f.producto ?? '—'}
                    </td>
                    <td className="whitespace-nowrap border-b border-[var(--pnl-hair)] px-3 py-2.5">
                      <Pastilla tono={e.tono}>{e.texto}</Pastilla>
                    </td>
                    <td
                      className="num whitespace-nowrap border-b border-[var(--pnl-hair)] px-3 py-2.5 text-right font-semibold"
                      style={{ color: TONO[tonoDias(f.dias)] }}
                    >
                      {f.dias ?? '—'}
                    </td>
                    <td className="whitespace-nowrap border-b border-[var(--pnl-hair)] px-3 py-2.5 font-semibold" style={{ color: f.accion ? TONO[tonoDias(f.dias)] : 'var(--pnl-text-3)' }}>
                      {f.accion ?? '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs leading-relaxed text-[var(--pnl-text-3)]">
          De los apícolas solo se sabe si el fabricante despachó: el traslado lo hace MercadoLibre y esa
          trazabilidad no la tenemos. No se inventa un &ldquo;en tránsito&rdquo; que nadie puede verificar.
        </p>
      </Tarjeta>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Tarjeta
          dominio="log" icono={<Gauge className="size-3.5" />}
          titulo="Cumplimiento del plazo prometido"
          sub="La web promete de 2 a 5 días. Esto mide cuántas entregas caen dentro de esa ventana."
          estado={estadoBase === 'normal' && !hayHistorico ? 'sin_fuente' : estadoBase}
          falta={
            datos?.historicoDesde
              ? `El histórico arranca el ${fechaCorta(datos.historicoDesde)} y todavía no hay entregas completas registradas. Andreani no informa el pasado: cada entrega se puede medir solo si el envío estaba siendo seguido cuando salió.`
              : 'Todavía no corrió el cron que guarda el estado de los envíos. Sin esa historia no hay días a destino que promediar.'
          }
          error={fallo}
          onReintentar={cargar}
        >
          {datos && (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[
                  { n: datos.cumplimiento.pct != null ? `${dec(datos.cumplimiento.pct)} %` : '—', l: 'Entregas dentro del plazo', c: (datos.cumplimiento.pct ?? 0) >= 90 ? TONO.ok : TONO.warn },
                  { n: `${num(datos.cumplimiento.dentro)} de ${num(datos.cumplimiento.total)}`, l: 'Cumplidas en 21 días', c: 'var(--pnl-text)' },
                  { n: num(datos.cumplimiento.total - datos.cumplimiento.dentro), l: 'Fuera de la promesa', c: TONO.crit },
                ].map(b => (
                  <div key={b.l} className={`${CARD} flex flex-col gap-1 p-3`}>
                    <span className="num text-xl font-bold leading-tight" style={{ color: b.c }}>{b.n}</span>
                    <span className="text-[11px] leading-snug text-[var(--pnl-text-3)]">{b.l}</span>
                  </div>
                ))}
              </div>
              <p className={EYEBROW}>Días a destino, semana a semana</p>
              {datos.porSemana.length === 0 ? (
                <p className="text-xs text-[var(--pnl-text-3)]">Sin semanas completas todavía.</p>
              ) : (
                datos.porSemana.map(s => (
                  <Medidor
                    key={s.semana}
                    etiqueta={`Semana del ${fechaCorta(s.semana)} · ${num(s.entregas)} entregas`}
                    valor={`${dec(s.dias)} d`}
                    pct={(s.dias / 8) * 100}
                    color={s.dias > PLAZO_MAX ? 'var(--pnl-red)' : DOMINIO.log.color}
                    marca={(PLAZO_MAX / 8) * 100}
                  />
                ))
              )}
              <p className="text-xs leading-relaxed text-[var(--pnl-text-3)]">
                La marca vertical es el tope prometido de 5 días. Un promedio suelto no dice si está
                mejorando: contra la semana anterior, sí.
              </p>
            </>
          )}
        </Tarjeta>

        <Tarjeta
          dominio="log" icono={<MapPin className="size-3.5" />}
          titulo="Demora por provincia"
          sub="Promedio de días a destino de las entregas registradas."
          estado={estadoBase === 'normal' && datos?.porProvincia.length === 0 ? 'sin_fuente' : estadoBase}
          falta="Necesita entregas ya completadas con provincia. Se llena solo a medida que el cron registra despachos y entregas; ninguna entrega anterior a hoy se puede recuperar."
          error={fallo}
          onReintentar={cargar}
        >
          {datos?.porProvincia.map(p => (
            <Medidor
              key={p.provincia}
              etiqueta={`${p.provincia} · ${num(p.entregas)} entregas`}
              valor={`${dec(p.dias)} d`}
              pct={(p.dias / 8) * 100}
              color={p.dias >= PLAZO_MAX ? 'var(--pnl-red)' : p.dias >= 4 ? 'var(--pnl-amber)' : DOMINIO.log.color}
              marca={(PLAZO_MAX / 8) * 100}
            />
          ))}
        </Tarjeta>
      </div>

      <Tarjeta
        dominio="log" icono={<ChartNoAxesColumn className="size-3.5" />}
        titulo="Cuántos reclaman según los días que esperaron"
        sub="Dónde se dispara el reclamo: es lo que justifica poner el umbral de alerta en 5 y no en 8."
        estado="sin_fuente"
        falta="Hace falta cruzar cada envío de esta tabla con los reclamos del CRM (crm.db, en el VPS). Hoy el panel sabe cuánto tardó cada envío pero no cuáles terminaron en reclamo, así que la curva no se puede calcular — y estimarla sería inventar el número que justifica los umbrales."
      />

      <Tarjeta
        dominio="log" icono={<PackageX className="size-3.5" />}
        titulo="De dónde sale cada número"
        sub="Para poder discutirlos."
        estado="normal"
      >
        <ul className="flex list-disc flex-col gap-2 pl-4 text-xs leading-relaxed text-[var(--pnl-text-3)]">
          <li><b className="text-[var(--pnl-text-2)]">Días en tránsito</b>: desde la fecha del pedido de Tiendanube, no desde el despacho — Tiendanube no expone la fecha de despacho. Sobreestima: el número nunca hace parecer mejor de lo que fue.</li>
          <li><b className="text-[var(--pnl-text-2)]">Fecha de entrega</b>: el día que el cron ve el envío como entregado en Andreani, con la precisión de su cadencia (4 h), no el minuto exacto.</li>
          <li><b className="text-[var(--pnl-text-2)]">Provincia</b>: del domicilio de entrega del pedido. Los apícolas no la traen.</li>
          <li><b className="text-[var(--pnl-text-2)]">Histórico</b>: existe solo desde que corre el cron. Andreani informa el presente; el pasado no se puede reconstruir.</li>
        </ul>
      </Tarjeta>
    </PanelShell>
  )
}
