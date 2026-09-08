// Lectura de Meta Ads (Marketing API). Un solo lugar.
//
// Estas funciones vivían dentro de `app/api/analytics/route.ts`. Se sacaron cuando el panel
// de Operación necesitó el mismo gasto: copiarlas habría dejado dos funciones que consultan
// la misma cuenta con la misma URL, y el día que una cambie —la versión de la API, el id de
// cuenta, el manejo del token vencido— la otra sigue devolviendo lo de antes sin avisar.
// Dos pantallas mostrando gastos distintos del mismo mes es exactamente la clase de bug que
// nadie mira dos veces porque las dos "andan".
//
// El token se lee acá adentro y no se recibe por parámetro: así ninguna ruta necesita tocar
// la variable de entorno, y si no está configurado se devuelve cero en vez de romper.

/** La cuenta de Micelium. Es única: no hay multi-cuenta y fingir que sí lo habría sería trabajo muerto. */
export const META_ACCOUNT = 'act_1063192135217249'

const API = 'https://graph.facebook.com/v21.0'

export type MetaTotales = { spend: number; clicks: number; impressions: number; reach: number }

export interface MetaInsightDay {
  date_start: string
  spend: string
  clicks: string
  impressions: string
  reach: string
  actions?: { action_type: string; value: string }[]
}

const VACIO: MetaTotales = { spend: 0, clicks: 0, impressions: 0, reach: 0 }

/**
 * Totales del período.
 *
 * Falla devolviendo ceros y no lanzando, a propósito: el gasto de Meta es UN dato de un
 * panel que muestra veinte. Que Meta esté caída no puede tumbar la pantalla entera — pero
 * sí hay que poder distinguir "gastó cero" de "no se pudo leer", y para eso está `ok`.
 */
export async function totalesMeta(since: string, until: string): Promise<MetaTotales & { ok: boolean }> {
  const token = process.env.META_ADS_TOKEN
  if (!token) return { ...VACIO, ok: false }
  try {
    const url = `${API}/${META_ACCOUNT}/insights` +
      `?fields=spend,clicks,impressions,reach` +
      `&time_range={"since":"${since}","until":"${until}"}` +
      `&access_token=${token}`
    const res = await fetch(url)
    const data = (await res.json()) as { data?: Array<{ spend: string; clicks: string; impressions: string; reach: string }> }
    const d = data.data?.[0]
    if (!d) return { ...VACIO, ok: res.ok } // sin filas puede ser un período sin gasto: eso SÍ es un cero real
    return {
      spend: parseFloat(d.spend ?? '0'),
      clicks: parseInt(d.clicks ?? '0'),
      impressions: parseInt(d.impressions ?? '0'),
      reach: parseInt(d.reach ?? '0'),
      ok: true,
    }
  } catch {
    return { ...VACIO, ok: false }
  }
}

/** Día por día, para las series. Devuelve `[]` cuando falla: el gráfico se vacía, no se rompe. */
export async function porDiaMeta(since: string, until: string): Promise<MetaInsightDay[]> {
  const token = process.env.META_ADS_TOKEN
  if (!token) return []
  try {
    const url = `${API}/${META_ACCOUNT}/insights` +
      `?fields=spend,clicks,impressions,reach,actions` +
      `&time_increment=1` +
      `&time_range={"since":"${since}","until":"${until}"}` +
      `&limit=90` +
      `&access_token=${token}`
    const res = await fetch(url)
    const data = (await res.json()) as { data?: MetaInsightDay[] }
    return data.data ?? []
  } catch {
    return []
  }
}

export type Adset = { id: string; nombre: string; campana: string | null; spend: number; frecuencia: number | null }

/**
 * Frecuencia y gasto por conjunto de anuncios.
 *
 * La frecuencia es el aviso temprano del desgaste creativo: cuando un adset pasa de ~4, el
 * mismo público ya vio el anuncio cuatro veces y el costo empieza a subir sin que cambie
 * nada más. Se pide por adset y no en total porque el promedio de la cuenta esconde
 * justamente al que se quemó.
 *
 * `null` en frecuencia cuando Meta no la devuelve (adset sin entrega en el período): eso no
 * es un cero, es que no hay nada que medir.
 */
export async function frecuenciaPorAdset(since: string, until: string): Promise<Adset[]> {
  const token = process.env.META_ADS_TOKEN
  if (!token) return []
  try {
    const url = `${API}/${META_ACCOUNT}/insights` +
      `?level=adset&fields=adset_id,adset_name,campaign_name,spend,frequency` +
      `&time_range={"since":"${since}","until":"${until}"}` +
      `&limit=100&access_token=${token}`
    const res = await fetch(url)
    const data = (await res.json()) as {
      data?: Array<{ adset_id?: string; adset_name?: string; campaign_name?: string; spend?: string; frequency?: string }>
    }
    return (data.data ?? []).map(a => ({
      id: a.adset_id ?? '',
      nombre: a.adset_name ?? '(sin nombre)',
      campana: a.campaign_name ?? null,
      spend: parseFloat(a.spend ?? '0'),
      frecuencia: a.frequency != null ? parseFloat(a.frequency) : null,
    }))
  } catch {
    return []
  }
}
