// Access token de Google a partir del refresh token de la cuenta.
//
// Vivía inline en /api/performance. Se sacó acá cuando Operación necesitó GA4: dos copias
// de la misma función terminan divergiendo en cuanto una sola de las dos aprende algo (un
// scope nuevo, un manejo de error distinto), y el bug que eso produce aparece en una
// pantalla y no en la otra, que es la forma más cara de encontrarlo.
//
// Ojo con el scope: el mismo client OAuth se usa para Ads, GA4 y Business Profile, pero cada
// refresh token trae los suyos. GOOGLE_REFRESH_TOKEN es el de Ads/GA4; las reseñas de Google
// usan uno distinto a propósito.

let cache: { token: string; expira: number } | null = null

export async function tokenGoogle(): Promise<string | null> {
  // Google devuelve tokens de 1 h. Sin caché, cada pantalla que mire GA4 gasta un round-trip
  // extra contra el endpoint de OAuth antes de poder preguntar nada.
  if (cache && Date.now() < cache.expira) return cache.token

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN
  if (!clientId || !clientSecret || !refreshToken) return null

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId, client_secret: clientSecret,
        refresh_token: refreshToken, grant_type: 'refresh_token',
      }),
    })
    const data = (await res.json()) as { access_token?: string; expires_in?: number }
    if (!data.access_token) return null
    // Se descuentan 60 s del vencimiento: un token que expira mientras viaja la request
    // falla con un 401 que no dice nada útil.
    cache = { token: data.access_token, expira: Date.now() + ((data.expires_in ?? 3600) - 60) * 1000 }
    return data.access_token
  } catch {
    return null
  }
}
