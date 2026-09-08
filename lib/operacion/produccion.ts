// Producción: ¿qué armo esta semana?
//
// Lo que decide si hay que armar no es cuántas unidades hay, sino cuántos días duran al
// ritmo al que se venden. Un stock de 7 unidades es cómodo si se vende una por semana y es
// una urgencia si se venden siete.
//
// Es la única pantalla que pide datos: el stock se cuenta a mano. Todo lo demás se deriva
// de ese número, así que cuando el conteo está viejo se avisa arriba en vez de mostrarlo
// como si fuera de hoy.

import { prisma } from '@/lib/prisma'
import { fetchTNOrdersClassified } from '@/lib/attribution'
import { CAPACIDAD_MENSUAL, COSTO_UNITARIO, LEAD_TIME_DIAS, MARGEN_INCUBADORA } from '@/lib/supuestos'
import { rangoDePreset, etiquetaRango, type Rango } from '@/lib/operacion/rango'

const DIA = 86_400_000
const iso = (d: Date) => d.toISOString().slice(0, 10)

/** A partir de cuántos días un conteo deja de ser confiable para decidir. */
export const CONTEO_VIEJO_DIAS = 7

export type Produccion = {
  conteo: { unidades: number; fecha: string; nota: string | null; antiguedadDias: number } | null
  /** Pedidos pagos por día, sobre la ventana del filtro. Es el ritmo real, no uno declarado. */
  ritmoDiario: number | null
  /** Pedidos del período. Se llamaba `pedidos30` cuando la ventana era fija. */
  pedidos: number
  /** Días sobre los que se calculó el ritmo. Va a pantalla: con 7 días el ritmo es ruidoso. */
  ventanaDias: number
  etiqueta: string
  coberturaDias: number | null
  puntoReposicion: number | null
  quiebre: string | null
  capacidad: number
  costoUnitario: number
  leadTime: number
  margenUnitario: number
  /** Capacidad que existe y no se usa. No es una pérdida contable: es margen que habría si hubiera demanda. */
  ociosa: number | null
  margenOcioso: number | null
}

export async function leerProduccion(rango: Rango = rangoDePreset(30)): Promise<Produccion> {
  const hoy = new Date()
  const since = rango.desde
  const dias = rango.dias

  const [ultimo, ordenes] = await Promise.all([
    prisma.conteoStock.findFirst({ orderBy: { fecha: 'desc' } }),
    fetchTNOrdersClassified(since, rango.hasta),
  ])

  const pedidos = ordenes.length
  // Sin pedidos no hay ritmo: devolver 0 haría que la cobertura fuese infinita y el panel
  // diría "hay stock de sobra" justo cuando no se está vendiendo nada.
  //
  // Se divide por los días del rango y no por 30 fijo: si no, achicar el filtro bajaría el
  // ritmo proporcionalmente y la cobertura se dispararía. La contracara es que con ventanas
  // cortas el ritmo es ruidoso, y por eso `ventanaDias` viaja hasta la pantalla.
  const ritmoDiario = pedidos > 0 ? pedidos / dias : null

  const conteo = ultimo
    ? {
        unidades: ultimo.unidades,
        fecha: ultimo.fecha.toISOString(),
        nota: ultimo.nota,
        antiguedadDias: Math.floor((hoy.getTime() - ultimo.fecha.getTime()) / DIA),
      }
    : null

  const cobertura = conteo && ritmoDiario ? conteo.unidades / ritmoDiario : null
  const pedidosMensualizados = ritmoDiario !== null ? Math.round(ritmoDiario * 30) : 0

  return {
    conteo,
    ritmoDiario,
    pedidos,
    ventanaDias: dias,
    etiqueta: etiquetaRango(rango),
    coberturaDias: cobertura,
    puntoReposicion: ritmoDiario ? LEAD_TIME_DIAS * ritmoDiario : null,
    quiebre: cobertura ? new Date(hoy.getTime() + cobertura * DIA).toISOString() : null,
    capacidad: CAPACIDAD_MENSUAL,
    costoUnitario: COSTO_UNITARIO,
    leadTime: LEAD_TIME_DIAS,
    margenUnitario: MARGEN_INCUBADORA,
    // La ociosa se calcula contra los pedidos del mes, que es lo que efectivamente hubo que
    // armar. Si algún día se registra la producción real, este es el número que la reemplaza.
    // La ociosa compara contra la capacidad MENSUAL, así que los pedidos del rango se
    // llevan a un mes equivalente. Sin esto, con el filtro en 7 días la pantalla diría que
    // sobran 60 unidades de capacidad todos los meses, que es falso por construcción.
    ociosa: pedidos > 0 ? Math.max(0, CAPACIDAD_MENSUAL - pedidosMensualizados) : null,
    margenOcioso: pedidos > 0 ? Math.max(0, CAPACIDAD_MENSUAL - pedidosMensualizados) * MARGEN_INCUBADORA : null,
  }
}

/** Registra un conteo. La fecha puede ser anterior a hoy: se cuenta un día y se carga otro. */
export async function guardarConteo(unidades: number, fecha: Date, nota?: string) {
  return prisma.conteoStock.create({ data: { unidades, fecha, nota: nota?.trim() || null } })
}
