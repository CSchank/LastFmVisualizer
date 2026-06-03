import Dexie, { type Table } from 'dexie'
import { isLastFmPlaceholder } from '../utils/lastfmImage'

export interface Scrobble {
  id?: number
  timestamp: number
  artist: string
  artistMbid: string
  album: string
  albumMbid: string
  track: string
  trackMbid: string
  imageUrl?: string
}

export interface SyncState {
  key: string
  value: string | number
}

export interface ArtistImage {
  artist: string
  imageUrl: string | null
}

export interface DashboardWidget {
  i: string
  vizId: string
  x: number
  y: number
  w: number
  h: number
}

export interface Dashboard {
  id?: number
  name: string
  createdAt: number
  widgets: DashboardWidget[]
}

export class LastFmDB extends Dexie {
  scrobbles!: Table<Scrobble, number>
  syncState!: Table<SyncState, string>
  artistImages!: Table<ArtistImage, string>
  dashboards!: Table<Dashboard, number>

  constructor(username: string) {
    super(`LastFmVisualizer_${username}`)
    this.version(1).stores({
      scrobbles: '++id, timestamp, artist, album, track',
      syncState: 'key',
    })
    this.version(2).stores({
      scrobbles: '++id, timestamp, artist, album, track',
      syncState: 'key',
      artistImages: 'artist',
    })
    this.version(3)
      .stores({
        scrobbles: '++id, timestamp, artist, album, track',
        syncState: 'key',
        artistImages: 'artist',
      })
      .upgrade(async tx => {
        await tx.table('scrobbles').toCollection().modify(s => {
          if (isLastFmPlaceholder(s.imageUrl)) s.imageUrl = undefined
        })
        await tx.table('artistImages').toCollection().modify(r => {
          if (isLastFmPlaceholder(r.imageUrl)) r.imageUrl = null
        })
      })
    this.version(4).stores({
      scrobbles: '++id, timestamp, artist, album, track',
      syncState: 'key',
      artistImages: 'artist',
      dashboards: '++id, createdAt',
    })
  }
}

const dbCache = new Map<string, LastFmDB>()

export function getDb(username: string): LastFmDB {
  if (!dbCache.has(username)) {
    dbCache.set(username, new LastFmDB(username))
  }
  return dbCache.get(username)!
}

// ── Query helpers ──────────────────────────────────────────────────────────────

export async function getLatestTimestamp(db: LastFmDB): Promise<number | null> {
  const row = await db.scrobbles.orderBy('timestamp').last()
  return row?.timestamp ?? null
}

export async function getEarliestTimestamp(db: LastFmDB): Promise<number | null> {
  const row = await db.scrobbles.orderBy('timestamp').first()
  return row?.timestamp ?? null
}

export async function getTotalScrobbles(db: LastFmDB): Promise<number> {
  return db.scrobbles.count()
}

export async function getAllScrobbles(db: LastFmDB): Promise<Scrobble[]> {
  return db.scrobbles.orderBy('timestamp').toArray()
}

export async function getSyncMeta(db: LastFmDB, key: string): Promise<string | number | null> {
  const row = await db.syncState.get(key)
  return row?.value ?? null
}

export async function setSyncMeta(db: LastFmDB, key: string, value: string | number): Promise<void> {
  await db.syncState.put({ key, value })
}

// ── Export / Import ────────────────────────────────────────────────────────────

export interface ExportData {
  version: number
  exportedAt: string
  scrobbles: Omit<Scrobble, 'id'>[]
}

export async function exportToJSON(db: LastFmDB, username: string): Promise<void> {
  const scrobbles = await getAllScrobbles(db)
  const payload: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    scrobbles: scrobbles.map(({ id: _id, ...rest }) => rest),
  }
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `lastfm-${username}-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importFromJSON(db: LastFmDB, file: File): Promise<{ added: number; skipped: number }> {
  const text = await file.text()
  const data: ExportData = JSON.parse(text)

  if (data.version !== 1 || !Array.isArray(data.scrobbles)) {
    throw new Error('Unrecognised file format.')
  }

  const existing = new Set(
    (await db.scrobbles.orderBy('timestamp').keys()) as number[]
  )

  const toAdd = data.scrobbles.filter(s => !existing.has(s.timestamp))
  if (toAdd.length > 0) {
    await db.scrobbles.bulkAdd(toAdd)
  }

  return { added: toAdd.length, skipped: data.scrobbles.length - toAdd.length }
}
