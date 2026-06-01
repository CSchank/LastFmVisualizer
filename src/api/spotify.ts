const CLIENT_ID_KEY = 'spotify_client_id'
const CLIENT_SECRET_KEY = 'spotify_client_secret'

let tokenCache: { token: string; expiresAt: number } | null = null

export function getSpotifyCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = localStorage.getItem(CLIENT_ID_KEY)
  const clientSecret = localStorage.getItem(CLIENT_SECRET_KEY)
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

export function saveSpotifyCredentials(clientId: string, clientSecret: string): void {
  localStorage.setItem(CLIENT_ID_KEY, clientId.trim())
  localStorage.setItem(CLIENT_SECRET_KEY, clientSecret.trim())
  tokenCache = null
}

export function clearSpotifyCredentials(): void {
  localStorage.removeItem(CLIENT_ID_KEY)
  localStorage.removeItem(CLIENT_SECRET_KEY)
  tokenCache = null
}

async function getAccessToken(clientId: string, clientSecret: string): Promise<string | null> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.token

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + btoa(`${clientId}:${clientSecret}`),
    },
    body: 'grant_type=client_credentials',
  })
  if (!response.ok) return null

  const data = await response.json()
  tokenCache = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 }
  return tokenCache.token
}

export async function fetchArtistImageFromSpotify(
  artist: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  const token = await getAccessToken(clientId, clientSecret)
  if (!token) return null

  const url = new URL('https://api.spotify.com/v1/search')
  url.searchParams.set('q', artist)
  url.searchParams.set('type', 'artist')
  url.searchParams.set('limit', '1')

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) return null

  const data = await response.json()
  const images: { url: string; width: number; height: number }[] =
    data.artists?.items?.[0]?.images ?? []

  // Prefer a medium-ish image (~300-640px); fall back to whatever is first (largest)
  return (images.find(i => i.width >= 300 && i.width <= 640) ?? images[0])?.url ?? null
}
