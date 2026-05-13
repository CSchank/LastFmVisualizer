import { useMemo, useState, useRef, useEffect } from 'react'
import { format, fromUnixTime, startOfMonth } from 'date-fns'
import { area, curveMonotoneX } from 'd3-shape'
import type { VizProps } from './registry'
import { splitArtists, buildRawArtistSet } from '../utils/artists'
import { StreamgraphChartSvg } from './components/StreamgraphChartSvg'

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

type TopN = 10 | 15 | 25

interface StreamPoint {
  monthKey: string
  values: Map<string, number> // artist -> plays in that month
}

interface TooltipState {
  x: number
  y: number
  monthKey: string
}

function monthKey(ts: number): string {
  return format(startOfMonth(fromUnixTime(ts)), 'yyyy-MM')
}

function monthLabel(key: string): string {
  return format(new Date(key + '-01T12:00:00'), 'MMM yyyy')
}

export function Streamgraph({ scrobbles, splitCollabs }: VizProps) {
  const [topN, setTopN] = useState<TopN>(15)
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const w = entry.contentRect.width
        if (w > 0) setWidth(w)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const rawArtistSet = useMemo(() => buildRawArtistSet(scrobbles), [scrobbles])

  // Compute total play counts per artist (with optional collab split)
  const totalsByArtist = useMemo(() => {
    const totals = new Map<string, number>()
    for (const s of scrobbles) {
      const artists = splitCollabs ? splitArtists(s.artist, rawArtistSet) : [s.artist]
      for (const a of artists) {
        if (!a) continue
        totals.set(a, (totals.get(a) ?? 0) + 1)
      }
    }
    return totals
  }, [scrobbles, splitCollabs, rawArtistSet])

  // Top N artists, sorted by total plays desc
  const topArtists = useMemo(() => {
    return [...totalsByArtist.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([a]) => a)
  }, [totalsByArtist, topN])

  // Stable color map: by overall rank in topArtists
  const colorByArtist = useMemo(() => {
    const map = new Map<string, string>()
    topArtists.forEach((a, i) => map.set(a, PALETTE[i % PALETTE.length]))
    return map
  }, [topArtists])

  // Build per-month stream points covering all months in scrobble range
  const streamPoints = useMemo<StreamPoint[]>(() => {
    if (scrobbles.length === 0 || topArtists.length === 0) return []
    const topSet = new Set(topArtists)
    const pointsByMonth = new Map<string, Map<string, number>>()

    for (const s of scrobbles) {
      const mk = monthKey(s.timestamp)
      const artists = splitCollabs ? splitArtists(s.artist, rawArtistSet) : [s.artist]
      for (const a of artists) {
        if (!topSet.has(a)) continue
        if (!pointsByMonth.has(mk)) pointsByMonth.set(mk, new Map())
        const m = pointsByMonth.get(mk)!
        m.set(a, (m.get(a) ?? 0) + 1)
      }
    }

    // Determine full month range from earliest to latest scrobble
    const allMonthKeys = new Set<string>()
    for (const s of scrobbles) allMonthKeys.add(monthKey(s.timestamp))
    const sortedMonths = [...allMonthKeys].sort()
    if (sortedMonths.length === 0) return []
    // Fill gap months too so the area is continuous
    const filled: string[] = []
    const first = sortedMonths[0]
    const last = sortedMonths[sortedMonths.length - 1]
    const [fy, fm] = first.split('-').map(Number)
    const [ly, lm] = last.split('-').map(Number)
    let y = fy
    let m = fm
    while (y < ly || (y === ly && m <= lm)) {
      filled.push(`${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}`)
      m++
      if (m > 12) { m = 1; y++ }
    }

    return filled.map(mk => ({
      monthKey: mk,
      values: pointsByMonth.get(mk) ?? new Map(),
    }))
  }, [scrobbles, topArtists, splitCollabs, rawArtistSet])

  // Layout (silhouette baseline)
  const HEIGHT = 360
  const PADDING = { top: 12, right: 12, bottom: 12, left: 12 }
  const innerWidth = Math.max(50, width - PADDING.left - PADDING.right)
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom

  const layout = useMemo(() => {
    if (streamPoints.length === 0 || topArtists.length === 0) {
      return { layers: [] as { artist: string; path: string; color: string }[], maxTotal: 0, xs: [] as number[] }
    }

    const N = streamPoints.length
    const xs = streamPoints.map((_, i) =>
      N === 1 ? innerWidth / 2 : (i / (N - 1)) * innerWidth,
    )

    // Compute per-month totals to find the global max for vertical scaling
    let maxTotal = 0
    const totals: number[] = streamPoints.map(p => {
      let t = 0
      for (const a of topArtists) t += p.values.get(a) ?? 0
      if (t > maxTotal) maxTotal = t
      return t
    })

    if (maxTotal === 0) {
      return { layers: [], maxTotal: 0, xs }
    }

    // For each month, compute symmetric bands: silhouette baseline = total/2 above center
    // Stack order: top-ranked artists in middle, lower-ranked toward outside.
    // Common streamgraph convention: alternate around center for visual balance.
    // We'll just stack in rank order from center outward by interleaving.
    const stackOrder: string[] = []
    // Place rank 0 at center, then alternate above/below
    const above: string[] = []
    const below: string[] = []
    topArtists.forEach((a, i) => {
      if (i === 0) stackOrder.push(a)
      else if (i % 2 === 1) above.push(a)
      else below.push(a)
    })
    // Final order from bottom of stack to top:
    // [...belowReversed, centerArtist, ...above]  but we just need a stack order;
    // for symmetric silhouette we instead compute band positions per artist directly.
    // Simpler approach: put artists in rank order and use silhouette stacking
    // (centered around 0). The visual is the same regardless of stack order
    // since silhouette centers the total.
    const stackedOrder = topArtists // rank 0 at bottom of stack

    // For each artist, store y0[i] and y1[i] arrays in pixel coords
    const yScale = (v: number) => (v / maxTotal) * innerHeight

    // Compute cumulative bottoms per month for stacking, then offset by silhouette
    const cumulative: number[][] = streamPoints.map(() => [0])
    for (const a of stackedOrder) {
      streamPoints.forEach((p, i) => {
        const v = p.values.get(a) ?? 0
        cumulative[i].push(cumulative[i][cumulative[i].length - 1] + v)
      })
    }

    // Silhouette offset per month: -total / 2 (in data space)
    const offsets = totals.map(t => -t / 2)

    const centerY = PADDING.top + innerHeight / 2

    const layers = stackedOrder.map((artist, layerIdx) => {
      const points = streamPoints.map((_, i) => {
        const y0Data = cumulative[i][layerIdx] + offsets[i]
        const y1Data = cumulative[i][layerIdx + 1] + offsets[i]
        return {
          x: PADDING.left + xs[i],
          y0: centerY + yScale(y0Data),
          y1: centerY + yScale(y1Data),
        }
      })

      const areaGen = area<{ x: number; y0: number; y1: number }>()
        .x(d => d.x)
        .y0(d => d.y0)
        .y1(d => d.y1)
        .curve(curveMonotoneX)

      return {
        artist,
        color: colorByArtist.get(artist) ?? '#888',
        path: areaGen(points) ?? '',
      }
    })

    return { layers, maxTotal, xs }
  }, [streamPoints, topArtists, innerWidth, innerHeight, colorByArtist])

  // Helper: nearest month index from mouse x
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (streamPoints.length === 0 || layout.xs.length === 0) return
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    const localX = e.clientX - rect.left - PADDING.left
    let nearest = 0
    let best = Infinity
    for (let i = 0; i < layout.xs.length; i++) {
      const d = Math.abs(layout.xs[i] - localX)
      if (d < best) { best = d; nearest = i }
    }
    const mk = streamPoints[nearest].monthKey
    setTooltip({
      x: e.clientX,
      y: rect.top,
      monthKey: mk,
    })
  }

  const handleMouseLeave = () => setTooltip(null)

  // X-axis month tick labels (sparse)
  const xTicks = useMemo(() => {
    if (streamPoints.length === 0) return [] as { x: number; label: string }[]
    const N = streamPoints.length
    const desired = Math.min(8, N)
    const step = Math.max(1, Math.floor(N / desired))
    const ticks: { x: number; label: string }[] = []
    for (let i = 0; i < N; i += step) {
      ticks.push({ x: PADDING.left + layout.xs[i], label: format(new Date(streamPoints[i].monthKey + '-01T12:00:00'), 'MMM yy') })
    }
    return ticks
  }, [streamPoints, layout.xs])

  if (scrobbles.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data yet.</div>
  }

  // Tooltip data: artist plays for the hovered month, sorted desc, skip 0
  const tooltipRows = useMemo(() => {
    if (!tooltip) return [] as { artist: string; plays: number; color: string }[]
    const point = streamPoints.find(p => p.monthKey === tooltip.monthKey)
    if (!point) return []
    return topArtists
      .map(a => ({ artist: a, plays: point.values.get(a) ?? 0, color: colorByArtist.get(a) ?? '#888' }))
      .filter(r => r.plays > 0)
      .sort((a, b) => b.plays - a.plays)
  }, [tooltip, streamPoints, topArtists, colorByArtist])

  // Vertical guide x for tooltip
  const guideX = useMemo(() => {
    if (!tooltip) return null
    const idx = streamPoints.findIndex(p => p.monthKey === tooltip.monthKey)
    if (idx < 0) return null
    return PADDING.left + layout.xs[idx]
  }, [tooltip, streamPoints, layout.xs])

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-semibold text-gray-800">Streamgraph</h2>
          <p className="text-xs text-gray-500">Top artists over time as flowing rivers</p>
        </div>
        <div className="flex gap-1 flex-wrap items-center">
          <span className="text-xs text-gray-400 mr-1">Top</span>
          {([10, 15, 25] as TopN[]).map(n => (
            <button
              key={n}
              onClick={() => setTopN(n)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                topN === n ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="w-full">
        {layout.layers.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-400">Not enough data.</div>
        ) : (
          <StreamgraphChartSvg
            width={width}
            height={HEIGHT + 22}
            layers={layout.layers}
            guideX={guideX}
            paddingTop={PADDING.top}
            innerHeight={innerHeight}
            xTicks={xTicks}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {topArtists.map(a => (
          <div
            key={a}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200 text-xs text-gray-700"
          >
            <span
              className="w-2.5 h-2.5 rounded-full inline-block"
              style={{ backgroundColor: colorByArtist.get(a) }}
            />
            <span className="font-medium">{a}</span>
            <span className="text-gray-400">{(totalsByArtist.get(a) ?? 0).toLocaleString()}</span>
          </div>
        ))}
      </div>

      {tooltip && tooltipRows.length > 0 && (
        <div
          className="fixed z-50 pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg -translate-x-1/2 -translate-y-full -mt-2"
          style={{ left: tooltip.x, top: tooltip.y - 6 }}
        >
          <div className="font-medium mb-1">{monthLabel(tooltip.monthKey)}</div>
          <div className="space-y-0.5">
            {tooltipRows.map(r => (
              <div key={r.artist} className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: r.color }}
                />
                <span className="text-gray-200 mr-2">{r.artist}</span>
                <span className="text-gray-400 ml-auto tabular-nums">{r.plays.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
