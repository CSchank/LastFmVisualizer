import { useMemo, useState } from 'react'
import { fromUnixTime } from 'date-fns'
import type { VizProps } from './registry'
import { splitArtists, buildRawArtistSet } from '../utils/artists'
import { ArtistAvatar } from '../components/ArtistAvatar'

type Dimension = 'artist' | 'album' | 'track'

interface EntityStats {
  name: string
  firstHeardYear: number
  plays: number
}

export function EraExplorer({ scrobbles, splitCollabs }: VizProps) {
  const [dimension, setDimension] = useState<Dimension>('artist')
  const [selectedDecade, setSelectedDecade] = useState<number | null>(null)
  const rawArtistSet = useMemo(() => buildRawArtistSet(scrobbles), [scrobbles])

  const model = useMemo(() => {
    if (scrobbles.length === 0) return null
    const stats = new Map<string, EntityStats>()
    for (const s of scrobbles) {
      const year = fromUnixTime(s.timestamp).getFullYear()
      const keys = dimension === 'artist'
        ? (splitCollabs ? splitArtists(s.artist, rawArtistSet) : [s.artist])
        : [dimension === 'album' ? `${s.album} — ${s.artist}` : `${s.track} — ${s.artist}`]

      for (const keyRaw of keys) {
        const key = keyRaw.trim()
        if (!key) continue
        const existing = stats.get(key)
        if (!existing) {
          stats.set(key, { name: key, firstHeardYear: year, plays: 1 })
          continue
        }
        existing.plays += 1
        if (year < existing.firstHeardYear) existing.firstHeardYear = year
      }
    }

    const entities = [...stats.values()]
    const decadeMap = new Map<number, { decade: number; entities: number; plays: number }>()
    for (const e of entities) {
      const decade = Math.floor(e.firstHeardYear / 10) * 10
      const row = decadeMap.get(decade) ?? { decade, entities: 0, plays: 0 }
      row.entities += 1
      row.plays += e.plays
      decadeMap.set(decade, row)
    }

    const decades = [...decadeMap.values()].sort((a, b) => a.decade - b.decade)
    const maxPlays = Math.max(1, ...decades.map(d => d.plays))
    const activeDecade = selectedDecade ?? decades[decades.length - 1]?.decade ?? 0
    const topInDecade = entities
      .filter(e => Math.floor(e.firstHeardYear / 10) * 10 === activeDecade)
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 25)
    return { decades, maxPlays, topInDecade, activeDecade }
  }, [scrobbles, dimension, splitCollabs, rawArtistSet, selectedDecade])

  if (!model) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data yet.</div>
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-semibold text-gray-800">Era Explorer</h2>
            <p className="text-sm text-gray-500 mt-0.5">Explore listening eras by first-heard decade.</p>
          </div>
          <div className="flex gap-1">
            {(['artist', 'album', 'track'] as Dimension[]).map(d => (
              <button
                key={d}
                onClick={() => { setDimension(d); setSelectedDecade(null) }}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  dimension === d ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {d.charAt(0).toUpperCase() + d.slice(1)}s
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
        {model.decades.map(d => (
          <button
            key={d.decade}
            onClick={() => setSelectedDecade(d.decade)}
            className={`w-full text-left p-3 rounded-lg border transition-colors ${
              model.activeDecade === d.decade ? 'border-red-300 bg-red-50' : 'border-gray-200 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-medium text-gray-800">{d.decade}s</span>
              <span className="text-gray-500">{d.plays.toLocaleString()} plays · {d.entities.toLocaleString()} discovered</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-red-400 rounded-full" style={{ width: `${(d.plays / model.maxPlays) * 100}%` }} />
            </div>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">
          Top {dimension}s first heard in the {model.activeDecade}s
        </h3>
        <div className="overflow-auto max-h-[520px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white border-b border-gray-200">
              <tr>
                <th className="text-left py-2 px-2 text-gray-500 font-medium">#</th>
                <th className="text-left py-2 px-2 text-gray-500 font-medium">{dimension}</th>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">Plays</th>
                <th className="text-right py-2 px-2 text-gray-500 font-medium">First Heard</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {model.topInDecade.map((row, i) => (
                <tr key={row.name} className="hover:bg-gray-50">
                  <td className="py-2 px-2 text-gray-400">{i + 1}</td>
                  <td className="py-2 px-2 text-gray-700 max-w-[36rem]" title={row.name}>
                    <div className="flex items-center gap-2">
                      {dimension === 'artist' && <ArtistAvatar artist={row.name} />}
                      <span className="truncate">{row.name}</span>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-right text-gray-600">{row.plays.toLocaleString()}</td>
                  <td className="py-2 px-2 text-right text-gray-500">{row.firstHeardYear}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
