import { useMemo, useState } from 'react'
import { format, fromUnixTime } from 'date-fns'
import type { VizProps } from './registry'
import { ArtistAvatar } from '../components/ArtistAvatar'
import { EntityLink } from '../components/EntityDetail'

export function ArtistDiscovery({ scrobbles }: VizProps) {
  const [query, setQuery] = useState('')

  const discoveries = useMemo(() => {
    const firstSeen = new Map<string, number>()
    for (const s of scrobbles) {
      const existing = firstSeen.get(s.artist)
      if (existing === undefined || s.timestamp < existing) {
        firstSeen.set(s.artist, s.timestamp)
      }
    }
    const playCounts = new Map<string, number>()
    for (const s of scrobbles) {
      playCounts.set(s.artist, (playCounts.get(s.artist) ?? 0) + 1)
    }

    return [...firstSeen.entries()]
      .map(([artist, ts]) => ({ artist, firstPlay: ts, plays: playCounts.get(artist) ?? 0 }))
      .sort((a, b) => a.firstPlay - b.firstPlay)
  }, [scrobbles])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return q ? discoveries.filter(d => d.artist.toLowerCase().includes(q)) : discoveries
  }, [discoveries, query])

  if (scrobbles.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data yet.</div>
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-semibold text-gray-800">Artist Discovery Timeline</h2>
          <p className="text-sm text-gray-500">{discoveries.length.toLocaleString()} artists discovered</p>
        </div>
        <input
          type="search"
          placeholder="Search artist…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
        />
      </div>

      <div className="overflow-auto max-h-[560px]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white border-b border-gray-200">
            <tr>
              <th className="text-left py-2 px-3 font-medium text-gray-500">#</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500">Artist</th>
              <th className="text-left py-2 px-3 font-medium text-gray-500">First Played</th>
              <th className="text-right py-2 px-3 font-medium text-gray-500">Plays</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((d, i) => (
              <tr key={d.artist} className="hover:bg-gray-50">
                <td className="py-2 px-3 text-gray-400">{i + 1}</td>
                <td className="py-2 px-3 font-medium text-gray-800">
                  <div className="flex items-center gap-2">
                    <ArtistAvatar artist={d.artist} />
                    <EntityLink entity={{ kind: 'artist', artist: d.artist }}>{d.artist}</EntityLink>
                  </div>
                </td>
                <td className="py-2 px-3 text-gray-600">
                  {format(fromUnixTime(d.firstPlay), 'MMM d, yyyy')}
                </td>
                <td className="py-2 px-3 text-right text-gray-600">{d.plays.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
