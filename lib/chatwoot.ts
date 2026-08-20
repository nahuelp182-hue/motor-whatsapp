// Espejo de las conversaciones de WhatsApp hacia Chatwoot (bandeja de lectura para el
// equipo). NO reemplaza al bot ni a ig_diag: es una copia en paralelo de cada mensaje
// entrante/saliente. Todas las llamadas son fire-and-forget y tragan sus propios errores
// — si Chatwoot está caído o mal configurado, el bot nunca se entera.

const CW_URL     = process.env.CHATWOOT_URL ?? ''
const CW_TOKEN   = process.env.CHATWOOT_API_TOKEN ?? ''
const CW_ACCOUNT = process.env.CHATWOOT_ACCOUNT_ID ?? ''
const CW_INBOX   = process.env.CHATWOOT_INBOX_ID ?? ''

const habilitado = !!(CW_URL && CW_TOKEN && CW_ACCOUNT && CW_INBOX)

type ContactoCw = { id: number; identifier?: string; phone_number?: string }
type ConversacionCw = { id: number; inbox_id: number }

// Caddy descarta cualquier header con guion bajo al parsear el pedido entrante (verificado
// 20/08/26: "api_access_token" nunca llega al backend, "X-Cw-Token" sí). El Caddyfile del
// VPS traduce X-Cw-Token → Api_access_token antes de reenviarlo a Chatwoot, así que acá se
// manda con guion.
async function cwFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CW_URL}/api/v1/accounts/${CW_ACCOUNT}${path}`, {
    ...init,
    headers: { 'X-Cw-Token': CW_TOKEN, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    throw new Error(`Chatwoot ${path} -> ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`)
  }
  return res.json() as Promise<T>
}

async function buscarOCrearContacto(phone: string, nombre?: string): Promise<number> {
  const identifier = `wa:${phone}`
  const busq = await cwFetch<{ payload?: ContactoCw[] }>(`/contacts/search?q=${encodeURIComponent(phone)}`)
  const existente = (busq.payload ?? []).find((c) => c.identifier === identifier)
  if (existente) return existente.id

  const creado = await cwFetch<{ payload: { contact: ContactoCw } }>(`/contacts`, {
    method: 'POST',
    body: JSON.stringify({ identifier, name: nombre || phone, phone_number: `+${phone}` }),
  })
  return creado.payload.contact.id
}

async function buscarOCrearConversacion(contactId: number, phone: string): Promise<number> {
  const convs = await cwFetch<{ payload?: ConversacionCw[] }>(`/contacts/${contactId}/conversations`)
  const enElInbox = (convs.payload ?? []).find((c) => String(c.inbox_id) === String(CW_INBOX))
  if (enElInbox) return enElInbox.id

  const creada = await cwFetch<{ id: number }>(`/conversations`, {
    method: 'POST',
    body: JSON.stringify({ source_id: `wa:${phone}`, inbox_id: Number(CW_INBOX), contact_id: contactId }),
  })
  return creada.id
}

async function conversacionDe(phone: string, nombre?: string): Promise<number> {
  const contactId = await buscarOCrearContacto(phone, nombre)
  return buscarOCrearConversacion(contactId, phone)
}

async function postearMensaje(
  phone: string, texto: string, tipo: 'incoming' | 'outgoing', nombre?: string,
): Promise<void> {
  if (!texto.trim()) return
  const conversationId = await conversacionDe(phone, nombre)
  await cwFetch(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content: texto, message_type: tipo }),
  })
}

// Ambas se llaman con `await` desde el webhook (dentro de after(), en segundo plano —
// nunca antes de responderle a Meta). Tragan su propio error: si Chatwoot falla, el bot
// nunca se entera. El await SÍ es necesario acá: en Vercel una promesa sin await que sea
// la última acción de la tarea puede quedar cortada cuando el runtime da por terminada la
// función, antes de que el POST a Chatwoot llegue a salir (visto en vivo el 20/08/26: el
// mensaje entrante se espejaba bien —tenía 20 s de debounce detrás para terminar en paz—
// pero la respuesta saliente, al ser la última acción de la tarea, nunca llegaba).

// Mensaje del cliente hacia el bot.
export async function espejarEntrante(phone: string, texto: string, nombre?: string): Promise<void> {
  if (!habilitado) return
  try {
    await postearMensaje(phone, texto, 'incoming', nombre)
  } catch (e) {
    console.error('Chatwoot mirror (in) error:', e)
  }
}

// Respuesta del bot (o del equipo) hacia el cliente.
export async function espejarSaliente(phone: string, texto: string): Promise<void> {
  if (!habilitado) return
  try {
    await postearMensaje(phone, texto, 'outgoing')
  } catch (e) {
    console.error('Chatwoot mirror (out) error:', e)
  }
}
