import type { LastFmDB } from '../db'
import { fetchArtistImageFromSpotify, getSpotifyCredentials } from './spotify'
import { fetchArtistImageFromAudioDb } from './theaudiodb'
import { isLastFmPlaceholder } from '../utils/lastfmImage'

const LASTFM_BASE = 'https://ws.audioscrobbler.com/2.0/'
const WIKI_BASE = 'https://en.wikipedia.org/api/rest_v1/page/summary/'

const memCache = new Map<string, string | null>()
const inflight = new Map<string, Promise<string | null>>()

export type ImageSource = 'theaudiodb' | 'lastfm' | 'spotify' | 'wikipedia' | 'none'

export interface ImageFetchLogEntry {
  artist: string
  source: ImageSource
  url: string | null
}

async function fetchFromLastFm(artist: string, apiKey: string): Promise<string | null> {
  const url = new URL(LASTFM_BASE)
  url.searchParams.set('method', 'artist.getInfo')
  url.searchParams.set('artist', artist)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('format', 'json')

  const data = await fetch(url.toString()).then(r => r.json())
  const images: { '#text': string; size: string }[] = data.artist?.image ?? []
  const img = images.find(i => i.size === 'extralarge') ?? images.find(i => i.size === 'large')
  const imageUrl = img?.['#text'] || null
  return isLastFmPlaceholder(imageUrl) ? null : imageUrl
}

async function fetchFromWikipedia(artist: string): Promise<string | null> {
  const response = await fetch(WIKI_BASE + encodeURIComponent(artist))
  if (!response.ok) return null
  const data = await response.json()
  if (data.type === 'disambiguation') return null
  return (data.thumbnail?.source as string | undefined) ?? null
}

async function fetchImageWithSource(
  artist: string,
  apiKey: string,
): Promise<{ url: string | null; source: ImageSource }> {
  const audioDb = await fetchArtistImageFromAudioDb(artist).catch(() => null)
  if (audioDb) return { url: audioDb, source: 'theaudiodb' }

  const lastfm = await fetchFromLastFm(artist, apiKey).catch(() => null)
  if (lastfm) return { url: lastfm, source: 'lastfm' }

  const creds = getSpotifyCredentials()
  if (creds) {
    const url = await fetchArtistImageFromSpotify(artist, creds.clientId, creds.clientSecret).catch(() => null)
    if (url) return { url, source: 'spotify' }
  }

  const wiki = await fetchFromWikipedia(artist).catch(() => null)
  if (wiki) return { url: wiki, source: 'wikipedia' }

  return { url: null, source: 'none' }
}

export async function getArtistImage(
  artist: string,
  apiKey: string,
  db: LastFmDB,
): Promise<string | null> {
  if (memCache.has(artist)) return memCache.get(artist)!

  const stored = await db.artistImages.get(artist)
  if (stored !== undefined && !isLastFmPlaceholder(stored.imageUrl)) {
    memCache.set(artist, stored.imageUrl)
    return stored.imageUrl
  }

  if (!inflight.has(artist)) {
    const p = fetchImageWithSource(artist, apiKey)
      .then(({ url, source }) => {
        console.log(`[artist-image] ${artist}: ${source}`)
        return url
      })
      .finally(() => inflight.delete(artist))
    inflight.set(artist, p)
  }
  const imageUrl = await inflight.get(artist)!
  memCache.set(artist, imageUrl)
  await db.artistImages.put({ artist, imageUrl })
  return imageUrl
}

export type BackfillProgress = { done: number; total: number; artist: string }

export interface BackfillResult {
  found: number
  log: ImageFetchLogEntry[]
}

export async function backfillArtistImages(
  db: LastFmDB,
  apiKey: string,
  onProgress: (p: BackfillProgress) => void,
  signal: AbortSignal,
): Promise<BackfillResult> {
  const allArtists = (await db.scrobbles.orderBy('artist').uniqueKeys()) as string[]
  const withImage = new Set(
    (await db.artistImages.toArray())
      .filter(r => r.imageUrl !== null && !isLastFmPlaceholder(r.imageUrl))
      .map(r => r.artist),
  )
  const missing = allArtists.filter(a => !withImage.has(a))

  let done = 0
  let found = 0
  const log: ImageFetchLogEntry[] = []

  for (const artist of missing) {
    if (signal.aborted) break
    const { url: imageUrl, source } = await fetchImageWithSource(artist, apiKey)
    log.push({ artist, source, url: imageUrl })
    memCache.set(artist, imageUrl)
    await db.artistImages.put({ artist, imageUrl })
    if (imageUrl) found++
    done++
    onProgress({ done, total: missing.length, artist })
    await new Promise(r => setTimeout(r, 210))
  }

  return { found, log }
}
