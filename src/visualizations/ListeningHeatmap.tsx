import { useMemo, useState } from 'react'
import { fromUnixTime, getDay, getHours } from 'date-fns'
import type { VizProps } from './registry'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

function formatHour(h: number): string {
  if (h === 0) return '12a'
  if (h === 12) return '12p'
  return h < 12 ? `${h}a` : `${h - 12}p`
}

interface TooltipState {
  day: number
  hour: number
  count: number
  x: number
  y: number
}

export function ListeningHeatmap({ scrobbles }: VizProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const { grid, max } = useMemo(() => {
    const g: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
    for (const s of scrobbles) {
      const d = fromUnixTime(s.timestamp)
      g[getDay(d)][getHours(d)]++
    }
    const flat = g.flat()
    return { grid: g, max: Math.max(...flat) }
  }, [scrobbles])

  if (scrobbles.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data yet.</div>
  }

  function intensity(count: number): string {
    if (count === 0) return 'bg-gray-100'
    const ratio = count / max
    if (ratio < 0.15) return 'bg-red-100'
    if (ratio < 0.35) return 'bg-red-200'
    if (ratio < 0.55) return 'bg-red-300'
    if (ratio < 0.75) return 'bg-red-400'
    return 'bg-red-500'
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h2 className="font-semibold text-gray-800">Listening Heatmap</h2>
      <p className="text-sm text-gray-500">Scrobbles by hour of day and day of week</p>

      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5 text-xs table-fixed">
          <thead>
            <tr>
              <th className="w-8" />
              {HOURS.map(h => (
                <th key={h} className="w-7 text-center font-normal text-gray-400">
                  {h % 3 === 0 ? formatHour(h) : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, di) => (
              <tr key={day}>
                <td className="pr-2 text-right text-gray-500 font-medium">{day}</td>
                {HOURS.map(h => {
                  const count = grid[di][h]
                  return (
                    <td key={h}>
                      <div
                        className={`w-7 h-7 rounded cursor-default ${intensity(count)}`}
                        onMouseEnter={e => {
                          const rect = e.currentTarget.getBoundingClientRect()
                          setTooltip({ day: di, hour: h, count, x: rect.left + rect.width / 2, y: rect.top })
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>Less</span>
        {['bg-gray-100', 'bg-red-100', 'bg-red-200', 'bg-red-300', 'bg-red-400', 'bg-red-500'].map(c => (
          <div key={c} className={`w-4 h-4 rounded ${c}`} />
        ))}
        <span>More</span>
      </div>

      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 shadow-lg -translate-x-1/2 -translate-y-full -mt-1.5"
          style={{ left: tooltip.x, top: tooltip.y - 6 }}
        >
          <span className="font-medium">{DAYS[tooltip.day]} {formatHour(tooltip.hour)}</span>
          <span className="text-gray-300 ml-1.5">
            {tooltip.count.toLocaleString()} {tooltip.count === 1 ? 'scrobble' : 'scrobbles'}
          </span>
        </div>
      )}
    </div>
  )
}
