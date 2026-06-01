import { useMemo, useState } from 'react'
import { differenceInCalendarDays, format, fromUnixTime } from 'date-fns'
import type { VizProps } from './registry'
import { splitArtists, buildRawArtistSet } from '../utils/artists'
import { ArtistAvatar } from '../components/ArtistAvatar'

interface ArtistPredict {
  artist: string
  plays: number
  daysSinceLast: number
  activeDays: number
  score: number
  lastPlayed: number
}

function gaussian(x: number, center: number, spread: number): number {
  const z = (x - center) / spread
  return Math.exp(-(z * z) / 2)
}

export function RelistenPredictor({ scrobbles, splitCollabs }: VizProps) {
  const [targetDays, setTargetDays] = useState(30)
  const [minPlays, setMinPlays] = useState(5)
  const [rows, setRows] = useState(50)
  const rawArtistSet = useMemo(() => buildRawArtistSet(scrobbles), [scrobbles])

  const ranking = useMemo(() => {
    const today = new Date()
    const map = new Map<string, { plays: number; lastPlayed: number; dayKeys: Set<string> }>()
    for (const s of scrobbles) {
      const artists = splitCollabs ? splitArtists(s.artist, rawArtistSet) : [s.artist]
      for (const artistRaw of artists) {
        const artist = artistRaw.trim()
        if (!artist) continue
        const row = map.get(artist) ?? { plays: 0, lastPlayed: 0, dayKeys: new Set<string>() }
        row.plays += 1
        row.lastPlayed = Math.max(row.lastPlayed, s.timestamp)
        row.dayKeys.add(format(fromUnixTime(s.timestamp), 'yyyy-MM-dd'))
        map.set(artist, row)
      }
    }

    return [...map.entries()]
      .map(([artist, row]): ArtistPredict => {
        const daysSinceLast = Math.max(0, differenceInCalendarDays(today, fromUnixTime(row.lastPlayed)))
        const activeDays = row.dayKeys.size
        const loyalty = Math.log2(row.plays + 1)
        const recency = gaussian(daysSinceLast, targetDays, Math.max(10, targetDays * 0.8))
        const cadence = row.plays / Math.max(1, activeDays)
        const score = loyalty * recency * (1 + Math.min(2, cadence / 2))
        return { artist, plays: row.plays, daysSinceLast, activeDays, score, lastPlayed: row.lastPlayed }
      })
      .filter(r => r.plays >= minPlays)
      .sort((a, b) => b.score - a.score)
      .slice(0, rows)
  }, [scrobbles, splitCollabs, rawArtistSet, targetDays, minPlays, rows])

  if (scrobbles.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data yet.</div>
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800">Re-listen Predictor</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Artists you are most likely to revisit soon based on recency and frequency.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <NumberControl label="Target revisit days" value={targetDays} min={7} max={180} onChange={setTargetDays} />
          <NumberControl label="Minimum plays" value={minPlays} min={1} max={1000} onChange={setMinPlays} />
          <NumberControl label="Rows" value={rows} min={10} max={500} onChange={setRows} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-auto max-h-[640px]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white border-b border-gray-200">
            <tr>
              <th className="text-left py-2 px-2 text-gray-500 font-medium">#</th>
              <th className="text-left py-2 px-2 text-gray-500 font-medium">Artist</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">Score</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">Plays</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">Days Since Last</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">Active Days</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">Last Played</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ranking.length === 0 ? (
              <tr><td colSpan={7} className="py-8 px-2 text-center text-gray-400">No matches yet.</td></tr>
            ) : ranking.map((r, i) => (
              <tr key={r.artist} className="hover:bg-gray-50">
                <td className="py-2 px-2 text-gray-400">{i + 1}</td>
                <td className="py-2 px-2 text-gray-700">
                  <div className="flex items-center gap-2">
                    <ArtistAvatar artist={r.artist} />
                    <span>{r.artist}</span>
                  </div>
                </td>
                <td className="py-2 px-2 text-right text-gray-700 font-medium">{r.score.toFixed(3)}</td>
                <td className="py-2 px-2 text-right text-gray-600">{r.plays.toLocaleString()}</td>
                <td className="py-2 px-2 text-right text-gray-600">{r.daysSinceLast.toLocaleString()}</td>
                <td className="py-2 px-2 text-right text-gray-600">{r.activeDays.toLocaleString()}</td>
                <td className="py-2 px-2 text-right text-gray-500">{format(fromUnixTime(r.lastPlayed), 'yyyy-MM-dd')}</td>
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
        className="w-32 border border-gray-200 rounded-lg px-3 py-1.5"
      />
    </label>
  )
}
