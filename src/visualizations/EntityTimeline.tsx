import { useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { format, fromUnixTime, startOfMonth, startOfWeek } from 'date-fns'
import type { VizProps } from './registry'
import type { Scrobble } from '../db'
import { movingAverage, MA_WINDOW, MA_OPTIONS } from '../utils/movingAverage'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

export type Dimension = 'artist' | 'album' | 'track'
type Granularity = 'week' | 'month'
type ChartMode = 'line' | 'bump'

const PALETTE = [
  '#e6194b', '#f58231', '#ffe119', '#3cb44b', '#42d4f4',
  '#4363d8', '#911eb4', '#f032e6',
  '#800000', '#7c4700', '#5a5a00', '#1a5c1a', '#005f73',
  '#1a2f80', '#4b0082', '#7a005f',
  '#ff7c7c', '#ffb347', '#c9a800', '#57a857', '#29b6d8',
  '#7b96e8', '#c47de8', '#e87bc4',
  '#8b4513', '#2e8b57', '#4682b4', '#9932cc', '#20b2aa',
  '#cd853f', '#708090', '#c0392b',
]

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

function bucketKey(ts: number, gran: Granularity): string {
  const d = fromUnixTime(ts)
  if (gran === 'week') return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  return format(startOfMonth(d), 'yyyy-MM')
}

function bucketLabel(key: string, gran: Granularity): string {
  if (gran === 'week') return format(new Date(key + 'T12:00:00'), 'MMM d, yyyy')
  return format(new Date(key + '-01T12:00:00'), 'MMM yyyy')
}

function topEntities(scrobbles: Scrobble[], dim: Dimension, n: number): string[] {
  const counts = new Map<string, number>()
  for (const s of scrobbles) {
    const k = entityKey(s, dim)
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k)
}

function buildBuckets(scrobbles: Scrobble[], entities: string[], dim: Dimension, gran: Granularity) {
  const keySet = new Set<string>()
  for (const s of scrobbles) keySet.add(bucketKey(s.timestamp, gran))
  const keys = [...keySet].sort()

  const counts = new Map<string, Map<string, number>>()
  for (const e of entities) counts.set(e, new Map())
  for (const s of scrobbles) {
    const ek = entityKey(s, dim)
    if (!counts.has(ek)) continue
    const bk = bucketKey(s.timestamp, gran)
    const m = counts.get(ek)!
    m.set(bk, (m.get(bk) ?? 0) + 1)
  }

  return { keys, counts }
}

// Compute per-bucket ranking of selected entities against ALL entities
function buildRankings(
  scrobbles: Scrobble[],
  selected: string[],
  dim: Dimension,
  gran: Granularity,
  cumulative: boolean,
) {
  const keySet = new Set<string>()
  for (const s of scrobbles) keySet.add(bucketKey(s.timestamp, gran))
  const keys = [...keySet].sort()

  // Count all entities across all buckets
  const allCounts = new Map<string, Map<string, number>>()
  for (const s of scrobbles) {
    const ek = entityKey(s, dim)
    if (!ek) continue
    if (!allCounts.has(ek)) allCounts.set(ek, new Map())
    const bk = bucketKey(s.timestamp, gran)
    const m = allCounts.get(ek)!
    m.set(bk, (m.get(bk) ?? 0) + 1)
  }

  // For each bucket, rank every entity; extract rank for selected ones
  const rankings = new Map<string, (number | null)[]>()
  for (const e of selected) rankings.set(e, [])

  const runningTotals = new Map<string, number>()

  for (const bk of keys) {
    if (cumulative) {
      for (const [e, m] of allCounts) {
        runningTotals.set(e, (runningTotals.get(e) ?? 0) + (m.get(bk) ?? 0))
      }
      const sorted = [...runningTotals.entries()]
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
      const rankMap = new Map(sorted.map(([e], i) => [e, i + 1]))
      for (const e of selected) {
        rankings.get(e)!.push(rankMap.get(e) ?? null)
      }
    } else {
      const sorted = [...allCounts.entries()]
        .map(([e, m]) => ({ e, count: m.get(bk) ?? 0 }))
        .filter(x => x.count > 0)
        .sort((a, b) => b.count - a.count)
      const rankMap = new Map(sorted.map(({ e }, i) => [e, i + 1]))
      for (const e of selected) {
        rankings.get(e)!.push(rankMap.get(e) ?? null)
      }
    }
  }

  return { keys, rankings }
}

function ordinal(n: number): string {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

interface Props extends VizProps {
  dimension: Dimension
  title: string
}

export function EntityTimeline({ scrobbles, dimension, title }: Props) {
  const [gran, setGran] = useState<Granularity>('month')
  const [mode, setMode] = useState<ChartMode>('line')
  const [cumulative, setCumulative] = useState(false)
  const [showMA, setShowMA] = useState(false)
  const [maWindow, setMaWindow] = useState(MA_WINDOW['month'])

  const switchGran = (g: Granularity) => { setGran(g); setMaWindow(MA_WINDOW[g]) }
  const [rankCap, setRankCap] = useState(20)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [initialised, setInitialised] = useState(false)

  const allEntities = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of scrobbles) {
      const k = entityKey(s, dimension)
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
  }, [scrobbles, dimension])

  useMemo(() => {
    if (!initialised && allEntities.length > 0) {
      setSelected(topEntities(scrobbles, dimension, 5))
      setInitialised(true)
    }
  }, [allEntities, initialised, scrobbles, dimension])

  const lineData = useMemo(
    () => buildBuckets(scrobbles, selected, dimension, gran),
    [scrobbles, selected, dimension, gran],
  )

  const bumpData = useMemo(
    () => mode === 'bump' ? buildRankings(scrobbles, selected, dimension, gran, cumulative) : null,
    [scrobbles, selected, dimension, gran, mode, cumulative],
  )

  // Cap ranks beyond the threshold to null so they drop off the chart
  const cappedBumpData = useMemo(() => {
    if (!bumpData) return null
    const rankings = new Map<string, (number | null)[]>()
    for (const [e, ranks] of bumpData.rankings) {
      rankings.set(e, ranks.map(r => (r !== null && r <= rankCap) ? r : null))
    }
    return { ...bumpData, rankings }
  }, [bumpData, rankCap])

  const chartData = useMemo(() => {
    if (mode === 'bump' && cappedBumpData) {
      return {
        labels: cappedBumpData.keys.map(k => bucketLabel(k, gran)),
        datasets: selected.map((entity, i) => ({
          label: displayName(entity, dimension),
          data: cappedBumpData.rankings.get(entity) ?? [],
          borderColor: PALETTE[i % PALETTE.length],
          backgroundColor: PALETTE[i % PALETTE.length],
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 4,
          spanGaps: false,
        })),
      }
    }

    const { keys, counts } = lineData
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datasets: any[] = []
    for (let i = 0; i < selected.length; i++) {
      const entity = selected[i]
      const perPeriod = keys.map(k => counts.get(entity)?.get(k) ?? 0)
      const data = cumulative
        ? perPeriod.reduce<number[]>((acc, v) => { acc.push((acc[acc.length - 1] ?? 0) + v); return acc }, [])
        : perPeriod
      const color = PALETTE[i % PALETTE.length]
      datasets.push({
        label: displayName(entity, dimension),
        data,
        borderColor: color,
        backgroundColor: color + '18',
        fill: false,
        tension: cumulative ? 0.1 : 0.3,
        pointRadius: gran === 'week' ? 0 : 2,
        borderWidth: 2,
        spanGaps: false,
      })
      if (showMA && !cumulative) {
        datasets.push({
          label: `${displayName(entity, dimension)} (avg)`,
          data: movingAverage(perPeriod, maWindow),
          borderColor: color,
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.3,
          pointRadius: 0,
          borderDash: [4, 4],
          borderWidth: 1.5,
          spanGaps: true,
        })
      }
    }
    return { labels: keys.map(k => bucketLabel(k, gran)), datasets }
  }, [mode, bumpData, lineData, selected, dimension, gran, cumulative, showMA, maWindow])

  const chartOptions = useMemo(() => {
    if (mode === 'bump') {
      return {
        responsive: true,
        interaction: { mode: 'index' as const, intersect: false },
        plugins: {
          legend: { position: 'bottom' as const, labels: { boxWidth: 12, padding: 16, font: { size: 12 } } },
          tooltip: {
            // Reorder so the best rank (lowest number) appears first; nulls last.
            itemSort: (a: { parsed: { y: number | null } }, b: { parsed: { y: number | null } }) => {
              const ay = a.parsed.y, by = b.parsed.y
              if (ay == null && by == null) return 0
              if (ay == null) return 1
              if (by == null) return -1
              return ay - by
            },
            callbacks: {
              label: (ctx: { dataset: { label?: string }; parsed: { y: number | null } }) => {
                const rank = ctx.parsed.y
                return rank != null
                  ? ` ${ctx.dataset.label}: ${ordinal(rank)}`
                  : ` ${ctx.dataset.label}: unranked`
              },
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } },
          y: {
            reverse: true,
            min: 0.5,
            max: rankCap + 0.5,
            ticks: {
              stepSize: rankCap <= 10 ? 1 : rankCap <= 20 ? 2 : 5,
              callback: (v: number | string) => Number.isInteger(v) ? ordinal(v as number) : '',
            },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
        },
      }
    }

    return {
      responsive: true,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: { position: 'bottom' as const, labels: { boxWidth: 12, padding: 16, font: { size: 12 } } },
        tooltip: {
          // Hide moving-average lines from the tooltip and rank by current plays.
          filter: (ctx: { dataset: { label?: string } }) => !ctx.dataset.label?.endsWith(' (avg)'),
          itemSort: (a: { parsed: { y: number | null } }, b: { parsed: { y: number | null } }) =>
            (b.parsed.y ?? -Infinity) - (a.parsed.y ?? -Infinity),
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } },
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
      },
    }
  }, [mode, rankCap])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return q ? allEntities.filter(e => displayName(e, dimension).toLowerCase().includes(q)) : allEntities
  }, [allEntities, query, dimension])

  const toggle = (entity: string) => {
    setSelected(prev => prev.includes(entity) ? prev.filter(e => e !== entity) : [...prev, entity])
  }

  if (scrobbles.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data yet.</div>
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-semibold text-gray-800">{title}</h2>
          <div className="flex gap-1 flex-wrap">
            {(['week', 'month'] as Granularity[]).map(g => (
              <button key={g} onClick={() => switchGran(g)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${gran === g ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </button>
            ))}
            <div className="w-px bg-gray-200 mx-1" />
            <button onClick={() => setMode('line')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${mode === 'line' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Plays
            </button>
            <button onClick={() => { setMode('bump'); setCumulative(false) }}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${mode === 'bump' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Ranking
            </button>
            <div className="w-px bg-gray-200 mx-1" />
            <button onClick={() => setCumulative(c => !c)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${cumulative ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Cumulative
            </button>
            {mode === 'line' && (
              <button
                onClick={() => setShowMA(v => !v)}
                disabled={cumulative}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${showMA && !cumulative ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                Moving avg
              </button>
            )}
            {mode === 'line' && showMA && !cumulative && MA_OPTIONS[gran].map(opt => (
              <button
                key={opt.value}
                onClick={() => setMaWindow(opt.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  maWindow === opt.value ? 'bg-gray-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {mode === 'bump' && (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs text-gray-400">
              {cumulative
                ? `Ranked by total plays up to that point. Lines drop off below top ${rankCap}.`
                : `Ranked by plays that period. Lines drop off below top ${rankCap}.`}
            </p>
            <div className="flex gap-1 items-center">
              <span className="text-xs text-gray-400 mr-1">Show top</span>
              {[10, 20, 50].map(cap => (
                <button key={cap} onClick={() => setRankCap(cap)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${rankCap === cap ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {cap}
                </button>
              ))}
            </div>
          </div>
        )}

        {selected.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-400">Select at least one entry below.</div>
        ) : (
          <Line data={chartData} options={chartOptions} />
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-gray-700">
            {dimension.charAt(0).toUpperCase() + dimension.slice(1)}s{' '}
            <span className="text-gray-400 font-normal">({selected.length} selected)</span>
          </h3>
          <div className="flex gap-2">
            <button onClick={() => setSelected(topEntities(scrobbles, dimension, 5))}
              className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors">Top 5</button>
            <button onClick={() => setSelected(topEntities(scrobbles, dimension, 10))}
              className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors">Top 10</button>
            <button onClick={() => setSelected([])}
              className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors">Clear</button>
          </div>
        </div>

        <input type="search" placeholder={`Search ${dimension}s…`} value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />

        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
          {filtered.slice(0, 100).map((entity) => {
            const isSelected = selected.includes(entity)
            const colorIdx = selected.indexOf(entity)
            return (
              <button key={entity} onClick={() => toggle(entity)}
                className={`px-2.5 py-1 rounded-full text-sm border transition-colors ${isSelected ? 'text-white border-transparent' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                style={isSelected ? { backgroundColor: PALETTE[colorIdx % PALETTE.length], borderColor: PALETTE[colorIdx % PALETTE.length] } : undefined}>
                {displayName(entity, dimension)}
              </button>
            )
          })}
          {filtered.length > 100 && (
            <span className="text-xs text-gray-400 self-center">+{filtered.length - 100} more — refine your search</span>
          )}
        </div>
      </div>
    </div>
  )
}
