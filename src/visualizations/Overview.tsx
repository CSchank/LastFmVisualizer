import { useMemo } from 'react'
import type { VizProps } from './registry'
import { EntityLink } from '../components/EntityDetail'
import { format, fromUnixTime } from 'date-fns'
import { splitArtists, buildRawArtistSet } from '../utils/artists'
import { ArtistAvatar } from '../components/ArtistAvatar'

function topN<T extends string>(arr: T[], n: number): { name: T; count: number }[] {
  const counts = new Map<T, number>()
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }))
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-1">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 truncate">{value}</p>
      {sub && <p className="text-sm text-gray-500 truncate">{sub}</p>}
    </div>
  )
}

export function Overview({ scrobbles, splitCollabs }: VizProps) {
  const raw = useMemo(() => buildRawArtistSet(scrobbles), [scrobbles])

  const stats = useMemo(() => {
    if (scrobbles.length === 0) return null

    const sorted = [...scrobbles].sort((a, b) => a.timestamp - b.timestamp)
    const earliest = sorted[0]
    const latest = sorted[sorted.length - 1]
    const spanDays = (latest.timestamp - earliest.timestamp) / 86400
    const avgPerDay = spanDays > 0 ? (scrobbles.length / spanDays).toFixed(1) : '—'

    const artistCounts = new Map<string, number>()
    for (const s of scrobbles) {
      const artists = splitCollabs ? splitArtists(s.artist, raw) : [s.artist]
      for (const a of artists) {
        if (a.trim()) artistCounts.set(a, (artistCounts.get(a) ?? 0) + 1)
      }
    }
    const topArtists = [...artistCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }))

    const topTracks = topN(scrobbles.map(s => `${s.track} – ${s.artist}`), 1)
    const topAlbums = topN(scrobbles.map(s => s.album).filter(Boolean), 1)

    return {
      total: scrobbles.length.toLocaleString(),
      firstPlay: format(fromUnixTime(earliest.timestamp), 'MMM d, yyyy'),
      firstArtist: earliest.artist,
      avgPerDay,
      topArtist: topArtists[0],
      topTrack: topTracks[0],
      topAlbum: topAlbums[0],
      topArtists,
    }
  }, [scrobbles, splitCollabs, raw])

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        No scrobbles yet — sync your data first.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Scrobbles" value={stats.total} />
        <StatCard label="Daily Average" value={stats.avgPerDay} sub="scrobbles/day" />
        <StatCard label="Listening Since" value={stats.firstPlay} sub={stats.firstArtist} />
        <StatCard
          label="All-time #1 Artist"
          value={stats.topArtist?.name ?? '—'}
          sub={`${stats.topArtist?.count.toLocaleString()} plays`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard
          label="Most Played Track"
          value={stats.topTrack?.name ?? '—'}
          sub={`${stats.topTrack?.count.toLocaleString()} plays`}
        />
        <StatCard
          label="Most Played Album"
          value={stats.topAlbum?.name ?? '—'}
          sub={`${stats.topAlbum?.count.toLocaleString()} plays`}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Top 3 Artists</h3>
        <div className="space-y-3">
          {stats.topArtists.map((a, i) => (
            <div key={a.name} className="flex items-center gap-3">
              <span className="text-lg font-bold text-gray-300 w-6 text-center">{i + 1}</span>
              <ArtistAvatar artist={a.name} sizeClass="w-9 h-9" iconClass="w-5 h-5" />
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <EntityLink entity={{ kind: 'artist', artist: a.name }} className="text-sm font-medium text-gray-800 truncate">{a.name}</EntityLink>
                  <span className="text-sm text-gray-500">{a.count.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 rounded-full"
                    style={{ width: `${(a.count / stats.topArtists[0].count) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
