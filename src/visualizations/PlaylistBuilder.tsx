import { useMemo, useState } from 'react'
import { format, fromUnixTime, subDays } from 'date-fns'
import type { VizProps } from './registry'
import { EntityLink } from '../components/EntityDetail'

type Preset = 'hidden-gems' | 'overdue-favorites' | 'current-obsessions'

interface TrackRow {
  track: string
  artist: string
  album: string
  plays: number
  recent90: number
  uniqueDays: number
  lastPlayed: number
  score: number
}

function downloadCsv(filename: string, rows: TrackRow[]): void {
  const header = ['track', 'artist', 'album', 'plays', 'recent_90d_plays', 'unique_days', 'last_played', 'score']
  const csvRows = rows.map(r => [
    r.track,
    r.artist,
    r.album,
    String(r.plays),
    String(r.recent90),
    String(r.uniqueDays),
    format(fromUnixTime(r.lastPlayed), 'yyyy-MM-dd'),
    r.score.toFixed(4),
  ])
  const csv = [header, ...csvRows]
    .map(cols => cols.map(col => `"${String(col).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function PlaylistBuilder({ scrobbles }: VizProps) {
  const [preset, setPreset] = useState<Preset>('hidden-gems')
  const [limit, setLimit] = useState(50)

  const rows = useMemo(() => {
    const cutoff90 = Math.floor(subDays(new Date(), 90).getTime() / 1000)
    const nowTs = Math.floor(Date.now() / 1000)

    const map = new Map<string, {
      track: string
      artist: string
      album: string
      plays: number
      recent90: number
      dayKeys: Set<string>
      lastPlayed: number
    }>()

    for (const s of scrobbles) {
      const key = `${s.track}::${s.artist}`
      const row = map.get(key) ?? {
        track: s.track,
        artist: s.artist,
        album: s.album,
        plays: 0,
        recent90: 0,
        dayKeys: new Set<string>(),
        lastPlayed: 0,
      }
      row.plays += 1
      if (s.timestamp >= cutoff90) row.recent90 += 1
      row.dayKeys.add(format(fromUnixTime(s.timestamp), 'yyyy-MM-dd'))
      row.lastPlayed = Math.max(row.lastPlayed, s.timestamp)
      map.set(key, row)
    }

    const all: TrackRow[] = [...map.values()].map(r => ({
      track: r.track,
      artist: r.artist,
      album: r.album,
      plays: r.plays,
      recent90: r.recent90,
      uniqueDays: r.dayKeys.size,
      lastPlayed: r.lastPlayed,
      score: 0,
    }))

    const scored = all.map(row => {
      const daysSince = Math.max(0, (nowTs - row.lastPlayed) / 86400)
      if (preset === 'hidden-gems') {
        const repeatIntensity = row.plays / Math.max(1, row.uniqueDays)
        const rarity = row.plays <= 25 ? 1 : 0
        row.score = repeatIntensity * rarity
      } else if (preset === 'overdue-favorites') {
        row.score = row.plays >= 10 && daysSince >= 30 ? row.plays * Math.log2(daysSince + 1) : 0
      } else {
        row.score = row.recent90 * (1 + Math.log2(row.plays + 1) / 5)
      }
      return row
    })

    const filtered = scored
      .filter(r => {
        if (preset === 'hidden-gems') return r.plays >= 3 && r.plays <= 25 && r.score > 0
        if (preset === 'overdue-favorites') return r.score > 0
        return r.recent90 > 0
      })
      .sort((a, b) => b.score - a.score || b.plays - a.plays)
      .slice(0, limit)

    return filtered
  }, [scrobbles, preset, limit])

  if (scrobbles.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data yet.</div>
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-semibold text-gray-800">Playlist Builder Export</h2>
            <p className="text-sm text-gray-500 mt-0.5">Generate smart playlist candidates and export as CSV.</p>
          </div>
          <button
            onClick={() => downloadCsv(`playlist-${preset}.csv`, rows)}
            disabled={rows.length === 0}
            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Export CSV
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm text-gray-600">
            <span className="block mb-1">Preset</span>
            <select
              value={preset}
              onChange={e => setPreset(e.target.value as Preset)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
            >
              <option value="hidden-gems">Hidden Gems</option>
              <option value="overdue-favorites">Overdue Favorites</option>
              <option value="current-obsessions">Current Obsessions</option>
            </select>
          </label>
          <label className="text-sm text-gray-600">
            <span className="block mb-1">Rows</span>
            <input
              type="number"
              min={10}
              max={500}
              value={limit}
              onChange={e => setLimit(Math.max(10, Math.min(500, Number(e.target.value) || 10)))}
              className="w-24 border border-gray-200 rounded-lg px-3 py-1.5"
            />
          </label>
          <span className="text-sm text-gray-500">{rows.length.toLocaleString()} tracks ready</span>
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
              <th className="text-right py-2 px-2 text-gray-500 font-medium">Recent 90d</th>
              <th className="text-right py-2 px-2 text-gray-500 font-medium">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="py-8 px-2 text-center text-gray-400">No matches for this preset.</td></tr>
            ) : rows.map((row, i) => (
              <tr key={`${row.track}-${row.artist}`} className="hover:bg-gray-50">
                <td className="py-2 px-2 text-gray-400">{i + 1}</td>
                <td className="py-2 px-2 text-gray-700 max-w-[24rem]" title={row.track}>
                  <EntityLink entity={{ kind: 'track', artist: row.artist, title: row.track }} className="block max-w-full truncate">{row.track}</EntityLink>
                </td>
                <td className="py-2 px-2 text-gray-600 max-w-[18rem]" title={row.artist}>
                  <EntityLink entity={{ kind: 'artist', artist: row.artist }} className="block max-w-full truncate">{row.artist}</EntityLink>
                </td>
                <td className="py-2 px-2 text-right text-gray-600">{row.plays.toLocaleString()}</td>
                <td className="py-2 px-2 text-right text-gray-600">{row.recent90.toLocaleString()}</td>
                <td className="py-2 px-2 text-right text-gray-700 font-medium">{row.score.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
