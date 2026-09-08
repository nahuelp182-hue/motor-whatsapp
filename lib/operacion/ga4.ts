// Conversión web: cuántos de los que entran terminan comprando.
//
// El numerador NO sale de GA4 y eso es a propósito. GA4 solo ve el `purchase` del navegador,
// y en esta tienda 13 de cada 34 pedidos se pagan por transferencia bancaria: nunca disparan
// ese evento. Medido el 10/06/2026, GA4 registraba el 74% de las compras reales. Una tasa
// calculada con su numerador diría 26% menos de lo que realmente pasa, y esa diferencia se
// leería como un problema de conversión que no existe.
//
// Entonces: sesiones de GA4 (que sí mide bien, es lo único que ve el navegador) sobre
// pedidos de Tiendanube (que es la verdad de lo que se vendió). Cada mitad viene de la
// fuente que la conoce.

import { tokenGoogle } from '@/lib/google-token'

const PROPERTY = process.env.GA4_PROPERTY_ID ?? ''

export type Ga4 = {
  ok: boolean
  sesiones: number
  usuarios: number
  /** Compras que vio GA4. Solo para contrastar contra Tiendanube, nunca para la tasa. */
  comprasGa4: number
  /** Motivo por el que no hay datos. La pantalla lo muestra en vez de un cero. */
  motivo: string | null
}

export async function leerGa4(since: string, until: string): Promise<Ga4> {
  const vacio = (motivo: string): Ga4 => ({ ok: false, sesiones: 0, usuarios: 0, comprasGa4: 0, motivo })

  if (!PROPERTY) return vacio('Falta GA4_PROPERTY_ID en el entorno.')
  const token = await tokenGoogle()
  if (!token) return vacio('No se pudo renovar el token de Google. Puede haber caducado el refresh token.')

  try {
    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY}:runReport`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [{ startDate: since, endDate: until }],
          metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'transactions' }],
        }),
      },
    )
    if (!res.ok) return vacio(`GA4 respondió ${res.status}.`)

    const data = (await res.json()) as { rows?: { metricValues: { value: string }[] }[] }
    const m = data.rows?.[0]?.metricValues
    // Sin filas GA4 no está diciendo "cero sesiones": está diciendo que no hay datos para ese
    // rango todavía (procesa con demora). Un 0 acá haría que la tasa de conversión se
    // dividiera por cero o diera infinito.
    if (!m) return vacio('GA4 todavía no procesó datos para este período.')

    return {
      ok: true,
      sesiones: Number(m[0]?.value ?? 0),
      usuarios: Number(m[1]?.value ?? 0),
      comprasGa4: Number(m[2]?.value ?? 0),
      motivo: null,
    }
  } catch (e) {
    return vacio(e instanceof Error ? e.message : 'error desconocido consultando GA4')
  }
}
