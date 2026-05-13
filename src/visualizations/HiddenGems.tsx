import { useMemo, useState } from 'react'
import { format, fromUnixTime } from 'date-fns'
import type { VizProps } from './registry'

interface TrackStats {
  key: string
  track: string
  artist: string
  album: string
  plays: number
  uniqueDays: number
  score: number
  lastPlayed: number
}

export function HiddenGems({ scrobbles }: VizProps) {
  const [minPlays, setMinPlays] = useState(3)
  const [maxPlays, setMaxPlays] = useState(25)
  const [limit, setLimit] = useState(100)

  const rows = useMemo(() => {
    const map = new Map<string, { track: string; artist: string; album: string; plays: number; days: Set<string>; lastPlayed: number }>()
    for (const s of scrobbles) {
      const key = `${s.track}::${s.artist}`
      const row = map.get(key) ?? {
        track: s.track,
        artist: s.artist,
        album: s.album,
        plays: 0,
        days: new Set<string>(),
        lastPlayed: 0,
      }
      row.plays += 1
      row.days.add(format(fromUnixTime(s.timestamp), 'yyyy-MM-dd'))
      row.lastPlayed = Math.max(row.lastPlayed, s.timestamp)
      map.set(key, row)
    }

    const all: TrackStats[] = [...map.entries()].map(([key, row]) => {
      const uniqueDays = row.days.size
      const repeatIntensity = row.plays / Math.max(1, uniqueDays)
      const rarity = 1 / Math.log2(row.plays + 2)
      return {
        key,
        track: row.track,
        artist: row.artist,
        album: row.album,
        plays: row.plays,
        uniqueDays,
        score: repeatIntensity * rarity,
        lastPlayed: row.lastPlayed,
      }
    })

    return all
      .filter(r => r.plays >= minPlays && r.plays <= maxPlays)
      .sort((a, b) => b.score - a.score || b.plays - a.plays || b.lastPlayed - a.lastPlayed)
      .slice(0, limit)
  }, [scrobbles, minPlays, maxPlays, limit])

  if (scrobbles.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data yet.</div>
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800">Hidden Gems</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Tracks with strong repeat behavior but lower total play volume.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <NumberControl label="Min plays" value={minPlays} min={1} max={100} onChange={setMinPlays} />
          <NumberControl label="Max plays" value={maxPlays} min={1} max={500} onChange={setMaxPlays} />
          <NumberControl label="Row limit" value={limit} min={10} max={500} onChange={setLimit} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-auto max-h-[640px]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white border-b border-gray-200">
            <tr>
              <th className="text-left py-2 px-2 text-gray-500 font-medium">#</th>
              <th className="text-left py-2 px-2 text-gray-500 font-medium">Track</th>
              <th className="text-left py-2 px-2 text-gray-500 font-medium">Artist</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">Plays</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">Unique Days</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">Gem Score</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">Last Played</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="py-8 px-2 text-center text-gray-400">No matches with these thresholds.</td></tr>
            ) : rows.map((row, i) => (
              <tr key={row.key} className="hover:bg-gray-50">
                <td className="py-2 px-2 text-gray-400">{i + 1}</td>
                <td className="py-2 px-2 text-gray-700 max-w-[22rem] truncate" title={row.track}>{row.track}</td>
                <td className="py-2 px-2 text-gray-600 max-w-[18rem] truncate" title={row.artist}>{row.artist}</td>
                <td className="py-2 px-2 text-right text-gray-600">{row.plays.toLocaleString()}</td>
                <td className="py-2 px-2 text-right text-gray-600">{row.uniqueDays.toLocaleString()}</td>
                <td className="py-2 px-2 text-right text-gray-700 font-medium">{row.score.toFixed(3)}</td>
                <td className="py-2 px-2 text-right text-gray-500">{format(fromUnixTime(row.lastPlayed), 'yyyy-MM-dd')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function NumberControl({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <label className="text-sm text-gray-600">
      <span className="block mb-1">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
        className="w-28 border border-gray-200 rounded-lg px-3 py-1.5"
      />
    </label>
  )
}
