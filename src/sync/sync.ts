import { LastFmApi, type RawTrack } from '../api/lastfm'
import { type LastFmDB, getLatestTimestamp, getEarliestTimestamp, getSyncMeta, setSyncMeta, type Scrobble } from '../db'

export type SyncProgress = {
  phase: 'idle' | 'syncing' | 'done' | 'error'
  fetched: number
  total: number
  message: string
}

function trackToScrobble(t: RawTrack): Scrobble | null {
  if (!t.date) return null
  const image = t.image?.find(i => i.size === 'extralarge') ?? t.image?.find(i => i.size === 'large')
  const imageUrl = image?.['#text'] || undefined
  return {
    timestamp: parseInt(t.date.uts, 10),
    artist: t.artist['#text'],
    artistMbid: t.artist.mbid ?? '',
    album: t.album['#text'],
    albumMbid: t.album.mbid ?? '',
    track: t.name,
    trackMbid: t.mbid ?? '',
    imageUrl,
  }
}

async function fetchRange(
  api: LastFmApi,
  db: LastFmDB,
  params: { from?: number; to?: number },
  label: string,
  onProgress: (p: SyncProgress) => void,
): Promise<number> {
  let page = 1
  let totalPages = 1
  let fetched = 0

  do {
    const result = await api.getRecentTracksPage(page, params.from, params.to)
    const attr = result.recenttracks['@attr']
    totalPages = parseInt(attr.totalPages, 10)
    const total = parseInt(attr.total, 10)

    const tracks = Array.isArray(result.recenttracks.track)
      ? result.recenttracks.track
      : [result.recenttracks.track]

    const scrobbles = tracks.map(trackToScrobble).filter((s): s is Scrobble => s !== null)

    if (scrobbles.length > 0) {
      await db.scrobbles.bulkAdd(scrobbles)
      fetched += scrobbles.length
    }

    onProgress({
      phase: 'syncing',
      fetched,
      total,
      message: `${label}: page ${page} / ${totalPages} (${fetched} fetched)`,
    })

    page++
    await new Promise(r => setTimeout(r, 210))
  } while (page <= totalPages)

  return fetched
}

export async function syncScrobbles(
  api: LastFmApi,
  db: LastFmDB,
  onProgress: (p: SyncProgress) => void,
): Promise<void> {
  onProgress({ phase: 'syncing', fetched: 0, total: 0, message: 'Starting sync…' })

  const [latestTs, earliestTs, historicalComplete] = await Promise.all([
    getLatestTimestamp(db),
    getEarliestTimestamp(db),
    getSyncMeta(db, 'historicalSyncComplete'),
  ])

  let totalFetched = 0

  try {
    if (latestTs === null && earliestTs === null) {
      totalFetched = await fetchRange(api, db, {}, 'Full sync', onProgress)
      await setSyncMeta(db, 'historicalSyncComplete', 1)
    } else {
      if (latestTs !== null) {
        totalFetched += await fetchRange(api, db, { from: latestTs + 1 }, 'New scrobbles', onProgress)
      }
      if (!historicalComplete && earliestTs !== null) {
        totalFetched += await fetchRange(api, db, { to: earliestTs - 1 }, 'Historical backfill', onProgress)
        await setSyncMeta(db, 'historicalSyncComplete', 1)
      }
    }

    await setSyncMeta(db, 'lastSyncAt', Date.now())
    onProgress({
      phase: 'done',
      fetched: totalFetched,
      total: totalFetched,
      message: totalFetched > 0 ? `Sync complete — ${totalFetched} scrobbles added` : 'Already up to date',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    onProgress({ phase: 'error', fetched: totalFetched, total: 0, message: msg })
    throw err
  }
}
