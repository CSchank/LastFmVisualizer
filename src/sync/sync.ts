import { LastFmApi, type RawTrack } from '../api/lastfm'
import { type LastFmDB, getLatestTimestamp, getEarliestTimestamp, getSyncMeta, setSyncMeta, type Scrobble } from '../db'
import { isLastFmPlaceholder } from '../utils/lastfmImage'

export type SyncProgress = {
  phase: 'idle' | 'syncing' | 'done' | 'error'
  fetched: number
  total: number
  message: string
}

function trackToScrobble(t: RawTrack): Scrobble | null {
  if (!t.date) return null
  const image = t.image?.find(i => i.size === 'extralarge') ?? t.image?.find(i => i.size === 'large')
  const rawImageUrl = image?.['#text'] || undefined
  const imageUrl = isLastFmPlaceholder(rawImageUrl) ? undefined : rawImageUrl
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

function fieldsChanged(a: Scrobble, b: Scrobble): boolean {
  return a.artist !== b.artist
    || a.album !== b.album
    || a.track !== b.track
    || a.artistMbid !== b.artistMbid
    || a.albumMbid !== b.albumMbid
    || a.trackMbid !== b.trackMbid
    || a.imageUrl !== b.imageUrl
}

export type ResyncResult = { updated: number; added: number; removed: number; scanned: number }

// Re-fetch a recent window and reconcile it against the local DB, treating
// Last.fm as the source of truth for that range. Unlike syncScrobbles (which
// only ever fetches never-seen-before time ranges), this re-reads scrobbles we
// already have so edits — e.g. a corrected artist name, which keeps the same
// timestamp — and deletions made on Last.fm propagate. Last.fm only allows
// editing scrobbles within ~2 weeks, so a small window covers every editable play.
export async function resyncRecent(
  api: LastFmApi,
  db: LastFmDB,
  sinceTimestamp: number,
  onProgress: (p: SyncProgress) => void,
): Promise<ResyncResult> {
  onProgress({ phase: 'syncing', fetched: 0, total: 0, message: 'Re-syncing recent scrobbles…' })

  const fetched: Scrobble[] = []
  let page = 1
  let totalPages = 1

  try {
    do {
      const result = await api.getRecentTracksPage(page, sinceTimestamp, undefined)
      const attr = result.recenttracks['@attr']
      totalPages = parseInt(attr.totalPages, 10)
      const total = parseInt(attr.total, 10)

      const tracks = Array.isArray(result.recenttracks.track)
        ? result.recenttracks.track
        : [result.recenttracks.track]

      for (const s of tracks.map(trackToScrobble)) {
        if (s) fetched.push(s)
      }

      onProgress({
        phase: 'syncing',
        fetched: fetched.length,
        total,
        message: `Re-sync: page ${page} / ${totalPages} (${fetched.length} scanned)`,
      })

      page++
      await new Promise(r => setTimeout(r, 210))
    } while (page <= totalPages)

    // Reconcile only after every page is in hand — a mid-fetch error throws
    // above and skips this, so a partial pull never deletes real rows.
    const existing = await db.scrobbles.where('timestamp').aboveOrEqual(sinceTimestamp).toArray()

    const byTs = (rows: Scrobble[]) => {
      const m = new Map<number, Scrobble[]>()
      for (const r of rows) {
        const arr = m.get(r.timestamp)
        if (arr) arr.push(r); else m.set(r.timestamp, [r])
      }
      return m
    }
    const exByTs = byTs(existing)
    const feByTs = byTs(fetched)

    const toPut: Scrobble[] = []
    const toDelete: number[] = []
    let updated = 0, added = 0, removed = 0

    for (const ts of new Set([...exByTs.keys(), ...feByTs.keys()])) {
      const ex = exByTs.get(ts) ?? []
      const fe = feByTs.get(ts) ?? []
      const paired = Math.min(ex.length, fe.length)
      for (let i = 0; i < paired; i++) {
        if (fieldsChanged(ex[i], fe[i])) {
          toPut.push({ ...fe[i], id: ex[i].id })
          updated++
        }
      }
      for (let i = paired; i < fe.length; i++) { toPut.push(fe[i]); added++ }
      for (let i = paired; i < ex.length; i++) { toDelete.push(ex[i].id!); removed++ }
    }

    if (toPut.length > 0) await db.scrobbles.bulkPut(toPut)
    if (toDelete.length > 0) await db.scrobbles.bulkDelete(toDelete)

    await setSyncMeta(db, 'lastSyncAt', Date.now())

    onProgress({
      phase: 'done',
      fetched: fetched.length,
      total: fetched.length,
      message: `Re-sync complete — ${updated} updated, ${added} added, ${removed} removed`,
    })
    return { updated, added, removed, scanned: fetched.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    onProgress({ phase: 'error', fetched: fetched.length, total: 0, message: msg })
    throw err
  }
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
