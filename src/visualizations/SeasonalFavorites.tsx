import { useMemo, useState } from 'react'
import { fromUnixTime } from 'date-fns'
import type { VizProps } from './registry'
import { splitArtists, buildRawArtistSet } from '../utils/artists'
import { ArtistAvatar } from '../components/ArtistAvatar'
import { EntityLink, entityFromComposite } from '../components/EntityDetail'

type Dimension = 'artist' | 'album' | 'track'
type SeasonId = 'spring' | 'summer' | 'fall' | 'winter'
type SortMode = 'lift' | 'plays'

interface SeasonConfig {
  id: SeasonId
  label: string
  months: number[]
}

interface Row {
  name: string
  seasonPlays: number
  offSeasonPlays: number
  seasonShare: number
  offSeasonShare: number
  lift: number
}

const SEASONS: SeasonConfig[] = [
  { id: 'spring', label: 'Spring', months: [2, 3, 4] },
  { id: 'summer', label: 'Summer', months: [5, 6, 7] },
  { id: 'fall', label: 'Fall', months: [8, 9, 10] },
  { id: 'winter', label: 'Winter', months: [11, 0, 1] },
]

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

function formatLift(value: number): string {
  if (!Number.isFinite(value)) return '∞'
  return `${value.toFixed(2)}x`
}

export function SeasonalFavorites({ scrobbles, splitCollabs }: VizProps) {
  const [season, setSeason] = useState<SeasonId>('summer')
  const [dimension, setDimension] = useState<Dimension>('artist')
  const [sortMode, setSortMode] = useState<SortMode>('lift')
  const [minSeasonPlays, setMinSeasonPlays] = useState(5)

  const rawArtists = useMemo(() => buildRawArtistSet(scrobbles), [scrobbles])

  const rows = useMemo(() => {
    const selected = SEASONS.find(s => s.id === season)
    if (!selected) return []

    const seasonMonthSet = new Set(selected.months)
    const seasonCounts = new Map<string, number>()
    const offCounts = new Map<string, number>()
    let totalSeason = 0
    let totalOff = 0

    for (const scrobble of scrobbles) {
      const month = fromUnixTime(scrobble.timestamp).getMonth()
      const inSeason = seasonMonthSet.has(month)
      const keys = dimension === 'artist'
        ? (splitCollabs ? splitArtists(scrobble.artist, rawArtists) : [scrobble.artist])
        : [dimension === 'album' ? `${scrobble.album} — ${scrobble.artist}` : `${scrobble.track} — ${scrobble.artist}`]

      for (const keyRaw of keys) {
        const key = keyRaw.trim()
        if (!key) continue
        if (inSeason) {
          seasonCounts.set(key, (seasonCounts.get(key) ?? 0) + 1)
          totalSeason += 1
        } else {
          offCounts.set(key, (offCounts.get(key) ?? 0) + 1)
          totalOff += 1
        }
      }
    }

    const result: Row[] = []
    for (const [name, seasonPlays] of seasonCounts) {
      if (seasonPlays < minSeasonPlays) continue
      const offSeasonPlays = offCounts.get(name) ?? 0
      const seasonShare = totalSeason > 0 ? seasonPlays / totalSeason : 0
      const offSeasonShare = totalOff > 0 ? offSeasonPlays / totalOff : 0
      const lift = offSeasonShare > 0
        ? seasonShare / offSeasonShare
        : seasonShare > 0 ? Number.POSITIVE_INFINITY : 0
      result.push({ name, seasonPlays, offSeasonPlays, seasonShare, offSeasonShare, lift })
    }

    result.sort((a, b) => {
      if (sortMode === 'plays') {
        return b.seasonPlays - a.seasonPlays || b.lift - a.lift
      }
      return b.lift - a.lift || b.seasonPlays - a.seasonPlays
    })

    return result.slice(0, 100)
  }, [scrobbles, season, dimension, sortMode, minSeasonPlays, splitCollabs, rawArtists])

  if (scrobbles.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data yet.</div>
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-gray-800">Seasonal Favorites</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Find artists, albums, or tracks that over-index in a specific season.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1">
          {SEASONS.map(s => (
            <button
              key={s.id}
              onClick={() => setSeason(s.id)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                season === s.id ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {(['artist', 'album', 'track'] as Dimension[]).map(d => (
            <button
              key={d}
              onClick={() => setDimension(d)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                dimension === d ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}s
            </button>
          ))}
        </div>

        <label className="text-sm text-gray-600">
          <span className="block mb-1">Sort by</span>
          <select
            value={sortMode}
            onChange={e => setSortMode(e.target.value as SortMode)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="lift">Seasonality lift</option>
            <option value="plays">Season plays</option>
          </select>
        </label>

        <label className="text-sm text-gray-600">
          <span className="block mb-1">Min season plays</span>
          <input
            type="number"
            min={1}
            max={1000}
            value={minSeasonPlays}
            onChange={e => setMinSeasonPlays(Math.max(1, Number(e.target.value) || 1))}
            className="w-24 border border-gray-200 rounded-lg px-3 py-1.5"
          />
        </label>
      </div>

      <div className="overflow-auto max-h-[620px]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white border-b border-gray-200">
            <tr>
              <th className="text-left py-2 px-3 font-medium text-gray-500">#</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500">{dimension === 'artist' ? 'Artist' : dimension === 'album' ? 'Album' : 'Track'}</th>
              <th className="text-right py-2 px-3 font-medium text-gray-500">Season Plays</th>
              <th className="text-right py-2 px-3 font-medium text-gray-500">Off-season Plays</th>
              <th className="text-right py-2 px-3 font-medium text-gray-500">Season Share</th>
              <th className="text-right py-2 px-3 font-medium text-gray-500">Lift</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 px-3 text-center text-gray-400">
                  No seasonal matches. Try lowering the minimum season plays.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={row.name} className="hover:bg-gray-50">
                  <td className="py-2 px-3 text-gray-400">{i + 1}</td>
                  <td className="py-2 px-3 font-medium text-gray-800 max-w-[34rem]" title={row.name}>
                    <div className="flex items-center gap-2">
                      {dimension === 'artist' && <ArtistAvatar artist={row.name} />}
                      <EntityLink entity={entityFromComposite(row.name, dimension)} className="truncate">{row.name}</EntityLink>
                    </div>
                  </td>
                  <td className="py-2 px-3 text-right text-gray-700">{row.seasonPlays.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-gray-600">{row.offSeasonPlays.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-gray-600">{formatPercent(row.seasonShare)}</td>
                  <td className="py-2 px-3 text-right text-gray-700 font-medium">{formatLift(row.lift)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
