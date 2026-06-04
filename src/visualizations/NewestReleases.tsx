import { useEffect, useMemo, useRef, useState } from 'react'
import { format, fromUnixTime, parseISO } from 'date-fns'
import type { VizProps } from './registry'
import { splitArtists, buildRawArtistSet } from '../utils/artists'
import { ArtistAvatar } from '../components/ArtistAvatar'
import { EntityLink } from '../components/EntityDetail'
import {
  fetchNewestReleaseForArtist,
  getCachedNewestRelease,
  setCachedNewestRelease,
  type NewestRelease,
} from '../api/newReleases'

interface ArtistStat {
  artist: string
  plays: number
  lastPlayed: number
}

interface ReleaseRow extends ArtistStat {
  release: NewestRelease | null
}

interface ScanProgress {
  done: number
  total: number
  artist: string
}

type SortOrder = 'release-newest' | 'release-oldest'

interface ScanStats {
  fromCache: number
  fromApi: number
}

function formatReleaseDate(date?: string): string {
  if (!date) return '—'
  const parsed = parseISO(date)
  if (Number.isNaN(parsed.getTime())) return '—'
  return format(parsed, 'MMM d, yyyy')
}

export function NewestReleases({ scrobbles, splitCollabs }: VizProps) {
  const [maxArtists, setMaxArtists] = useState(30)
  const [minPlays, setMinPlays] = useState(2)
  const [freshDays, setFreshDays] = useState(7)
  const [results, setResults] = useState<ReleaseRow[]>([])
  const [sortOrder, setSortOrder] = useState<SortOrder>('release-newest')
  const [isScanning, setIsScanning] = useState(false)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [scanStats, setScanStats] = useState<ScanStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  const rankedArtists = useMemo(() => {
    const raw = buildRawArtistSet(scrobbles)
    const stats = new Map<string, ArtistStat>()

    for (const scrobble of scrobbles) {
      const artists = splitCollabs ? splitArtists(scrobble.artist, raw) : [scrobble.artist]
      for (const artist of artists) {
        if (!artist.trim()) continue
        const current = stats.get(artist)
        if (!current) {
          stats.set(artist, { artist, plays: 1, lastPlayed: scrobble.timestamp })
          continue
        }
        current.plays += 1
        current.lastPlayed = Math.max(current.lastPlayed, scrobble.timestamp)
      }
    }

    return [...stats.values()]
      .filter(a => a.plays >= minPlays)
      .sort((a, b) => b.plays - a.plays || b.lastPlayed - a.lastPlayed)
      .slice(0, maxArtists)
  }, [scrobbles, splitCollabs, minPlays, maxArtists])

  const handleScan = async () => {
    if (isScanning) {
      abortRef.current?.abort()
      return
    }
    if (rankedArtists.length === 0) return

    const controller = new AbortController()
    abortRef.current = controller
    setIsScanning(true)
    setError(null)
    setScanStats(null)
    setProgress({ done: 0, total: rankedArtists.length, artist: rankedArtists[0].artist })

    try {
      const rows: ReleaseRow[] = []
      const maxAgeMs = Math.max(1, freshDays) * 24 * 60 * 60 * 1000
      let fromCache = 0
      let fromApi = 0
      for (let i = 0; i < rankedArtists.length; i += 1) {
        const artistStat = rankedArtists[i]
        setProgress({ done: i, total: rankedArtists.length, artist: artistStat.artist })

        const cached = getCachedNewestRelease(artistStat.artist, maxAgeMs)
        if (cached.hit) {
          fromCache += 1
          rows.push({ ...artistStat, release: cached.release })
          continue
        }

        const release = await fetchNewestReleaseForArtist(artistStat.artist, controller.signal)
        setCachedNewestRelease(artistStat.artist, release)
        fromApi += 1
        rows.push({ ...artistStat, release })
      }

      setResults(rows)
      setScanStats({ fromCache, fromApi })
      setProgress({ done: rankedArtists.length, total: rankedArtists.length, artist: rankedArtists[rankedArtists.length - 1].artist })
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError(e instanceof Error ? e.message : 'Could not scan artist releases.')
      }
    } finally {
      setIsScanning(false)
    }
  }

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      const aTime = a.release?.releaseDate ? Date.parse(a.release.releaseDate) : 0
      const bTime = b.release?.releaseDate ? Date.parse(b.release.releaseDate) : 0
      if (sortOrder === 'release-oldest') {
        return aTime - bTime || b.plays - a.plays
      }
      return bTime - aTime || b.plays - a.plays
    })
  }, [results, sortOrder])

  if (scrobbles.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data yet.</div>
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-800">Newest Releases</h2>
        <p className="text-sm text-gray-500 mt-1">
          Scan your most-played artists and surface their most recent album release.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm text-gray-600">
            <span className="block mb-1">Artists to scan</span>
            <select
              value={maxArtists}
              onChange={e => setMaxArtists(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
              disabled={isScanning}
            >
              {[10, 20, 30, 50, 75, 100].map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </label>

          <label className="text-sm text-gray-600">
            <span className="block mb-1">Minimum plays</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={minPlays}
              onChange={e => setMinPlays(Math.max(1, Number(e.target.value) || 1))}
              className="w-24 border border-gray-200 rounded-lg px-3 py-1.5"
              disabled={isScanning}
            />
          </label>

          <label className="text-sm text-gray-600">
            <span className="block mb-1">Rescan after (days)</span>
            <input
              type="number"
              min={1}
              max={365}
              value={freshDays}
              onChange={e => setFreshDays(Math.max(1, Number(e.target.value) || 1))}
              className="w-24 border border-gray-200 rounded-lg px-3 py-1.5"
              disabled={isScanning}
            />
          </label>

          <button
            onClick={handleScan}
            disabled={!isScanning && rankedArtists.length === 0}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              isScanning
                ? 'bg-amber-100 hover:bg-amber-200 text-amber-700'
                : 'bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white'
            }`}
          >
            {isScanning ? 'Stop Scan' : `Scan Top ${rankedArtists.length} Artists`}
          </button>
        </div>

        {progress && (
          <div className="mt-3">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-72">
              <div
                className="h-full bg-red-400 rounded-full transition-all"
                style={{ width: `${Math.min(100, (progress.done / Math.max(progress.total, 1)) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {progress.done} / {progress.total} · {progress.artist}
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        {scanStats && (
          <p className="text-xs text-gray-500 mt-2">
            Used cache for {scanStats.fromCache} artists, fetched {scanStats.fromApi} from API.
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex justify-end">
          <label className="text-sm text-gray-600 flex items-center gap-2">
            <span>Sort by release date</span>
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value as SortOrder)}
              className="border border-gray-200 rounded-lg px-2 py-1 bg-white text-sm"
            >
              <option value="release-newest">Newest first</option>
              <option value="release-oldest">Oldest first</option>
            </select>
          </label>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="text-left py-2 px-3 font-medium text-gray-500">Artist</th>
              <th className="text-right py-2 px-3 font-medium text-gray-500">Plays</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500">Newest Release</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500">Release Date</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500 hidden md:table-cell">Last Played</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedResults.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 px-3 text-center text-gray-400">
                  Run a scan to build this list.
                </td>
              </tr>
            ) : (
              sortedResults.map(row => (
                <tr key={row.artist} className="hover:bg-gray-50">
                  <td className="py-2 px-3 font-medium text-gray-800">
                    <div className="flex items-center gap-2">
                      <ArtistAvatar artist={row.artist} />
                      <EntityLink entity={{ kind: 'artist', artist: row.artist }}>{row.artist}</EntityLink>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right text-gray-600">{row.plays.toLocaleString()}</td>
                  <td className="py-2 px-3 text-gray-700">
                    {row.release?.url ? (
                      <a href={row.release.url} target="_blank" rel="noreferrer" className="text-red-600 hover:text-red-700 hover:underline">
                        {row.release.title}
                      </a>
                    ) : (
                      row.release?.title ?? 'No match found'
                    )}
                  </td>
                  <td className="py-2 px-3 text-gray-500">{formatReleaseDate(row.release?.releaseDate)}</td>
                  <td className="py-2 px-3 text-gray-500 hidden md:table-cell">{format(fromUnixTime(row.lastPlayed), 'MMM d, yyyy')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
