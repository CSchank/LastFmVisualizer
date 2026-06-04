import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { format, fromUnixTime, startOfMonth } from 'date-fns'
import type { VizProps } from './registry'
import { splitArtists, buildRawArtistSet } from '../utils/artists'
import { ArtistAvatar } from '../components/ArtistAvatar'
import { useEntityDetail } from '../components/EntityDetail'

const TOP_N = 10
const ROW_H = 48
const GAP = 8

const SPEEDS = [
  { label: 'Slow', ms: 1000 },
  { label: 'Normal', ms: 500 },
  { label: 'Fast', ms: 200 },
]

const PALETTE = [
  '#e6194b', '#4363d8', '#3cb44b', '#f58231', '#911eb4',
  '#42d4f4', '#f032e6', '#800000', '#005f73', '#7c4700',
  '#1a2f80', '#4b0082', '#ff7c7c', '#ffb347', '#57a857',
  '#29b6d8', '#7b96e8', '#c47de8', '#8b4513', '#2e8b57',
  '#4682b4', '#9932cc', '#20b2aa', '#cd853f', '#c0392b',
]

interface FrameEntry { artist: string; count: number }
interface Bar { artist: string; count: number; rank: number; exiting: boolean }

function computeFrames(
  scrobbles: { timestamp: number; artist: string }[],
  splitCollabs: boolean,
  raw: Set<string>,
) {
  const periodSet = new Set<string>()
  for (const s of scrobbles) {
    periodSet.add(format(startOfMonth(fromUnixTime(s.timestamp)), 'yyyy-MM'))
  }
  const periods = [...periodSet].sort()

  const perPeriod = new Map<string, Map<string, number>>()
  for (const s of scrobbles) {
    const p = format(startOfMonth(fromUnixTime(s.timestamp)), 'yyyy-MM')
    if (!perPeriod.has(p)) perPeriod.set(p, new Map())
    const m = perPeriod.get(p)!
    const artists = splitCollabs ? splitArtists(s.artist, raw) : [s.artist]
    for (const a of artists) {
      if (a) m.set(a, (m.get(a) ?? 0) + 1)
    }
  }

  const frames: FrameEntry[][] = []
  const running = new Map<string, number>()
  for (const period of periods) {
    const monthly = perPeriod.get(period) ?? new Map()
    for (const [artist, count] of monthly) {
      running.set(artist, (running.get(artist) ?? 0) + count)
    }
    frames.push(
      [...running.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, TOP_N)
        .map(([artist, count]) => ({ artist, count })),
    )
  }
  return { periods, frames }
}

export function ArtistRace({ scrobbles, splitCollabs }: VizProps) {
  const { open } = useEntityDetail()
  const raw = useMemo(() => buildRawArtistSet(scrobbles), [scrobbles])
  const { periods, frames } = useMemo(
    () => computeFrames(scrobbles, splitCollabs, raw),
    [scrobbles, splitCollabs, raw],
  )

  const [frameIdx, setFrameIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speedIdx, setSpeedIdx] = useState(1)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [bars, setBars] = useState<Bar[]>([])

  const colorMap = useMemo(() => {
    const map = new Map<string, string>()
    let i = 0
    for (const frame of frames) {
      for (const { artist } of frame) {
        if (!map.has(artist)) { map.set(artist, PALETTE[i % PALETTE.length]); i++ }
      }
    }
    return map
  }, [frames])

  const transitionMs = SPEEDS[speedIdx].ms - 50

  // ── Phase 1 (useLayoutEffect — before paint) ───────────────────────────────
  // Updates ranks for existing bars and appends new entrants off-screen.
  //
  // IMPORTANT: we preserve the existing array ORDER rather than sorting by
  // new rank. When React reconciles JSX with stable keys, it only moves a DOM
  // node if its position in the array changed. Moving a node resets its CSS
  // transition. By keeping every existing artist at the same array index we
  // guarantee no DOM node is ever moved — only the `top` style value changes,
  // which triggers the smooth CSS transition.
  useLayoutEffect(() => {
    const current = frames[frameIdx] ?? []
    const currentMap = new Map(current.map((e, i) => [e.artist, { rank: i, count: e.count }]))

    setBars(prev => {
      const active = prev.filter(b => !b.exiting)
      const prevSet = new Set(active.map(b => b.artist))

      // Mutate rank/count in place within the stable ordering.
      const next: Bar[] = active.map(b => {
        const entry = currentMap.get(b.artist)
        if (entry) return { ...b, rank: entry.rank, count: entry.count, exiting: false }
        return { ...b, rank: TOP_N + 1, exiting: true }   // slide off below
      })

      // Append brand-new entrants at the end (off-screen; Phase 2 slides them in).
      for (const e of current) {
        if (!prevSet.has(e.artist)) {
          next.push({ artist: e.artist, count: e.count, rank: TOP_N + 1, exiting: false })
        }
      }

      return next
    })
  }, [frameIdx, frames])

  // ── Phase 2 (useEffect + single rAF — after paint) ────────────────────────
  // Slides entrants from off-screen to their real rank.
  // One rAF is enough because Phase 1's useLayoutEffect already ensured the
  // off-screen position was painted before this fires.
  useEffect(() => {
    const rankMap = new Map((frames[frameIdx] ?? []).map((e, i) => [e.artist, i]))
    const id = requestAnimationFrame(() => {
      setBars(prev => {
        if (!prev.some(b => !b.exiting && b.rank > TOP_N)) return prev
        return prev.map(b => {
          if (b.exiting || b.rank <= TOP_N) return b
          const real = rankMap.get(b.artist)
          return real !== undefined ? { ...b, rank: real } : b
        })
      })
    })
    return () => cancelAnimationFrame(id)
  }, [frameIdx, frames])

  // ── Phase 3 — clean up exiting bars after their animation completes ────────
  useEffect(() => {
    const id = setTimeout(
      () => setBars(prev => prev.filter(b => !b.exiting)),
      transitionMs + 100,
    )
    return () => clearTimeout(id)
  }, [frameIdx, transitionMs])

  // ── Playback ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (!playing) return
    intervalRef.current = setInterval(() => {
      setFrameIdx(i => {
        if (i >= periods.length - 1) { setPlaying(false); return i }
        return i + 1
      })
    }, SPEEDS[speedIdx].ms)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [playing, speedIdx, periods.length])

  const atEnd = frameIdx >= periods.length - 1
  const maxCount = frames[frameIdx]?.[0]?.count ?? 1
  const period = periods[frameIdx]
  const periodLabel = period ? format(new Date(period + '-01T12:00:00'), 'MMMM yyyy') : ''

  if (scrobbles.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data yet.</div>
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
      <div className="flex items-end justify-between">
        <h2 className="font-semibold text-gray-800">Artist Race</h2>
        <span className="text-3xl font-bold text-gray-200 tabular-nums select-none">{periodLabel}</span>
      </div>

      {/* overflow:hidden clips bars that are sliding in/out below the fold */}
      <div className="relative overflow-hidden" style={{ height: TOP_N * (ROW_H + GAP) - GAP }}>
        {bars.map(({ artist, count, rank, exiting }) => {
          const pct = (count / maxCount) * 100
          const color = colorMap.get(artist) ?? '#888'
          return (
            <div
              key={artist}
              className="absolute flex items-center gap-2 w-full"
              style={{
                top: rank * (ROW_H + GAP),
                height: ROW_H,
                opacity: exiting ? 0 : 1,
                transition: `top ${transitionMs}ms ease, opacity ${transitionMs}ms ease`,
                willChange: 'top',
              }}
            >
              <span className="w-5 text-xs text-gray-400 text-right shrink-0 tabular-nums">
                {exiting ? '' : rank + 1}
              </span>
              <ArtistAvatar artist={artist} sizeClass="w-9 h-9" iconClass="w-5 h-5" />
              <div className="flex-1 relative h-full">
                <div
                  className="absolute left-0 inset-y-0 rounded-r-lg flex items-center px-3 overflow-hidden"
                  style={{
                    width: `${Math.max(pct, 0.4)}%`,
                    backgroundColor: color,
                    transition: `width ${transitionMs}ms ease`,
                    willChange: 'width',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => open({ kind: 'artist', artist })}
                    className="text-sm font-semibold text-white whitespace-nowrap truncate drop-shadow hover:underline"
                  >
                    {artist}
                  </button>
                </div>
              </div>
              <span className="w-20 text-sm font-medium text-gray-500 text-right shrink-0 tabular-nums">
                {exiting ? '' : count.toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>

      <input
        type="range"
        min={0}
        max={periods.length - 1}
        value={frameIdx}
        onChange={e => { setFrameIdx(+e.target.value); setPlaying(false) }}
        className="w-full accent-red-500 cursor-pointer"
      />

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => {
            if (atEnd) { setFrameIdx(0); setPlaying(true) }
            else setPlaying(p => !p)
          }}
          className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors w-20 text-center"
        >
          {playing ? 'Pause' : atEnd ? 'Restart' : 'Play'}
        </button>
        <div className="flex gap-1">
          {SPEEDS.map((s, i) => (
            <button
              key={s.label}
              onClick={() => setSpeedIdx(i)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                speedIdx === i ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 ml-auto">
          Cumulative plays · {frameIdx + 1} / {periods.length} months
        </span>
      </div>
    </div>
  )
}
