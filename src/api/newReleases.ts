interface ITunesResult {
  artistName?: string
  collectionName?: string
  releaseDate?: string
  collectionViewUrl?: string
}

interface ITunesSearchResponse {
  results?: ITunesResult[]
}

export interface NewestRelease {
  title: string
  releaseDate: string
  url?: string
}

interface CachedNewestRelease {
  scannedAt: number
  release: NewestRelease | null
}

const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search'
const RELEASE_CACHE_KEY = 'lastfm_newest_release_cache_v1'

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function readCache(): Record<string, CachedNewestRelease> {
  if (typeof localStorage === 'undefined') return {}
  const raw = localStorage.getItem(RELEASE_CACHE_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, CachedNewestRelease>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (error) {
    console.error('Invalid newest-release cache payload:', error)
    localStorage.removeItem(RELEASE_CACHE_KEY)
    return {}
  }
}

function writeCache(cache: Record<string, CachedNewestRelease>): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(RELEASE_CACHE_KEY, JSON.stringify(cache))
}

export function getCachedNewestRelease(
  artist: string,
  maxAgeMs: number,
): { hit: boolean; release: NewestRelease | null } {
  const cache = readCache()
  const entry = cache[normalize(artist)]
  if (!entry) return { hit: false, release: null }
  if (Date.now() - entry.scannedAt > maxAgeMs) return { hit: false, release: null }
  return { hit: true, release: entry.release }
}

export function setCachedNewestRelease(
  artist: string,
  release: NewestRelease | null,
): void {
  const cache = readCache()
  cache[normalize(artist)] = { scannedAt: Date.now(), release }
  writeCache(cache)
}

export async function fetchNewestReleaseForArtist(
  artist: string,
  signal?: AbortSignal,
): Promise<NewestRelease | null> {
  const url = new URL(ITUNES_SEARCH_URL)
  url.searchParams.set('term', artist)
  url.searchParams.set('entity', 'album')
  url.searchParams.set('attribute', 'artistTerm')
  url.searchParams.set('limit', '50')

  const res = await fetch(url.toString(), { signal })
  if (!res.ok) throw new Error(`Release lookup failed (${res.status}) for ${artist}`)

  const data = (await res.json()) as ITunesSearchResponse
  const results = data.results ?? []
  if (results.length === 0) return null

  const normArtist = normalize(artist)
  const exactMatches = results.filter(r => r.artistName && normalize(r.artistName) === normArtist)
  const candidates = exactMatches.length > 0 ? exactMatches : results

  const uniqueAlbums = new Map<string, ITunesResult>()
  for (const r of candidates) {
    if (!r.collectionName || !r.releaseDate) continue
    const key = `${normalize(r.artistName ?? '')}::${normalize(r.collectionName)}`
    const prev = uniqueAlbums.get(key)
    if (!prev || (Date.parse(r.releaseDate) > Date.parse(prev.releaseDate ?? ''))) {
      uniqueAlbums.set(key, r)
    }
  }

  const newest = [...uniqueAlbums.values()]
    .sort((a, b) => Date.parse(b.releaseDate ?? '') - Date.parse(a.releaseDate ?? ''))[0]

  if (!newest?.collectionName || !newest.releaseDate) return null

  return {
    title: newest.collectionName,
    releaseDate: newest.releaseDate,
    url: newest.collectionViewUrl,
  }
}
