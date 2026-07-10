// Atribución Meta vs Orgánico — misma lógica que ~/.claude/meta_organic_attribution.py
// Clasifica cada orden de TN usando utm_parameters/fbclid capturados por Tiendanube
// en el momento del click (primera parte, no depende de GA4/Meta Pixel).

export type TNClass = 'meta_ads' | 'google_ads' | 'sin_utm_con_landing' | 'sin_dato_de_visita' | 'otro_utm'

export interface TNOrderRaw {
  id: number
  number: number
  total: string
  gateway?: string
  created_at: string
  paid_at?: string
  landing_url?: string | null
  contact_phone?: string
  customer_visit?: {
    landing_page?: string | null
    utm_parameters?: {
      utm_source?: string | null
      utm_medium?: string | null
    } | null
  } | null
}

export interface ClassifiedOrder {
  id: number
  number: number
  total: number
  gateway: string
  createdAt: string
  tnClass: TNClass
}

function extraerParam(landingUrl: string | null | undefined, key: string): string | null {
  if (!landingUrl) return null
  try {
    const qIndex = landingUrl.indexOf('?')
    if (qIndex === -1) return null
    const params = new URLSearchParams(landingUrl.slice(qIndex + 1))
    return params.get(key)
  } catch {
    return null
  }
}

export function classifyOrder(o: TNOrderRaw): TNClass {
  const visit = o.customer_visit ?? null
  const utm = visit?.utm_parameters ?? null
  const landing = o.landing_url ?? visit?.landing_page ?? null

  const utmSource = (utm?.utm_source ?? '').toLowerCase()
  const utmMedium = (utm?.utm_medium ?? '').toLowerCase()
  const fbclid = extraerParam(landing, 'fbclid')
  const gclid  = extraerParam(landing, 'gclid')

  if (['fb', 'ig', 'facebook', 'instagram'].includes(utmSource) || fbclid) return 'meta_ads'
  if (utmSource === 'google' || gclid || utmMedium === 'cpc') return 'google_ads'
  if (utmSource || utmMedium) return 'otro_utm'
  if (landing) return 'sin_utm_con_landing'
  return 'sin_dato_de_visita'
}

const TN_STORE = process.env.TN_STORE_ID ?? '1957278'
const TN_TOKEN = process.env.TN_ACCESS_TOKEN ?? ''
const TN_UA = 'Micelium/1.0 (nahuelp182@gmail.com)'

const ATTRIBUTION_FIELDS = 'id,number,total,gateway,created_at,paid_at,landing_url,customer_visit,contact_phone'

export async function fetchTNOrdersClassified(since: string, until: string): Promise<ClassifiedOrder[]> {
  if (!TN_TOKEN) return []
  const all: TNOrderRaw[] = []
  let page = 1
  while (true) {
    const url = `https://api.tiendanube.com/v1/${TN_STORE}/orders?payment_status=paid` +
      `&created_at_min=${since}T00:00:00-03:00&created_at_max=${until}T23:59:59-03:00` +
      `&per_page=50&page=${page}&fields=${ATTRIBUTION_FIELDS}`
    const res = await fetch(url, { headers: { Authentication: `bearer ${TN_TOKEN}`, 'User-Agent': TN_UA } })
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) break
    all.push(...data)
    if (data.length < 50) break
    page++
    await new Promise(r => setTimeout(r, 150))
  }
  return all.map(o => ({
    id: o.id,
    number: o.number,
    total: parseFloat(o.total ?? '0'),
    gateway: o.gateway ?? 'desconocido',
    createdAt: o.created_at,
    tnClass: classifyOrder(o),
  }))
}

export const CHANNEL_LABEL: Record<TNClass, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  otro_utm: 'Otro (UTM)',
  sin_utm_con_landing: 'Orgánico/Directo',
  sin_dato_de_visita: 'Sin dato (ciego)',
}

export const CHANNEL_COLOR: Record<TNClass, string> = {
  meta_ads: '#f97316',
  google_ads: '#4285F4',
  otro_utm: '#a78bfa',
  sin_utm_con_landing: '#34d399',
  sin_dato_de_visita: '#71717a',
}

export function aggregateByChannel(orders: ClassifiedOrder[]) {
  const byChannel: Record<TNClass, { orders: number; revenue: number }> = {
    meta_ads: { orders: 0, revenue: 0 },
    google_ads: { orders: 0, revenue: 0 },
    otro_utm: { orders: 0, revenue: 0 },
    sin_utm_con_landing: { orders: 0, revenue: 0 },
    sin_dato_de_visita: { orders: 0, revenue: 0 },
  }
  for (const o of orders) {
    byChannel[o.tnClass].orders += 1
    byChannel[o.tnClass].revenue += o.total
  }
  return byChannel
}
