import { useMemo, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js'
import { subDays } from 'date-fns'
import type { VizProps } from './registry'
import type { Scrobble } from '../db'
import { splitArtists, buildRawArtistSet } from '../utils/artists'
import { useEntityDetail } from '../components/EntityDetail'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

type Period = '7d' | '30d' | '90d' | '365d' | 'all'
type Dimension = 'artist' | 'album' | 'track'

const PERIODS: { label: string; value: Period }[] = [
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '3 months', value: '90d' },
  { label: '1 year', value: '365d' },
  { label: 'All time', value: 'all' },
]

function filterByPeriod(scrobbles: Scrobble[], period: Period): Scrobble[] {
  if (period === 'all') return scrobbles
  const days = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }[period]
  const cutoff = subDays(new Date(), days).getTime() / 1000
  return scrobbles.filter(s => s.timestamp >= cutoff)
}

function topN(scrobbles: Scrobble[], dim: Dimension, n: number, splitCollabs: boolean, raw: Set<string>) {
  const counts = new Map<string, number>()
  const meta = new Map<string, { artist: string; title?: string }>()
  for (const s of scrobbles) {
    if (dim === 'artist') {
      const artists = splitCollabs ? splitArtists(s.artist, raw) : [s.artist]
      for (const a of artists) {
        if (a.trim()) { counts.set(a, (counts.get(a) ?? 0) + 1); meta.set(a, { artist: a }) }
      }
    } else {
      const title = dim === 'album' ? s.album : s.track
      const k = `${title} — ${s.artist}`
      if (k.trim()) { counts.set(k, (counts.get(k) ?? 0) + 1); meta.set(k, { artist: s.artist, title }) }
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count, ...meta.get(name)! }))
}

export function TopCharts({ scrobbles, splitCollabs, fill }: VizProps) {
  const [period, setPeriod] = useState<Period>('all')
  const [dim, setDim] = useState<Dimension>('artist')
  const { open } = useEntityDetail()

  const raw = useMemo(() => buildRawArtistSet(scrobbles), [scrobbles])

  const data = useMemo(() => {
    const filtered = filterByPeriod(scrobbles, period)
    return topN(filtered, dim, 20, splitCollabs, raw)
  }, [scrobbles, period, dim, splitCollabs, raw])

  const chartData = useMemo(() => ({
    labels: data.map(d => d.name.length > 30 ? d.name.slice(0, 30) + '…' : d.name),
    datasets: [{
      data: data.map(d => d.count),
      backgroundColor: 'rgba(239, 68, 68, 0.8)',
      borderRadius: 4,
    }],
  }), [data])

  if (scrobbles.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data yet.</div>
  }

  return (
    <div className={fill ? 'h-full flex flex-col gap-3 min-h-0' : 'bg-white rounded-xl border border-gray-200 p-5 space-y-4'}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {(['artist', 'album', 'track'] as Dimension[]).map(d => (
            <button
              key={d}
              onClick={() => setDim(d)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                dim === d ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}s
            </button>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                period === p.value ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-gray-400">No scrobbles in this period.</div>
      ) : (
        <div className={fill ? 'flex-1 min-h-0' : ''}>
          <Bar
            data={chartData}
            options={{
              indexAxis: 'y',
              responsive: true,
              maintainAspectRatio: !fill,
              // Resolve the clicked row from the bar element, or — when the
              // click/hover lands on the tick label or empty track to the left
              // of the bar — from the Y position mapped to the category index.
              onClick: (e, els, chart) => {
                let idx = els[0]?.index
                if (idx === undefined && e.native) {
                  idx = chart.getElementsAtEventForMode(e.native, 'index', { axis: 'y', intersect: false }, false)[0]?.index
                }
                const d = idx !== undefined ? data[idx] : undefined
                if (!d) return
                open(d.title !== undefined ? { kind: dim as 'album' | 'track', artist: d.artist, title: d.title } : { kind: 'artist', artist: d.artist })
              },
              onHover: (e, els, chart) => {
                const t = (e.native?.target as HTMLElement | undefined)
                if (!t) return
                const near = !els.length && e.native
                  ? chart.getElementsAtEventForMode(e.native, 'index', { axis: 'y', intersect: false }, false)
                  : els
                t.style.cursor = near.length ? 'pointer' : 'default'
              },
              plugins: { legend: { display: false } },
              scales: {
                x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                y: { grid: { display: false }, ticks: { font: { size: 11 } } },
              },
            }}
          />
        </div>
      )}
    </div>
  )
}
