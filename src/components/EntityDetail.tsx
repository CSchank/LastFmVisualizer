import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { format, fromUnixTime, formatDistanceToNowStrict } from 'date-fns'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import type { Scrobble } from '../db'
import { getDb } from '../db'
import { getArtistImage, setArtistImageManual } from '../api/artistImages'
import { splitArtists, buildRawArtistSet } from '../utils/artists'
import { CloseIcon, MusicNoteIcon, UserAvatarIcon } from './icons/CommonIcons'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

export type Entity =
  | { kind: 'artist'; artist: string }
  | { kind: 'album'; artist: string; title: string }
  | { kind: 'track'; artist: string; title: string }

// Optional time window to scope a detail modal to (e.g. a single year). The
// modal still offers an "All time" toggle.
export type Period = { from: number; to: number; label: string }

function sameEntity(a: Entity, b: Entity): boolean {
  return a.kind === b.kind && a.artist === b.artist &&
    ('title' in a ? a.title : '') === ('title' in b ? b.title : '')
}

const Ctx = createContext<{ open: (e: Entity, period?: Period) => void }>({ open: () => {} })
export function useEntityDetail() { return useContext(Ctx) }

// Renders an entity name as a button that opens its detail modal. Use across
// visualizations so any artist/album/track name is clickable. Pass `period` to
// scope the opened modal to a time window (e.g. the year in a recap).
export function EntityLink({ entity, period, className, title, children }: {
  entity: Entity; period?: Period; className?: string; title?: string; children: React.ReactNode
}) {
  const { open } = useEntityDetail()
  return (
    <button
      type="button"
      title={title}
      onClick={e => { e.stopPropagation(); open(entity, period) }}
      className={`text-left hover:text-red-600 hover:underline ${className ?? ''}`}
    >
      {children}
    </button>
  )
}

// Build an entity from a "Title — Artist" composite label (or a plain artist
// name) given the dimension. Several views key albums/tracks this way.
export function entityFromComposite(name: string, dim: 'artist' | 'album' | 'track'): Entity {
  if (dim === 'artist') return { kind: 'artist', artist: name }
  const sep = ' — '
  const i = name.lastIndexOf(sep)
  return i >= 0
    ? { kind: dim, title: name.slice(0, i), artist: name.slice(i + sep.length) }
    : { kind: dim, title: name, artist: name }
}

function getApiKey(): string { return localStorage.getItem('lastfm_api_key') ?? '' }
function getUsername(): string { return localStorage.getItem('lastfm_active_account') ?? '' }

export function EntityDetailProvider({
  scrobbles, splitCollabs, children,
}: { scrobbles: Scrobble[]; splitCollabs: boolean; children: React.ReactNode }) {
  const [stack, setStack] = useState<Entity[]>([])
  // Time scope for the current modal session; persists across in-modal
  // navigation and resets when the modal fully closes.
  const [period, setPeriod] = useState<Period | null>(null)

  const open = useCallback((e: Entity, p?: Period) => {
    if (p !== undefined) setPeriod(p)
    setStack(prev => {
      const top = prev[prev.length - 1]
      if (top && sameEntity(top, e)) return prev
      return [...prev, e]
    })
  }, [])

  const close = useCallback(() => { setStack([]); setPeriod(null) }, [])
  const current = stack[stack.length - 1] ?? null

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {current && (
        <EntityModal
          entity={current}
          scrobbles={scrobbles}
          splitCollabs={splitCollabs}
          period={period}
          canBack={stack.length > 1}
          onBack={() => setStack(prev => prev.slice(0, -1))}
          onClose={close}
          onOpen={open}
        />
      )}
    </Ctx.Provider>
  )
}

interface ModalProps {
  entity: Entity
  scrobbles: Scrobble[]
  splitCollabs: boolean
  period: Period | null
  canBack: boolean
  onBack: () => void
  onClose: () => void
  onOpen: (e: Entity) => void
}

function EntityModal({ entity, scrobbles, splitCollabs, period, canBack, onBack, onClose, onOpen }: ModalProps) {
  const [artistImg, setArtistImg] = useState<string | null>(null)
  const [scoped, setScoped] = useState(true)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Active time window: only when a period was supplied and not toggled off.
  const range = scoped ? period : null
  const inRange = useMemo(
    () => range ? scrobbles.filter(s => s.timestamp >= range.from && s.timestamp <= range.to) : scrobbles,
    [scrobbles, range],
  )

  // Protective raw-artist set spans the whole library (band-name splitting).
  const raw = useMemo(() => buildRawArtistSet(scrobbles), [scrobbles])

  // Counts for ranking — over the active range (so rank reflects the scope,
  // e.g. "#3 artist in 2024").
  const ranks = useMemo(() => {
    const artist = new Map<string, number>()
    const album = new Map<string, number>()
    const track = new Map<string, number>()
    for (const s of inRange) {
      const names = splitCollabs ? splitArtists(s.artist, raw) : [s.artist]
      for (const n of names) artist.set(n, (artist.get(n) ?? 0) + 1)
      album.set(`${s.album}\x00${s.artist}`, (album.get(`${s.album}\x00${s.artist}`) ?? 0) + 1)
      track.set(`${s.track}\x00${s.artist}`, (track.get(`${s.track}\x00${s.artist}`) ?? 0) + 1)
    }
    const rankOf = (m: Map<string, number>, key: string) => {
      const v = m.get(key) ?? 0
      let r = 1
      for (const c of m.values()) if (c > v) r++
      return { rank: r, total: m.size }
    }
    return { artist, album, track, rankOf }
  }, [inRange, splitCollabs, raw])

  const matched = useMemo(() => {
    let m: Scrobble[]
    if (entity.kind === 'artist') {
      m = inRange.filter(s => (splitCollabs ? splitArtists(s.artist, raw) : [s.artist]).includes(entity.artist))
    } else if (entity.kind === 'album') {
      m = inRange.filter(s => s.artist === entity.artist && s.album === entity.title)
    } else {
      m = inRange.filter(s => s.artist === entity.artist && s.track === entity.title)
    }
    return m.sort((a, b) => b.timestamp - a.timestamp)
  }, [entity, inRange, splitCollabs, raw])

  const stats = useMemo(() => {
    const plays = matched.length
    const first = plays ? matched[plays - 1].timestamp : 0
    const last = plays ? matched[0].timestamp : 0
    const days = new Set(matched.map(s => format(fromUnixTime(s.timestamp), 'yyyy-MM-dd'))).size
    const uniqueAlbums = new Set(matched.map(s => s.album).filter(Boolean)).size
    const uniqueTracks = new Set(matched.map(s => s.track)).size
    const r = entity.kind === 'artist'
      ? ranks.rankOf(ranks.artist, entity.artist)
      : entity.kind === 'album'
        ? ranks.rankOf(ranks.album, `${entity.title}\x00${entity.artist}`)
        : ranks.rankOf(ranks.track, `${entity.title}\x00${entity.artist}`)
    return { plays, first, last, days, uniqueAlbums, uniqueTracks, ...r, pct: inRange.length ? (plays / inRange.length) * 100 : 0 }
  }, [matched, entity, ranks, inRange.length])

  // Top albums/tracks (for artist) or tracks (for album)
  const top = useMemo(() => {
    const agg = (key: (s: Scrobble) => string) => {
      const m = new Map<string, number>()
      for (const s of matched) { const k = key(s); if (k) m.set(k, (m.get(k) ?? 0) + 1) }
      return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
    }
    if (entity.kind === 'artist') return { albums: agg(s => s.album), tracks: agg(s => s.track) }
    if (entity.kind === 'album') return { albums: [] as [string, number][], tracks: agg(s => s.track) }
    return { albums: agg(s => s.album), tracks: [] as [string, number][] }
  }, [matched, entity.kind])

  // Plays over time, bucketed by month
  const chartData = useMemo(() => {
    if (!matched.length) return null
    const buckets = new Map<string, number>()
    for (const s of matched) {
      const k = format(fromUnixTime(s.timestamp), 'yyyy-MM')
      buckets.set(k, (buckets.get(k) ?? 0) + 1)
    }
    // fill gaps between first and last month
    const keys = [...buckets.keys()].sort()
    const out: { label: string; count: number }[] = []
    if (keys.length) {
      let [y, mo] = keys[0].split('-').map(Number)
      const [ey, emo] = keys[keys.length - 1].split('-').map(Number)
      while (y < ey || (y === ey && mo <= emo)) {
        const k = `${y}-${String(mo).padStart(2, '0')}`
        out.push({ label: format(new Date(y, mo - 1, 1), 'MMM yyyy'), count: buckets.get(k) ?? 0 })
        mo++; if (mo > 12) { mo = 1; y++ }
        if (out.length > 600) break
      }
    }
    return {
      labels: out.map(o => o.label),
      datasets: [{ data: out.map(o => o.count), backgroundColor: 'rgba(239, 68, 68, 0.8)', borderRadius: 3 }],
    }
  }, [matched])

  // artist image
  useEffect(() => {
    setArtistImg(null)
    if (entity.kind !== 'artist') return
    const apiKey = getApiKey(), username = getUsername()
    if (!apiKey || !username) return
    let cancelled = false
    getArtistImage(entity.artist, apiKey, getDb(username)).then(u => { if (!cancelled) setArtistImg(u) })
    return () => { cancelled = true }
  }, [entity])

  const albumArt = entity.kind !== 'artist' ? matched.find(s => s.imageUrl)?.imageUrl : undefined
  const title = entity.kind === 'artist' ? entity.artist : entity.title
  const subtitle = entity.kind === 'artist' ? 'Artist' : `${entity.kind === 'album' ? 'Album' : 'Track'} · ${entity.artist}`

  const setImage = async () => {
    if (entity.kind !== 'artist') return
    const username = getUsername(); if (!username) return
    const input = window.prompt(`Image URL for ${entity.artist} (blank to clear):`, artistImg ?? '')
    if (input === null) return
    await setArtistImageManual(getDb(username), entity.artist, input)
    setArtistImg(input.trim() || null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onMouseDown={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col" onMouseDown={e => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200">
          {canBack && (
            <button onClick={onBack} title="Back" className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 3 5 8l5 5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          )}
          <div className={`w-12 h-12 ${entity.kind === 'artist' ? 'rounded-full' : 'rounded-lg'} overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center`}>
            {entity.kind === 'artist'
              ? (artistImg ? <img src={artistImg} alt={title} className="w-full h-full object-cover" /> : <UserAvatarIcon className="w-6 h-6 text-gray-300" />)
              : (albumArt ? <img src={albumArt} alt={title} className="w-full h-full object-cover" /> : <MusicNoteIcon className="w-6 h-6 text-gray-300" />)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-gray-800 truncate" title={title}>{title}</h2>
            <p className="text-xs text-gray-500 truncate">
              {subtitle}
              {entity.kind === 'artist' && (
                <button onClick={setImage} className="ml-2 text-red-500 hover:underline">set image</button>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-auto space-y-5">
          {/* time-scope toggle (only when opened with a period) */}
          {period && (
            <div className="flex gap-1">
              {[{ on: true, label: period.label }, { on: false, label: 'All time' }].map(o => (
                <button
                  key={o.label}
                  onClick={() => setScoped(o.on)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    scoped === o.on ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {/* stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Plays" value={stats.plays.toLocaleString()} />
            <Stat label={`Rank`} value={stats.plays ? `#${stats.rank}` : '—'} sub={stats.plays ? `of ${stats.total}` : undefined} />
            <Stat label="% of all" value={`${stats.pct.toFixed(2)}%`} />
            <Stat label="Days played" value={stats.days.toLocaleString()} />
          </div>
          {stats.plays > 0 && (
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
              <span>First: <span className="text-gray-700">{format(fromUnixTime(stats.first), 'MMM d, yyyy')}</span></span>
              <span>Last: <span className="text-gray-700">{format(fromUnixTime(stats.last), 'MMM d, yyyy')}</span> ({formatDistanceToNowStrict(fromUnixTime(stats.last))} ago)</span>
              {entity.kind === 'artist' && <span>{stats.uniqueAlbums} albums · {stats.uniqueTracks} tracks</span>}
              {entity.kind === 'album' && <span>{stats.uniqueTracks} tracks</span>}
            </div>
          )}

          {/* plays over time */}
          {chartData && chartData.labels.length > 1 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Plays over time</p>
              <div className="h-28">
                <Bar
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      x: { grid: { display: false }, ticks: { maxTicksLimit: 8, font: { size: 10 } } },
                      y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.05)' } },
                    },
                  }}
                />
              </div>
            </div>
          )}

          {/* top albums / tracks */}
          {top.albums.length > 0 && (
            <TopList
              title={entity.kind === 'track' ? 'Appears on' : 'Top albums'}
              items={top.albums}
              onClick={album => onOpen({ kind: 'album', artist: entity.artist, title: album })}
            />
          )}
          {top.tracks.length > 0 && (
            <TopList
              title={entity.kind === 'album' ? 'Tracks' : 'Top tracks'}
              items={top.tracks}
              onClick={track => onOpen({ kind: 'track', artist: entity.artist, title: track })}
            />
          )}

          {/* play history */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Play history{matched.length > 300 ? ` · showing 300 of ${matched.length.toLocaleString()}` : ''}
            </p>
            <div className="border border-gray-100 rounded-lg divide-y divide-gray-100 max-h-72 overflow-auto">
              {matched.slice(0, 300).map((s, i) => (
                <div key={`${s.timestamp}-${i}`} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                  <span className="truncate text-gray-700">
                    {entity.kind === 'artist' ? s.track : entity.kind === 'album' ? s.track : (s.album || '—')}
                  </span>
                  <span className="text-xs text-gray-400 whitespace-nowrap tabular-nums">
                    {format(fromUnixTime(s.timestamp), 'MMM d, yyyy HH:mm')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

function TopList({ title, items, onClick }: { title: string; items: [string, number][]; onClick: (name: string) => void }) {
  const max = Math.max(...items.map(i => i[1]), 1)
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{title}</p>
      <div className="space-y-1">
        {items.map(([name, count]) => (
          <button key={name} onClick={() => onClick(name)}
            className="w-full flex items-center gap-2 group text-left">
            <span className="relative flex-1 min-w-0 rounded-md overflow-hidden bg-gray-50 px-2 py-1">
              <span className="absolute inset-y-0 left-0 bg-red-100 group-hover:bg-red-200 transition-colors" style={{ width: `${(count / max) * 100}%` }} />
              <span className="relative text-sm text-gray-700 group-hover:text-red-600 truncate block">{name || '—'}</span>
            </span>
            <span className="text-xs text-gray-400 tabular-nums shrink-0 w-10 text-right">{count}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
