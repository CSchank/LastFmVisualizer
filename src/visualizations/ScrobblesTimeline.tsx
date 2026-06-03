import { useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
} from 'chart.js'
import { format, fromUnixTime, startOfWeek, startOfMonth, startOfDay } from 'date-fns'
import type { VizProps } from './registry'
import type { Scrobble } from '../db'
import { movingAverage, MA_WINDOW, MA_OPTIONS } from '../utils/movingAverage'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler)

type Granularity = 'day' | 'week' | 'month'

function bucket(scrobbles: Scrobble[], gran: Granularity): Map<string, number> {
  const map = new Map<string, number>()
  for (const s of scrobbles) {
    const d = fromUnixTime(s.timestamp)
    let key: string
    if (gran === 'day') key = format(startOfDay(d), 'yyyy-MM-dd')
    else if (gran === 'week') key = format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    else key = format(startOfMonth(d), 'yyyy-MM')
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

export function ScrobblesTimeline({ scrobbles, fill }: VizProps) {
  const [gran, setGran] = useState<Granularity>('month')
  const [cumulative, setCumulative] = useState(false)
  const [showMA, setShowMA] = useState(false)
  const [maWindow, setMaWindow] = useState(MA_WINDOW['month'])

  const switchGran = (g: Granularity) => { setGran(g); setMaWindow(MA_WINDOW[g]) }

  const chartData = useMemo(() => {
    const map = bucket(scrobbles, gran)
    const keys = [...map.keys()].sort()
    const counts = keys.map(k => map.get(k) ?? 0)

    const values = cumulative
      ? counts.reduce<number[]>((acc, v) => { acc.push((acc[acc.length - 1] ?? 0) + v); return acc }, [])
      : counts

    const labels = keys.map(k => {
      if (gran === 'month') return format(new Date(k + '-01T12:00:00'), 'MMM yyyy')
      return format(new Date(k + 'T12:00:00'), 'MMM d, yyyy')
    })

    const datasets = [
      {
        label: cumulative ? 'Total scrobbles' : 'Scrobbles',
        data: values,
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: cumulative ? 0.1 : 0.3,
        pointRadius: gran === 'day' ? 0 : 3,
      },
    ]

    if (showMA && !cumulative) {
      datasets.push({
        label: `${maWindow}-${gran} avg`,
        data: movingAverage(values, maWindow),
        borderColor: 'rgb(107, 114, 128)',
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        // @ts-expect-error borderDash is valid but not in the type
        borderDash: [4, 4],
        borderWidth: 1.5,
      })
    }

    return { labels, datasets }
  }, [scrobbles, gran, cumulative, showMA, maWindow])

  if (scrobbles.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data yet.</div>
  }

  return (
    <div className={fill ? 'h-full flex flex-col gap-3 min-h-0' : 'bg-white rounded-xl border border-gray-200 p-5 space-y-4'}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        {!fill && <h2 className="font-semibold text-gray-800">Scrobbles Over Time</h2>}
        <div className="flex gap-1 flex-wrap">
          {(['day', 'week', 'month'] as Granularity[]).map(g => (
            <button
              key={g}
              onClick={() => switchGran(g)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                gran === g ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </button>
          ))}
          <div className="w-px bg-gray-200 mx-1" />
          <button
            onClick={() => setCumulative(c => !c)}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
              cumulative ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Cumulative
          </button>
          <button
            onClick={() => setShowMA(v => !v)}
            disabled={cumulative}
            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${
              showMA && !cumulative ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Moving avg
          </button>
          {showMA && !cumulative && MA_OPTIONS[gran].map(opt => (
            <button
              key={opt.value}
              onClick={() => setMaWindow(opt.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                maWindow === opt.value ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div className={fill ? 'flex-1 min-h-0' : ''}>
        <Line
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: !fill,
            plugins: { legend: { display: false } },
            scales: {
              x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } },
              y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
            },
          }}
        />
      </div>
    </div>
  )
}
