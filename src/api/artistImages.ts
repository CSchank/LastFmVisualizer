import type { LastFmDB } from '../db'

const BASE = 'https://ws.audioscrobbler.com/2.0/'

// In-memory cache to avoid redundant DB reads within a session
const memCache = new Map<string, string | null>()
const inflight = new Map<string, Promise<string | null>>()

async function fetchFromApi(artist: string, apiKey: string): Promise<string | null> {
  if (inflight.has(artist)) return inflight.get(artist)!

  const url = new URL(BASE)
  url.searchParams.set('method', 'artist.getInfo')
  url.searchParams.set('artist', artist)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('format', 'json')

  const p = fetch(url.toString())
    .then(r => r.json())
    .then(data => {
      const images: { '#text': string; size: string }[] = data.artist?.image ?? []
      const img = images.find(i => i.size === 'extralarge') ?? images.find(i => i.size === 'large')
      return img?.['#text'] || null
    })
    .catch(() => null)

  inflight.set(artist, p)
  return p
}

export async function getArtistImage(
  artist: string,
  apiKey: string,
  db: LastFmDB,
): Promise<string | null> {
  if (memCache.has(artist)) return memCache.get(artist)!

  const stored = await db.artistImages.get(artist)
  if (stored !== undefined) {
    memCache.set(artist, stored.imageUrl)
    return stored.imageUrl
  }

  const imageUrl = await fetchFromApi(artist, apiKey)
  memCache.set(artist, imageUrl)
  await db.artistImages.put({ artist, imageUrl })
  return imageUrl
}

export type BackfillProgress = { done: number; total: number; artist: string }

export async function backfillArtistImages(
  db: LastFmDB,
  apiKey: string,
  onProgress: (p: BackfillProgress) => void,
  signal: AbortSignal,
): Promise<number> {
  const allArtists = (await db.scrobbles.orderBy('artist').uniqueKeys()) as string[]
  const fetched = new Set((await db.artistImages.toCollection().primaryKeys()) as string[])
  const missing = allArtists.filter(a => !fetched.has(a))

  let done = 0
  for (const artist of missing) {
    if (signal.aborted) break
    const imageUrl = await fetchFromApi(artist, apiKey)
    memCache.set(artist, imageUrl)
    await db.artistImages.put({ artist, imageUrl })
    done++
    onProgress({ done, total: missing.length, artist })
    await new Promise(r => setTimeout(r, 210))
  }

  return done
}
