import { useMemo, useState } from 'react'
import { format, fromUnixTime, getDay, addDays } from 'date-fns'
import type { VizProps } from './registry'
import type { Scrobble } from '../db'
import { CloseIcon, MusicNoteIcon } from '../components/icons/CommonIcons'

const CELL = 13
const GAP = 3
const ROWS = 7
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''] // Sun=0 on top, GitHub-style

function getColor(count: number, max: number): string {
  if (count === 0) return '#f3f4f6'           // gray-100
  const r = count / max
  if (r < 0.25) return '#fecaca'              // red-200
  if (r < 0.5) return '#f87171'               // red-400
  if (r < 0.75) return '#ef4444'              // red-500
  return '#b91c1c'                             // red-700
}

interface Cell {
  date: Date
  col: number
  row: number
  count: number
  key: string
  month: number
}

interface TooltipState {
  cell: Cell
  x: number
  y: number
}

export function ScrobbleCalendar({ scrobbles, fill }: VizProps) {
  const years = useMemo(() => {
    const set = new Set<number>()
    for (const s of scrobbles) set.add(fromUnixTime(s.timestamp).getFullYear())
    return [...set].sort((a, b) => b - a)
  }, [scrobbles])

  const [year, setYear] = useState<number | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const activeYear = year ?? years[0] ?? new Date().getFullYear()

  const switchYear = (y: number) => { setYear(y); setSelectedDay(null) }

  const cells = useMemo<Cell[]>(() => {
    const counts = new Map<string, number>()
    for (const s of scrobbles) {
      const d = fromUnixTime(s.timestamp)
      if (d.getFullYear() !== activeYear) continue
      const key = format(d, 'yyyy-MM-dd')
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }

    const start = new Date(activeYear, 0, 1)
    const isLeap = activeYear % 4 === 0 && (activeYear % 100 !== 0 || activeYear % 400 === 0)
    const totalDays = isLeap ? 366 : 365
    const result: Cell[] = []

    let col = 0
    let row = getDay(start) // 0=Sun
    if (row > 0) col = 0    // first column is partial; that's fine

    for (let i = 0; i < totalDays; i++) {
      const d = addDays(start, i)
      const key = format(d, 'yyyy-MM-dd')
      result.push({ date: d, col, row, count: counts.get(key) ?? 0, key, month: d.getMonth() })
      row++
      if (row === 7) { row = 0; col++ }
    }

    return result
  }, [scrobbles, activeYear])

  const maxCount = useMemo(() => Math.max(1, ...cells.map(c => c.count)), [cells])
  const totalPlays = useMemo(() => cells.reduce((a, c) => a + c.count, 0), [cells])
  const activeDays = useMemo(() => cells.filter(c => c.count > 0).length, [cells])
  const busiest = useMemo(
    () => cells.reduce((best, c) => c.count > best.count ? c : best, cells[0]),
    [cells],
  )

  // For the current year, denominators count only days elapsed so far.
  const elapsedDays = useMemo(() => {
    const today = new Date()
    if (activeYear !== today.getFullYear()) return cells.length
    const start = new Date(activeYear, 0, 1)
    return Math.floor((today.getTime() - start.getTime()) / 86400000) + 1
  }, [activeYear, cells.length])

  const totalCols = (cells[cells.length - 1]?.col ?? 0) + 1

  // Index scrobbles by date once per year for fast lookup on click
  const scrobblesByDay = useMemo(() => {
    const map = new Map<string, Scrobble[]>()
    for (const s of scrobbles) {
      const d = fromUnixTime(s.timestamp)
      if (d.getFullYear() !== activeYear) continue
      const key = format(d, 'yyyy-MM-dd')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => b.timestamp - a.timestamp)
    }
    return map
  }, [scrobbles, activeYear])

  const selectedScrobbles = selectedDay ? (scrobblesByDay.get(selectedDay) ?? []) : []
  const selectedDate = selectedDay ? new Date(selectedDay + 'T12:00:00') : null

  // First cell of each month — used to position month labels
  const monthLabels = useMemo(() => {
    const labels: { col: number; label: string }[] = []
    let last = -1
    for (const c of cells) {
      if (c.month !== last) {
        labels.push({ col: c.col, label: format(c.date, 'MMM') })
        last = c.month
      }
    }
    return labels
  }, [cells])

  if (scrobbles.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data yet.</div>
  }

  const labelOffset = 28
  const monthOffset = 18
  const gridW = totalCols * (CELL + GAP)
  const gridH = ROWS * (CELL + GAP)

  return (
    <div className={fill ? 'space-y-3' : 'bg-white rounded-xl border border-gray-200 p-5 space-y-4'}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        {!fill && <h2 className="font-semibold text-gray-800">Scrobble Calendar</h2>}
        <div className="flex gap-1 flex-wrap">
          {years.map(y => (
            <button
              key={y}
              onClick={() => switchYear(y)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                activeYear === y ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total plays" value={totalPlays.toLocaleString()} />
        <Stat label="Active days" value={`${activeDays} / ${elapsedDays}`} />
        <Stat label="Daily avg" value={(totalPlays / elapsedDays).toFixed(1)} />
        <Stat
          label="Busiest day"
          value={busiest && busiest.count > 0 ? busiest.count.toLocaleString() : '—'}
          sub={busiest && busiest.count > 0 ? format(busiest.date, 'MMM d') : undefined}
        />
      </div>

      <div className={fill ? '' : 'overflow-x-auto'}>
        <svg
          viewBox={`0 0 ${labelOffset + gridW} ${monthOffset + gridH}`}
          style={fill
            ? { width: '100%', height: 'auto' }
            : { width: labelOffset + gridW, height: monthOffset + gridH }}
        >
          {monthLabels.map((m, i) => (
            <text
              key={i}
              x={labelOffset + m.col * (CELL + GAP)}
              y={9}
              className="fill-gray-500"
              style={{ fontSize: 11 }}
            >
              {m.label}
            </text>
          ))}
          {DAY_LABELS.map((d, i) => (
            d && (
              <text
                key={i}
                x={0}
                y={monthOffset + i * (CELL + GAP) + 10}
                className="fill-gray-400"
                style={{ fontSize: 11 }}
              >
                {d}
              </text>
            )
          ))}
          {cells.map(c => {
            const isSelected = selectedDay === c.key
            return (
              <rect
                key={c.key}
                x={labelOffset + c.col * (CELL + GAP)}
                y={monthOffset + c.row * (CELL + GAP)}
                width={CELL}
                height={CELL}
                rx={2}
                fill={getColor(c.count, maxCount)}
                stroke={isSelected ? '#1f2937' : undefined}
                strokeWidth={isSelected ? 2 : undefined}
                className={c.count > 0 ? 'cursor-pointer' : 'cursor-default'}
                onMouseEnter={e => {
                  const r = e.currentTarget.getBoundingClientRect()
                  setTooltip({ cell: c, x: r.left + r.width / 2, y: r.top })
                }}
                onMouseLeave={() => setTooltip(null)}
                onClick={() => {
                  if (c.count === 0) return
                  setSelectedDay(prev => prev === c.key ? null : c.key)
                }}
              />
            )
          })}
        </svg>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500 justify-end">
        <span>Less</span>
        {[0, 0.2, 0.45, 0.7, 0.9].map(r => (
          <div
            key={r}
            className="w-3 h-3 rounded-sm"
            style={{ backgroundColor: getColor(r * maxCount, maxCount) }}
          />
        ))}
        <span>More</span>
      </div>

      {selectedDate && (
        <div className="border-t border-gray-100 pt-4 -mx-1">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-medium text-gray-700">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              <span className="text-gray-400 font-normal ml-2">
                · {selectedScrobbles.length} {selectedScrobbles.length === 1 ? 'scrobble' : 'scrobbles'}
              </span>
            </h3>
            <button
              onClick={() => setSelectedDay(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Close"
            >
              <CloseIcon className="w-4 h-4" />
            </button>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 sticky top-0">
                <tr className="text-gray-500">
                  <th className="py-1.5 pl-2 pr-1 w-10" />
                  <th className="text-left py-1.5 px-2 font-medium">Track</th>
                  <th className="text-left py-1.5 px-2 font-medium">Artist</th>
                  <th className="text-left py-1.5 px-2 font-medium hidden md:table-cell">Album</th>
                  <th className="text-right py-1.5 pl-2 pr-2 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {selectedScrobbles.map((s, i) => (
                  <tr key={`${s.timestamp}-${i}`} className="hover:bg-gray-50">
                    <td className="py-1 pl-2 pr-1">
                      <div className="w-8 h-8 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                        {s.imageUrl ? (
                          <img src={s.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <MusicNoteIcon className="w-4 h-4 text-gray-300" />
                        )}
                      </div>
                    </td>
                    <td className="py-1 px-2 font-medium text-gray-800 max-w-xs truncate">{s.track}</td>
                    <td className="py-1 px-2 text-gray-600 max-w-xs truncate">{s.artist}</td>
                    <td className="py-1 px-2 text-gray-500 max-w-xs truncate hidden md:table-cell">{s.album || '—'}</td>
                    <td className="py-1 pl-2 pr-2 text-right text-gray-400 whitespace-nowrap tabular-nums">
                      {format(fromUnixTime(s.timestamp), 'HH:mm')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 shadow-lg -translate-x-1/2 -translate-y-full -mt-1.5"
          style={{ left: tooltip.x, top: tooltip.y - 6 }}
        >
          <span className="font-medium">{format(tooltip.cell.date, 'EEE, MMM d, yyyy')}</span>
          <span className="text-gray-300 ml-1.5">
            {tooltip.cell.count.toLocaleString()} {tooltip.cell.count === 1 ? 'scrobble' : 'scrobbles'}
          </span>
        </div>
      )}
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
