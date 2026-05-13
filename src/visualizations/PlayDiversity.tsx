import { useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js'
import { format, fromUnixTime, startOfMonth, startOfWeek, getQuarter } from 'date-fns'
import type { VizProps } from './registry'
import type { Scrobble } from '../db'
import { splitArtists, buildRawArtistSet } from '../utils/artists'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

type Granularity = 'week' | 'month' | 'quarter' | 'year'
type Dimension = 'artist' | 'album' | 'track'
type Metric = 'effective' | 'unique' | 'new' | 'concentration'

const METRIC_LABEL: Record<Metric, string> = {
  effective: 'Effective diversity',
  unique: 'Unique items',
  new: 'New discoveries',
  concentration: 'Top-10 share',
}

const METRIC_HELP: Record<Metric, string> = {
  effective: 'Like listening to this many equally-played items each period — Shannon-effective count.',
  unique: 'Distinct items played in each period.',
  new: 'Items played for the first time ever in each period.',
  concentration: 'Share of plays from each period’s top 10. Lower means more spread out.',
}

const DIM_PLURAL: Record<Dimension, string> = {
  artist: 'artists',
  album: 'albums',
  track: 'tracks',
}

interface PeriodData {
  key: string
  label: string
  plays: number
  unique: number
  effective: number
  newCount: number
  concentration: number
  topItems: { name: string; count: number }[]
  newItems: string[]
}

function bucketKey(ts: number, gran: Granularity): string {
  const d = fromUnixTime(ts)
  if (gran === 'week') return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  if (gran === 'month') return format(startOfMonth(d), 'yyyy-MM')
  if (gran === 'quarter') return `${d.getFullYear()}-Q${getQuarter(d)}`
  return `${d.getFullYear()}`
}

function bucketLabel(key: string, gran: Granularity): string {
  if (gran === 'year' || gran === 'quarter') return key
  if (gran === 'week') return format(new Date(key + 'T12:00:00'), 'MMM d, yyyy')
  return format(new Date(key + '-01T12:00:00'), 'MMM yyyy')
}

function entityKey(s: Scrobble, dim: Dimension): string {
  if (dim === 'artist') return s.artist
  if (dim === 'album') return s.album ? `${s.album}\x00${s.artist}` : ''
  return `${s.track}\x00${s.artist}`
}

function displayName(key: string, dim: Dimension): string {
  if (dim === 'artist') return key
  const [name, artist] = key.split('\x00')
  return `${name} — ${artist}`
}

function shannonEffective(counts: Map<string, number>, total: number): number {
  if (total === 0) return 0
  let h = 0
  for (const c of counts.values()) {
    const p = c / total
    if (p > 0) h -= p * Math.log(p)
  }
  return Math.exp(h)
}

function itemsFor(s: Scrobble, dim: Dimension, splitCollabs: boolean, raw: Set<string>): string[] {
  if (dim === 'artist' && splitCollabs) return splitArtists(s.artist, raw)
  const k = entityKey(s, dim)
  return k ? [k] : []
}

export function PlayDiversity({ scrobbles, splitCollabs }: VizProps) {
  const [gran, setGran] = useState<Granularity>('month')
  const [dim, setDim] = useState<Dimension>('artist')
  const [metric, setMetric] = useState<Metric>('effective')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const raw = useMemo(() => buildRawArtistSet(scrobbles), [scrobbles])

  const periods = useMemo<PeriodData[]>(() => {
    const sorted = [...scrobbles].sort((a, b) => a.timestamp - b.timestamp)
    const periodMap = new Map<string, Map<string, number>>()
    const order: string[] = []

    for (const s of sorted) {
      const pk = bucketKey(s.timestamp, gran)
      let m = periodMap.get(pk)
      if (!m) { m = new Map(); periodMap.set(pk, m); order.push(pk) }
      for (const item of itemsFor(s, dim, splitCollabs, raw)) {
        m.set(item, (m.get(item) ?? 0) + 1)
      }
    }

    const result: PeriodData[] = []
    const seen = new Set<string>()

    for (const pk of order) {
      const counts = periodMap.get(pk)!
      let total = 0
      for (const c of counts.values()) total += c

      const newItems: string[] = []
      for (const item of counts.keys()) if (!seen.has(item)) newItems.push(item)

      const sortedItems = [...counts.entries()].sort((a, b) => b[1] - a[1])
      const top10 = sortedItems.slice(0, 10).reduce((a, [, c]) => a + c, 0)

      result.push({
        key: pk,
        label: bucketLabel(pk, gran),
        plays: total,
        unique: counts.size,
        effective: shannonEffective(counts, total),
        newCount: newItems.length,
        concentration: total > 0 ? top10 / total : 0,
        topItems: sortedItems.slice(0, 10).map(([name, count]) => ({ name, count })),
        newItems,
      })

      for (const item of counts.keys()) seen.add(item)
    }

    return result
  }, [scrobbles, gran, dim, splitCollabs, raw])

  const aggregate = useMemo(() => {
    const counts = new Map<string, number>()
    let total = 0
    for (const s of scrobbles) {
      for (const item of itemsFor(s, dim, splitCollabs, raw)) {
        counts.set(item, (counts.get(item) ?? 0) + 1)
        total++
      }
    }
    const sortedItems = [...counts.entries()].sort((a, b) => b[1] - a[1])
    const top10 = sortedItems.slice(0, 10).reduce((a, [, c]) => a + c, 0)
    return {
      plays: total,
      unique: counts.size,
      effective: shannonEffective(counts, total),
      concentration: total > 0 ? top10 / total : 0,
    }
  }, [scrobbles, dim, splitCollabs, raw])

  const selectedPeriod =
    (selectedKey && periods.find(p => p.key === selectedKey)) || periods[periods.length - 1]

  const chartData = useMemo(() => ({
    labels: periods.map(p => p.label),
    datasets: [{
      label: METRIC_LABEL[metric],
      data: periods.map(p => {
        if (metric === 'effective') return p.effective
        if (metric === 'unique') return p.unique
        if (metric === 'new') return p.newCount
        return p.concentration * 100
      }),
      borderColor: 'rgb(239, 68, 68)',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 6,
    }],
  }), [periods, metric])

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { dataIndex: number }) => {
            const p = periods[ctx.dataIndex]
            const value =
              metric === 'effective' ? `Effective: ${p.effective.toFixed(1)} ${DIM_PLURAL[dim]}`
              : metric === 'unique' ? `Unique: ${p.unique.toLocaleString()} ${DIM_PLURAL[dim]}`
              : metric === 'new' ? `New: ${p.newCount.toLocaleString()} ${DIM_PLURAL[dim]}`
              : `Top-10 share: ${(p.concentration * 100).toFixed(1)}%`
            return [value, `${p.plays.toLocaleString()} plays · ${p.unique} unique`]
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(0,0,0,0.05)' },
        ticks: metric === 'concentration'
          ? { callback: (v: string | number) => `${v}%` }
          : undefined,
      },
    },
    onClick: (_: unknown, elements: { index: number }[]) => {
      if (elements.length > 0) {
        const p = periods[elements[0].index]
        if (p) setSelectedKey(p.key)
      }
    },
  }), [periods, metric, dim])

  if (scrobbles.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data yet.</div>
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-semibold text-gray-800">Play Diversity</h2>
            <p className="text-xs text-gray-500 mt-0.5">{METRIC_HELP[metric]}</p>
          </div>
          <div className="flex gap-1 flex-wrap items-center">
            {(['week', 'month', 'quarter', 'year'] as Granularity[]).map(g => (
              <button key={g} onClick={() => setGran(g)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  gran === g ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
            <div className="w-px bg-gray-200 mx-1" />
            {(['artist', 'album', 'track'] as Dimension[]).map(d => (
              <button key={d} onClick={() => setDim(d)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  dim === d ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                {d.charAt(0).toUpperCase() + d.slice(1)}s
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Total plays" value={aggregate.plays.toLocaleString()} />
          <Stat label={`Unique ${DIM_PLURAL[dim]}`} value={aggregate.unique.toLocaleString()} />
          <Stat
            label="Effective overall"
            value={aggregate.effective.toFixed(1)}
            sub={`like ${aggregate.effective.toFixed(0)} equally-played`}
          />
          <Stat label="Top-10 share" value={`${(aggregate.concentration * 100).toFixed(1)}%`} />
        </div>

        <div className="flex gap-1 flex-wrap">
          {(['effective', 'unique', 'new', 'concentration'] as Metric[]).map(m => (
            <button key={m} onClick={() => setMetric(m)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                metric === m ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {METRIC_LABEL[m]}
            </button>
          ))}
        </div>

        <div className="h-72">
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {selectedPeriod && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-medium text-gray-700">
              Detail: <span className="text-gray-900 font-semibold">{selectedPeriod.label}</span>
            </h3>
            <select
              value={selectedPeriod.key}
              onChange={e => setSelectedKey(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-300"
            >
              {[...periods].reverse().map(p => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Plays" value={selectedPeriod.plays.toLocaleString()} />
            <Stat label={`Unique ${DIM_PLURAL[dim]}`} value={selectedPeriod.unique.toLocaleString()} />
            <Stat
              label="Effective"
              value={selectedPeriod.effective.toFixed(1)}
              sub={selectedPeriod.unique > 0 ? `${((selectedPeriod.effective / selectedPeriod.unique) * 100).toFixed(0)}% of unique` : undefined}
            />
            <Stat label="New discoveries" value={selectedPeriod.newCount.toLocaleString()} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Top {DIM_PLURAL[dim]} this period
              </h4>
              <div className="space-y-1.5 text-sm">
                {selectedPeriod.topItems.map((item, i) => (
                  <div key={item.name} className="flex justify-between gap-2">
                    <span className="text-gray-700 truncate">
                      <span className="text-gray-400 mr-2 tabular-nums">{i + 1}</span>
                      {displayName(item.name, dim)}
                    </span>
                    <span className="text-gray-500 tabular-nums shrink-0">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                First-time ever this period
              </h4>
              <div className="text-sm space-y-1 max-h-64 overflow-y-auto pr-1">
                {selectedPeriod.newItems.length === 0 ? (
                  <p className="text-gray-400">None — every {dim} you played was already in your history.</p>
                ) : (
                  selectedPeriod.newItems.slice(0, 50).map(item => (
                    <div key={item} className="text-gray-700 truncate">
                      {displayName(item, dim)}
                    </div>
                  ))
                )}
                {selectedPeriod.newItems.length > 50 && (
                  <p className="text-xs text-gray-400 mt-2">
                    +{selectedPeriod.newItems.length - 50} more
                  </p>
                )}
              </div>
            </div>
          </div>
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
