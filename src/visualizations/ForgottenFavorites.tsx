import { useMemo, useState } from 'react'
import { format, fromUnixTime } from 'date-fns'
import type { VizProps } from './registry'
import { splitArtists, buildRawArtistSet } from '../utils/artists'
import { ArtistAvatar } from '../components/ArtistAvatar'
import { EntityLink } from '../components/EntityDetail'

interface ArtistStat {
  artist: string
  total: number
  lastPlayed: number
  recentPlays: number
  monthsSince: number
  peakYear: number
  peakYearPlays: number
}

type SortKey = 'artist' | 'total' | 'lastPlayed' | 'peakYear'
type SortDir = 'asc' | 'desc'

export function ForgottenFavorites({ scrobbles, splitCollabs }: VizProps) {
  const [minPlays, setMinPlays] = useState(20)
  const [recentMonths, setRecentMonths] = useState(6)
  const [sortKey, setSortKey] = useState<SortKey>('total')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'artist' ? 'asc' : 'desc')
    }
  }

  const raw = useMemo(() => buildRawArtistSet(scrobbles), [scrobbles])

  const stats = useMemo(() => {
    type Bucket = {
      total: number
      lastPlayed: number
      recentPlays: number
      perYear: Map<number, number>
    }
    const map = new Map<string, Bucket>()
    const now = Date.now() / 1000
    const cutoff = now - recentMonths * 30 * 86400

    for (const s of scrobbles) {
      const artists = splitCollabs ? splitArtists(s.artist, raw) : [s.artist]
      const year = fromUnixTime(s.timestamp).getFullYear()
      for (const a of artists) {
        if (!a) continue
        let b = map.get(a)
        if (!b) {
          b = { total: 0, lastPlayed: 0, recentPlays: 0, perYear: new Map() }
          map.set(a, b)
        }
        b.total++
        if (s.timestamp > b.lastPlayed) b.lastPlayed = s.timestamp
        if (s.timestamp >= cutoff) b.recentPlays++
        b.perYear.set(year, (b.perYear.get(year) ?? 0) + 1)
      }
    }

    const result: ArtistStat[] = []
    for (const [artist, b] of map) {
      if (b.total < minPlays) continue
      if (b.recentPlays > 0) continue
      const peak = [...b.perYear.entries()].sort((a, c) => c[1] - a[1])[0]
      result.push({
        artist,
        total: b.total,
        lastPlayed: b.lastPlayed,
        recentPlays: b.recentPlays,
        monthsSince: (now - b.lastPlayed) / (30 * 86400),
        peakYear: peak[0],
        peakYearPlays: peak[1],
      })
    }

    // Sort by total plays descending — these are your heaviest plays you've abandoned
    result.sort((a, b) => b.total - a.total)
    return result
  }, [scrobbles, splitCollabs, raw, minPlays, recentMonths])

  if (scrobbles.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data yet.</div>
  }

  // The "who's forgotten" set is locked by total plays; user sort only rearranges these 50.
  const top50 = stats.slice(0, 50)
  const maxTotal = top50.reduce((m, s) => s.total > m ? s.total : m, 1)

  const top = useMemo(() => {
    const arr = [...top50]
    arr.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'artist') cmp = a.artist.localeCompare(b.artist)
      else if (sortKey === 'total') cmp = a.total - b.total
      else if (sortKey === 'lastPlayed') cmp = a.lastPlayed - b.lastPlayed
      else cmp = a.peakYear - b.peakYear
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [top50, sortKey, sortDir])

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-semibold text-gray-800">Forgotten Favorites</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Artists with at least {minPlays} all-time plays who haven't shown up in the last {recentMonths} months.
          </p>
        </div>
        <div className="flex gap-3 items-center text-sm flex-wrap">
          <label className="flex items-center gap-2">
            <span className="text-gray-500">Min plays</span>
            <input
              type="number"
              min={1}
              value={minPlays}
              onChange={e => setMinPlays(Math.max(1, +e.target.value || 1))}
              className="w-16 border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-gray-500">Quiet for</span>
            <select
              value={recentMonths}
              onChange={e => setRecentMonths(+e.target.value)}
              className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
            >
              <option value={3}>3 months</option>
              <option value={6}>6 months</option>
              <option value={12}>1 year</option>
              <option value={24}>2 years</option>
              <option value={60}>5 years</option>
            </select>
          </label>
        </div>
      </div>

      {top.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-gray-400">
          Nothing matches — try lowering Min plays or shortening the quiet window.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200">
              <tr className="text-gray-500">
                <th className="text-left py-2 px-2 font-medium w-8">#</th>
                <SortableTh label="Artist" k="artist" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortableTh label="Plays" k="total" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortableTh label="Last played" k="lastPlayed" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortableTh label="Peak" k="peakYear" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {top.map((s, i) => (
                <tr key={s.artist} className="hover:bg-gray-50">
                  <td className="py-2 px-2 text-gray-400 tabular-nums">{i + 1}</td>
                  <td className="py-2 px-2 font-medium text-gray-800 max-w-xs">
                    <div className="flex items-center gap-2">
                      <ArtistAvatar artist={s.artist} />
                      <EntityLink entity={{ kind: 'artist', artist: s.artist }} className="truncate">{s.artist}</EntityLink>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-gray-700 w-48">
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums w-12">{s.total.toLocaleString()}</span>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-400 rounded-full"
                          style={{ width: `${(s.total / maxTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-gray-600 whitespace-nowrap">
                    {format(fromUnixTime(s.lastPlayed), 'MMM yyyy')}
                    <span className="text-gray-400 ml-2 tabular-nums">
                      ({Math.round(s.monthsSince)}mo ago)
                    </span>
                  </td>
                  <td className="py-2 px-2 text-gray-600 tabular-nums whitespace-nowrap">
                    {s.peakYear}
                    <span className="text-gray-400 ml-2">{s.peakYearPlays} plays</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SortableTh({
  label, k, sortKey, sortDir, onSort,
}: {
  label: string
  k: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onSort: (k: SortKey) => void
}) {
  const active = sortKey === k
  return (
    <th className="text-left py-2 px-2 font-medium">
      <button
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 hover:text-gray-700 transition-colors ${active ? 'text-gray-700' : ''}`}
      >
        {label}
        <span className={`text-xs ${active ? 'text-gray-700' : 'text-gray-300'}`}>
          {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  )
}
