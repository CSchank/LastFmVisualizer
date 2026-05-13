import type { LastFmDB } from '../db'

const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/'
const WIKI_BASE = 'https://en.wikipedia.org/api/rest_v1/page/summary/'

const memCache = new Map<string, string | null>()
const inflight = new Map<string, Promise<string | null>>()

async function fetchFromLastFm(artist: string, apiKey: string): Promise<string | null> {
  const url = new URL(LASTFM_BASE)
  url.searchParams.set('method', 'artist.getInfo')
  url.searchParams.set('artist', artist)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('format', 'json')

  const data = await fetch(url.toString()).then(r => r.json())
  const images: { '#text': string; size: string }[] = data.artist?.image ?? []
  const img = images.find(i => i.size === 'extralarge') ?? images.find(i => i.size === 'large')
  return img?.['#text'] || null
}

async function fetchFromWikipedia(artist: string): Promise<string | null> {
  const response = await fetch(WIKI_BASE + encodeURIComponent(artist))
  if (!response.ok) return null
  const data = await response.json()
  // Reject disambiguation pages — they have no meaningful thumbnail for the artist
  if (data.type === 'disambiguation') return null
  return (data.thumbnail?.source as string | undefined) ?? null
}

async function fetchImage(artist: string, apiKey: string): Promise<string | null> {
  const lastfm = await fetchFromLastFm(artist, apiKey).catch(() => null)
  if (lastfm) return lastfm
  return fetchFromWikipedia(artist).catch(() => null)
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

  if (!inflight.has(artist)) {
    inflight.set(artist, fetchImage(artist, apiKey).finally(() => inflight.delete(artist)))
  }
  const imageUrl = await inflight.get(artist)!
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
  const withImage = new Set(
    (await db.artistImages.toArray())
      .filter(r => r.imageUrl !== null)
      .map(r => r.artist),
  )
  const missing = allArtists.filter(a => !withImage.has(a))

  let done = 0
  for (const artist of missing) {
    if (signal.aborted) break
    const imageUrl = await fetchImage(artist, apiKey)
    memCache.set(artist, imageUrl)
    await db.artistImages.put({ artist, imageUrl })
    done++
    onProgress({ done, total: missing.length, artist })
    await new Promise(r => setTimeout(r, 210))
  }

  return done
}
