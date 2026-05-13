import { useMemo } from 'react'
import { addDays, differenceInCalendarDays, format, fromUnixTime } from 'date-fns'
import type { VizProps } from './registry'

interface Streak {
  start: Date
  end: Date
  days: number
}

const MILESTONES = [1000, 5000, 10000, 25000, 50000, 100000, 250000]

function buildStreaks(days: Date[]): Streak[] {
  if (days.length === 0) return []
  const sorted = [...days].sort((a, b) => a.getTime() - b.getTime())
  const streaks: Streak[] = []
  let start = sorted[0]
  let end = sorted[0]
  for (let i = 1; i < sorted.length; i += 1) {
    const day = sorted[i]
    if (differenceInCalendarDays(day, end) === 1) {
      end = day
      continue
    }
    streaks.push({ start, end, days: differenceInCalendarDays(end, start) + 1 })
    start = day
    end = day
  }
  streaks.push({ start, end, days: differenceInCalendarDays(end, start) + 1 })
  return streaks.sort((a, b) => b.days - a.days || b.end.getTime() - a.end.getTime())
}

export function StreaksMilestones({ scrobbles }: VizProps) {
  const data = useMemo(() => {
    if (scrobbles.length === 0) return null
    const sorted = [...scrobbles].sort((a, b) => a.timestamp - b.timestamp)
    const daySet = new Set<string>()
    for (const s of sorted) daySet.add(format(fromUnixTime(s.timestamp), 'yyyy-MM-dd'))
    const days = [...daySet].map(d => new Date(`${d}T12:00:00`))
    const streaks = buildStreaks(days)

    const today = new Date()
    const dayByKey = new Set(daySet)
    let current = 0
    let cursor = new Date(today)
    while (dayByKey.has(format(cursor, 'yyyy-MM-dd'))) {
      current += 1
      cursor = addDays(cursor, -1)
    }

    let cumulative = 0
    const milestoneRows: { plays: number; date: Date | null }[] = []
    let milestoneIndex = 0
    for (const s of sorted) {
      cumulative += 1
      while (milestoneIndex < MILESTONES.length && cumulative >= MILESTONES[milestoneIndex]) {
        milestoneRows.push({ plays: MILESTONES[milestoneIndex], date: fromUnixTime(s.timestamp) })
        milestoneIndex += 1
      }
    }
    while (milestoneIndex < MILESTONES.length) {
      milestoneRows.push({ plays: MILESTONES[milestoneIndex], date: null })
      milestoneIndex += 1
    }

    return { streaks, current, longest: streaks[0], milestoneRows }
  }, [scrobbles])

  if (!data) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data yet.</div>
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800">Streaks & Milestones</h2>
        <p className="text-sm text-gray-500 mt-0.5">Your consistency streaks and cumulative scrobble milestones.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Stat label="Current Streak" value={`${data.current} day${data.current === 1 ? '' : 's'}`} />
        <Stat
          label="Longest Streak"
          value={`${data.longest?.days ?? 0} day${(data.longest?.days ?? 0) === 1 ? '' : 's'}`}
          sub={data.longest ? `${format(data.longest.start, 'MMM d, yyyy')} → ${format(data.longest.end, 'MMM d, yyyy')}` : undefined}
        />
        <Stat label="Total Streaks" value={data.streaks.length.toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Top Streaks</h3>
          <div className="space-y-2">
            {data.streaks.slice(0, 10).map((s, i) => (
              <div key={`${s.start.toISOString()}-${s.end.toISOString()}`} className="flex items-center gap-2">
                <span className="w-5 text-xs text-gray-400">{i + 1}</span>
                <span className="flex-1 text-sm text-gray-700">
                  {format(s.start, 'MMM d, yyyy')} → {format(s.end, 'MMM d, yyyy')}
                </span>
                <span className="text-xs text-gray-500 tabular-nums">{s.days}d</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Milestones</h3>
          <div className="space-y-2">
            {data.milestoneRows.map(m => (
              <div key={m.plays} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{m.plays.toLocaleString()} plays</span>
                <span className="text-gray-500 tabular-nums">{m.date ? format(m.date, 'MMM d, yyyy') : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}
