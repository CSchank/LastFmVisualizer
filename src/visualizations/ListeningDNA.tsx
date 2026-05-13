import { useEffect, useMemo, useRef, useState } from 'react'
import { format, fromUnixTime } from 'date-fns'
import type { VizProps } from './registry'
import type { Scrobble } from '../db'
import { splitArtists, buildRawArtistSet } from '../utils/artists'
import { CloseIcon, MusicNoteIcon } from '../components/icons/CommonIcons'
import { ListeningDNAStripSvg } from './components/ListeningDNAStripSvg'

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

const OTHER_COLOR = '#e5e7eb'      // light gray for "other" artists
const EMPTY_COLOR = '#f9fafb'      // background for days with no plays
const ROW_HEIGHT = 24
const ROW_GAP = 4
const COLS = 366
const LABEL_WIDTH = 40
const MONTH_OFFSET = 18

function isLeap(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function daysInYear(year: number): number {
  return isLeap(year) ? 366 : 365
}

// 0-indexed day of year (Jan 1 = 0)
function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1)
  return Math.floor((d.getTime() - start.getTime()) / 86400000)
}

interface DayInfo {
  total: number
  topArtist: string | null   // top artist for this day (any artist, not just top-N)
}

interface TooltipState {
  date: Date
  total: number
  topArtist: string | null
  x: number
  y: number
}

export function ListeningDNA({ scrobbles, splitCollabs }: VizProps) {
  const [topN, setTopN] = useState<10 | 20 | 40>(20)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [containerWidth, setContainerWidth] = useState(800)

  // Measure container width with ResizeObserver
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const rawArtistSet = useMemo(
    () => splitCollabs ? buildRawArtistSet(scrobbles) : new Set<string>(),
    [scrobbles, splitCollabs],
  )

  // ── Build the data we need in a small number of passes ──────────────────────
  // - global artist counts (for ranking)
  // - per-day per-artist counts (for picking the day's top artist)
  // - per-day total scrobble count
  // - set of years
  const { globalCounts, dayArtistCounts, dayTotals, years } = useMemo(() => {
    const globalCounts = new Map<string, number>()
    const dayArtistCounts = new Map<string, Map<string, number>>()
    const dayTotals = new Map<string, number>()
    const yearSet = new Set<number>()

    for (const s of scrobbles) {
      const d = fromUnixTime(s.timestamp)
      yearSet.add(d.getFullYear())
      const key = format(d, 'yyyy-MM-dd')
      dayTotals.set(key, (dayTotals.get(key) ?? 0) + 1)

      const artists = splitCollabs ? splitArtists(s.artist, rawArtistSet) : [s.artist]
      let perDay = dayArtistCounts.get(key)
      if (!perDay) { perDay = new Map(); dayArtistCounts.set(key, perDay) }
      for (const a of artists) {
        if (!a) continue
        globalCounts.set(a, (globalCounts.get(a) ?? 0) + 1)
        perDay.set(a, (perDay.get(a) ?? 0) + 1)
      }
    }

    const years = [...yearSet].sort((a, b) => a - b)
    return { globalCounts, dayArtistCounts, dayTotals, years }
  }, [scrobbles, splitCollabs, rawArtistSet])

  // Ranked artists by total plays (descending)
  const rankedArtists = useMemo(
    () => [...globalCounts.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a),
    [globalCounts],
  )

  // Top-N artists with assigned colors and their global rank index
  const topArtists = useMemo(() => {
    return rankedArtists.slice(0, topN).map((artist, i) => ({
      artist,
      color: PALETTE[i % PALETTE.length],
      rank: i,
      plays: globalCounts.get(artist) ?? 0,
    }))
  }, [rankedArtists, topN, globalCounts])

  const topArtistRank = useMemo(() => {
    const m = new Map<string, number>()
    topArtists.forEach(t => m.set(t.artist, t.rank))
    return m
  }, [topArtists])

  const topArtistColor = useMemo(() => {
    const m = new Map<string, string>()
    topArtists.forEach(t => m.set(t.artist, t.color))
    return m
  }, [topArtists])

  // For each day, compute the day's top artist.
  // Tie-break: among artists with equal plays, prefer the one with higher global rank
  // (lower rank index). If neither is in the top-N, just pick the higher overall play count.
  const dayTop = useMemo(() => {
    const result = new Map<string, DayInfo>()
    for (const [dayKey, perDay] of dayArtistCounts) {
      let bestArtist: string | null = null
      let bestCount = -1
      let bestRank = Infinity
      let bestGlobal = -1
      for (const [artist, count] of perDay) {
        if (count < bestCount) continue
        const rank = topArtistRank.get(artist) ?? Infinity
        const global = globalCounts.get(artist) ?? 0
        if (count > bestCount) {
          bestArtist = artist
          bestCount = count
          bestRank = rank
          bestGlobal = global
          continue
        }
        // Equal count — break ties by global rank (top-N rank, then global plays)
        if (rank < bestRank || (rank === bestRank && global > bestGlobal)) {
          bestArtist = artist
          bestRank = rank
          bestGlobal = global
        }
      }
      result.set(dayKey, {
        total: dayTotals.get(dayKey) ?? 0,
        topArtist: bestArtist,
      })
    }
    return result
  }, [dayArtistCounts, dayTotals, topArtistRank, globalCounts])

  // Per-year scrobble lookup for the click-to-expand panel
  const scrobblesByDay = useMemo(() => {
    if (!selectedDay) return [] as Scrobble[]
    const matches: Scrobble[] = []
    for (const s of scrobbles) {
      const d = fromUnixTime(s.timestamp)
      if (format(d, 'yyyy-MM-dd') === selectedDay) matches.push(s)
    }
    matches.sort((a, b) => b.timestamp - a.timestamp)
    return matches
  }, [scrobbles, selectedDay])

  // Layout calculations — derive cell width from container size
  const availableWidth = Math.max(100, containerWidth - LABEL_WIDTH)
  const cellWidth = Math.max(2, Math.floor(availableWidth / COLS))
  const stripWidth = cellWidth * COLS
  const stripHeight = years.length * ROW_HEIGHT + Math.max(0, years.length - 1) * ROW_GAP
  const totalHeight = MONTH_OFFSET + stripHeight

  // Month label x positions (Jan 1, Feb 1, …) — use a non-leap year for positions;
  // they'll be slightly shifted from leap-year reality but only by 1 day after Feb.
  const monthLabels = useMemo(() => {
    const labels: { x: number; label: string }[] = []
    const ref = 2023 // non-leap reference year
    // Always show all 12 if cellWidth large enough; else show every 3rd month
    const everyMonth = cellWidth >= 3
    for (let m = 0; m < 12; m++) {
      if (!everyMonth && m % 3 !== 0) continue
      const d = new Date(ref, m, 1)
      const x = dayOfYear(d) * cellWidth
      labels.push({ x, label: format(d, 'MMM') })
    }
    return labels
  }, [cellWidth])

  if (scrobbles.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data yet.</div>
  }

  // Helper: color a day cell
  const colorForDay = (dayKey: string): string => {
    const info = dayTop.get(dayKey)
    if (!info || info.total === 0) return EMPTY_COLOR
    if (info.topArtist && topArtistColor.has(info.topArtist)) {
      return topArtistColor.get(info.topArtist)!
    }
    return OTHER_COLOR
  }

  const selectedDate = selectedDay ? new Date(selectedDay + 'T12:00:00') : null

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-semibold text-gray-800">Listening DNA</h2>
          <p className="text-xs text-gray-500 mt-0.5">Each day colored by your top artist.</p>
        </div>
        <div className="flex gap-1 items-center">
          <span className="text-xs text-gray-400 mr-1">Top</span>
          {([10, 20, 40] as const).map(n => (
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

      <div ref={containerRef} className="overflow-x-auto">
        <ListeningDNAStripSvg
          labelWidth={LABEL_WIDTH}
          stripWidth={stripWidth}
          totalHeight={totalHeight}
          monthLabels={monthLabels}
          years={years}
          monthOffset={MONTH_OFFSET}
          rowHeight={ROW_HEIGHT}
          rowGap={ROW_GAP}
          cellWidth={cellWidth}
          selectedDay={selectedDay}
          dayTop={dayTop}
          colorForDay={colorForDay}
          daysInYear={daysInYear}
          onHover={payload => setTooltip(payload)}
          onLeave={() => setTooltip(null)}
          onSelectDay={(dayKey, hasPlays) => {
            if (!hasPlays) return
            setSelectedDay(prev => (prev === dayKey ? null : dayKey))
          }}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {topArtists.map(t => (
          <div
            key={t.artist}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200"
          >
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: t.color }}
            />
            <span className="text-xs text-gray-700">{t.artist}</span>
            <span className="text-xs text-gray-400 tabular-nums">{t.plays.toLocaleString()}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ backgroundColor: OTHER_COLOR }}
          />
          <span className="text-xs text-gray-700">Other</span>
        </div>
      </div>

      {/* Selected day panel */}
      {selectedDate && selectedDay && (
        <div className="border-t border-gray-100 pt-4 -mx-1">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-medium text-gray-700">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              <span className="text-gray-400 font-normal ml-2">
                · {scrobblesByDay.length} {scrobblesByDay.length === 1 ? 'scrobble' : 'scrobbles'}
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
                {scrobblesByDay.map((s, i) => (
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

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 shadow-lg -translate-x-1/2 -translate-y-full -mt-1.5"
          style={{ left: tooltip.x, top: tooltip.y - 6 }}
        >
          <div className="font-medium">{format(tooltip.date, 'EEE, MMM d, yyyy')}</div>
          <div className="text-gray-300">
            {tooltip.total === 0
              ? 'no plays'
              : `${tooltip.total.toLocaleString()} ${tooltip.total === 1 ? 'play' : 'plays'} · ${tooltip.topArtist ?? '—'}`}
          </div>
        </div>
      )}
    </div>
  )
}
