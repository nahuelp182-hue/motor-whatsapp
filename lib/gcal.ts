// Google Calendar via Service Account — sin dependencias (JWT RS256 con crypto + REST v3).
// Requiere env GOOGLE_SA_JSON_B64 (base64 del JSON de la service account).

import crypto from 'crypto'

type SA = { client_email: string; private_key: string; token_uri: string }

function loadSA(): SA {
  const b64 = process.env.GOOGLE_SA_JSON_B64
  if (!b64) throw new Error('Falta GOOGLE_SA_JSON_B64')
  const j = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'))
  return { client_email: j.client_email, private_key: j.private_key, token_uri: j.token_uri || 'https://oauth2.googleapis.com/token' }
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url')

// Access token OAuth2 para el scope de Calendar (JWT bearer grant).
export async function getAccessToken(): Promise<string> {
  const sa = loadSA()
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  }))
  const unsigned = `${header}.${claim}`
  const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key)
  const jwt = `${unsigned}.${b64url(sig)}`

  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`token ${res.status}: ${JSON.stringify(data)}`)
  return data.access_token as string
}

const API = 'https://www.googleapis.com/calendar/v3/calendars'

// Mapa micKey -> eventId de los eventos que este sync administra (tag micSync=1).
export async function listarEventosSync(calId: string, token: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  let pageToken: string | undefined
  do {
    const url = new URL(`${API}/${encodeURIComponent(calId)}/events`)
    url.searchParams.set('privateExtendedProperty', 'micSync=1')
    url.searchParams.set('maxResults', '250')
    url.searchParams.set('showDeleted', 'false')
    if (pageToken) url.searchParams.set('pageToken', pageToken)
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (!res.ok) throw new Error(`list ${res.status}: ${JSON.stringify(data)}`)
    for (const ev of data.items ?? []) {
      const key = ev.extendedProperties?.private?.micKey
      if (key) map.set(key, ev.id)
    }
    pageToken = data.nextPageToken
  } while (pageToken)
  return map
}

export type GCalEvento = {
  key: string; fecha: string; fechaFin: string
  summary: string; description: string; colorId: string; reminders: number[]
}

function toResource(e: GCalEvento) {
  return {
    summary: e.summary,
    description: e.description,
    colorId: e.colorId,
    start: { date: e.fecha },
    end: { date: e.fechaFin },
    reminders: { useDefault: false, overrides: e.reminders.map((m) => ({ method: 'popup', minutes: m })) },
    extendedProperties: { private: { micSync: '1', micKey: e.key } },
  }
}

// Inserta o actualiza (PATCH) segun exista el micKey. Devuelve 'created' | 'updated'.
export async function upsertEvento(
  calId: string, token: string, e: GCalEvento, existentes: Map<string, string>,
): Promise<'created' | 'updated'> {
  const eventId = existentes.get(e.key)
  const base = `${API}/${encodeURIComponent(calId)}/events`
  const res = await fetch(eventId ? `${base}/${eventId}` : base, {
    method: eventId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(toResource(e)),
  })
  if (!res.ok) throw new Error(`upsert ${e.key} ${res.status}: ${JSON.stringify(await res.json())}`)
  return eventId ? 'updated' : 'created'
}
