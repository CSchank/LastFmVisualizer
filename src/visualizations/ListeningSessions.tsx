import { useMemo, useState } from 'react'
import { format, fromUnixTime } from 'date-fns'
import type { VizProps } from './registry'
import type { Scrobble } from '../db'

type Gap = 15 | 30 | 60 | 120

interface Session {
  start: number
  end: number
  tracks: Scrobble[]
}

function buildSessions(scrobbles: Scrobble[], gapMin: number): Session[] {
  if (scrobbles.length === 0) return []
  const sorted = [...scrobbles].sort((a, b) => a.timestamp - b.timestamp)
  const gap = gapMin * 60
  const sessions: Session[] = []
  let current: Scrobble[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i]
    const last = current[current.length - 1]
    if (s.timestamp - last.timestamp <= gap) {
      current.push(s)
    } else {
      sessions.push({ start: current[0].timestamp, end: last.timestamp, tracks: current })
      current = [s]
    }
  }
  sessions.push({
    start: current[0].timestamp,
    end: current[current.length - 1].timestamp,
    tracks: current,
  })

  return sessions
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return '<1m'
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function topArtist(tracks: Scrobble[]): { name: string; n: number } {
  const counts = new Map<string, number>()
  for (const t of tracks) counts.set(t.artist, (counts.get(t.artist) ?? 0) + 1)
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  return top ? { name: top[0], n: top[1] } : { name: '—', n: 0 }
}

const HIST_BUCKETS = [
  { label: '1', min: 1, max: 1 },
  { label: '2-5', min: 2, max: 5 },
  { label: '6-10', min: 6, max: 10 },
  { label: '11-20', min: 11, max: 20 },
  { label: '21-50', min: 21, max: 50 },
  { label: '50+', min: 51, max: Infinity },
]

export function ListeningSessions({ scrobbles }: VizProps) {
  const [gap, setGap] = useState<Gap>(30)

  const sessions = useMemo(() => buildSessions(scrobbles, gap), [scrobbles, gap])

  const stats = useMemo(() => {
    if (sessions.length === 0) return null
    const total = sessions.length
    const totalTracks = sessions.reduce((a, s) => a + s.tracks.length, 0)
    const longest = sessions.reduce((best, s) =>
      s.tracks.length > best.tracks.length ? s : best, sessions[0])
    const longestSpan = sessions.reduce((best, s) =>
      (s.end - s.start) > (best.end - best.start) ? s : best, sessions[0])
    return { total, totalTracks, longest, longestSpan, avg: totalTracks / total }
  }, [sessions])

  const histogram = useMemo(() => {
    const counts = HIST_BUCKETS.map(b => ({ ...b, count: 0 }))
    for (const s of sessions) {
      const n = s.tracks.length
      for (const b of counts) {
        if (n >= b.min && n <= b.max) { b.count++; break }
      }
    }
    return counts
  }, [sessions])

  const histMax = Math.max(1, ...histogram.map(b => b.count))

  const top = useMemo(
    () => [...sessions].sort((a, b) => b.tracks.length - a.tracks.length).slice(0, 15),
    [sessions],
  )

  if (scrobbles.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data yet.</div>
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-semibold text-gray-800">Listening Sessions</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Consecutive scrobbles separated by no more than the chosen gap.
            </p>
          </div>
          <div className="flex gap-1 items-center">
            <span className="text-xs text-gray-500 mr-2">Gap</span>
            {([15, 30, 60, 120] as Gap[]).map(g => (
              <button
                key={g}
                onClick={() => setGap(g)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  gap === g ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {g < 60 ? `${g}m` : `${g / 60}h`}
              </button>
            ))}
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Sessions" value={stats.total.toLocaleString()} />
            <Stat label="Avg tracks / session" value={stats.avg.toFixed(1)} />
            <Stat
              label="Longest session"
              value={`${stats.longest.tracks.length} tracks`}
              sub={format(fromUnixTime(stats.longest.start), 'MMM d, yyyy')}
            />
            <Stat
              label="Longest span"
              value={formatDuration(stats.longestSpan.end - stats.longestSpan.start)}
              sub={format(fromUnixTime(stats.longestSpan.start), 'MMM d, yyyy')}
            />
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Session size distribution</h3>
          <div className="space-y-1">
            {histogram.map(b => (
              <div key={b.label} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-12 text-right tabular-nums">{b.label}</span>
                <div className="flex-1 h-5 bg-gray-100 rounded relative overflow-hidden">
                  <div
                    className="h-full bg-red-400 rounded transition-all"
                    style={{ width: `${(b.count / histMax) * 100}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-2 text-xs font-medium text-gray-700 tabular-nums">
                    {b.count.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Longest sessions</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200">
              <tr className="text-gray-500">
                <th className="text-left py-2 px-2 font-medium">Started</th>
                <th className="text-right py-2 px-2 font-medium">Tracks</th>
                <th className="text-right py-2 px-2 font-medium">Span</th>
                <th className="text-left py-2 px-2 font-medium">Top artist</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {top.map(s => {
                const ta = topArtist(s.tracks)
                return (
                  <tr key={s.start} className="hover:bg-gray-50">
                    <td className="py-2 px-2 text-gray-700">
                      {format(fromUnixTime(s.start), 'MMM d, yyyy')}
                      <span className="text-gray-400 ml-2 tabular-nums">
                        {format(fromUnixTime(s.start), 'HH:mm')}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-right font-medium text-gray-800 tabular-nums">
                      {s.tracks.length}
                    </td>
                    <td className="py-2 px-2 text-right text-gray-600 tabular-nums">
                      {formatDuration(s.end - s.start)}
                    </td>
                    <td className="py-2 px-2 text-gray-600 truncate max-w-xs">
                      {ta.name}
                      {ta.n > 1 && (
                        <span className="text-gray-400 ml-1">
                          ({ta.n}/{s.tracks.length})
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}
