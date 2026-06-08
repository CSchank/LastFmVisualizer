import { useMemo, useState } from 'react'
import { format, fromUnixTime } from 'date-fns'
import type { VizProps } from './registry'
import { ArtistAvatar } from '../components/ArtistAvatar'
import { EntityLink, useEntityDetail, type Entity } from '../components/EntityDetail'
import { MusicNoteIcon } from '../components/icons/CommonIcons'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DISCOVERY_LIMIT = 6

interface TrackStat {
  track: string
  artist: string
  album: string
  imageUrl?: string
  plays: number
  firstTs: number
}

interface YearGroup {
  year: number
  total: number
  tracks: TrackStat[]
  topArtist: TopEntity | null
  topAlbum: TopEntity | null
  topTrack: TopEntity | null
}

interface TopEntity {
  name: string
  artist: string
  imageUrl?: string
  plays: number
}

interface Discovery {
  title: string
  artist: string
  imageUrl?: string
  year: number
  ts: number
}

interface Discoveries {
  artists: Discovery[]
  albums: Discovery[]
  tracks: Discovery[]
}

interface SimilarDay {
  month: number
  day: number
  score: number
  sharedArtist: string | null
}

function daysInMonth(month: number): number {
  // Use a leap year so February allows 29.
  return new Date(2024, month + 1, 0).getDate()
}

// Album art square with a music-note fallback. Album/track art rides on the
// scrobble's imageUrl. Pass `entity` to make it open the detail modal on click.
function Art({ url, alt, entity, sizeClass = 'w-10 h-10', iconClass = 'w-5 h-5' }: {
  url?: string | null; alt: string; entity?: Entity; sizeClass?: string; iconClass?: string
}) {
  const { open } = useEntityDetail()
  const [errored, setErrored] = useState(false)
  const inner = url && !errored
    ? <img src={url} alt={alt} onError={() => setErrored(true)} className="w-full h-full object-cover" />
    : <MusicNoteIcon className={`${iconClass} text-gray-300`} />
  const cls = `${sizeClass} rounded overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center`
  if (!entity) return <div className={cls}>{inner}</div>
  return (
    <button type="button" onClick={() => open(entity)} title={alt} className={`${cls} hover:ring-2 hover:ring-red-300 transition-shadow`}>
      {inner}
    </button>
  )
}

export function OnThisDay({ scrobbles }: VizProps) {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth())
  const [day, setDay] = useState(today.getDate())
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [discExpanded, setDiscExpanded] = useState<Set<string>>(new Set())

  const toggleYear = (year: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })
  }

  const maxDay = daysInMonth(month)
  const clampedDay = Math.min(day, maxDay)

  const { groups, topArtist, topAlbum, topTrack } = useMemo(() => {
    interface YearBucket {
      tracks: Map<string, TrackStat>
      artists: Map<string, TopEntity>
      albums: Map<string, TopEntity>
    }
    const byYear = new Map<number, YearBucket>()
    const artistStats = new Map<string, TopEntity>()
    const albumStats = new Map<string, TopEntity>()
    const trackStats = new Map<string, TopEntity>()

    const bump = (map: Map<string, TopEntity>, key: string, make: () => TopEntity, imageUrl?: string) => {
      const cur = map.get(key) ?? make()
      cur.plays++
      if (imageUrl && !cur.imageUrl) cur.imageUrl = imageUrl
      map.set(key, cur)
    }

    for (const s of scrobbles) {
      const d = fromUnixTime(s.timestamp)
      if (d.getMonth() !== month || d.getDate() !== clampedDay) continue
      const year = d.getFullYear()

      let yb = byYear.get(year)
      if (!yb) { yb = { tracks: new Map(), artists: new Map(), albums: new Map() }; byYear.set(year, yb) }
      const tKey = `${s.track}\x00${s.artist}`
      let t = yb.tracks.get(tKey)
      if (!t) {
        t = { track: s.track, artist: s.artist, album: s.album, imageUrl: s.imageUrl, plays: 0, firstTs: s.timestamp }
        yb.tracks.set(tKey, t)
      }
      t.plays++
      if (s.imageUrl && !t.imageUrl) t.imageUrl = s.imageUrl
      if (s.timestamp < t.firstTs) t.firstTs = s.timestamp

      const makeArtist = () => ({ name: s.artist, artist: s.artist, plays: 0 })
      const makeTrack = () => ({ name: s.track, artist: s.artist, imageUrl: s.imageUrl, plays: 0 })
      bump(yb.artists, s.artist, makeArtist)
      bump(artistStats, s.artist, makeArtist)
      bump(trackStats, tKey, makeTrack, s.imageUrl)

      if (s.album) {
        const albKey = `${s.album}\x00${s.artist}`
        const makeAlbum = () => ({ name: s.album, artist: s.artist, imageUrl: s.imageUrl, plays: 0 })
        bump(yb.albums, albKey, makeAlbum, s.imageUrl)
        bump(albumStats, albKey, makeAlbum, s.imageUrl)
      }
    }

    const top = (map: Map<string, TopEntity>): TopEntity | null =>
      [...map.values()].sort((a, b) => b.plays - a.plays)[0] ?? null
    const topTrackOf = (tracks: Map<string, TrackStat>): TopEntity | null => {
      const t = [...tracks.values()].sort((a, b) => b.plays - a.plays)[0]
      return t ? { name: t.track, artist: t.artist, imageUrl: t.imageUrl, plays: t.plays } : null
    }

    const groups: YearGroup[] = [...byYear.entries()]
      .map(([year, yb]) => ({
        year,
        total: [...yb.tracks.values()].reduce((n, t) => n + t.plays, 0),
        tracks: [...yb.tracks.values()].sort((a, b) => b.plays - a.plays || a.firstTs - b.firstTs),
        topArtist: top(yb.artists),
        topAlbum: top(yb.albums),
        topTrack: topTrackOf(yb.tracks),
      }))
      .sort((a, b) => b.year - a.year)

    return { groups, topArtist: top(artistStats), topAlbum: top(albumStats), topTrack: top(trackStats) }
  }, [scrobbles, month, clampedDay])

  const discoveries = useMemo<Discoveries>(() => {
    const artistFirst = new Map<string, number>()
    const albumFirst = new Map<string, Discovery>()
    const trackFirst = new Map<string, Discovery>()

    for (const s of scrobbles) {
      const prevA = artistFirst.get(s.artist)
      if (prevA === undefined || s.timestamp < prevA) artistFirst.set(s.artist, s.timestamp)

      const tKey = `${s.track}\x00${s.artist}`
      const prevT = trackFirst.get(tKey)
      if (!prevT || s.timestamp < prevT.ts) {
        trackFirst.set(tKey, { title: s.track, artist: s.artist, imageUrl: s.imageUrl, ts: s.timestamp, year: 0 })
      }

      if (s.album) {
        const aKey = `${s.album}\x00${s.artist}`
        const prevAl = albumFirst.get(aKey)
        if (!prevAl || s.timestamp < prevAl.ts) {
          albumFirst.set(aKey, { title: s.album, artist: s.artist, imageUrl: s.imageUrl, ts: s.timestamp, year: 0 })
        }
      }
    }

    const onDay = (ts: number) => {
      const d = fromUnixTime(ts)
      return d.getMonth() === month && d.getDate() === clampedDay
    }
    const stamp = (d: Discovery): Discovery => ({ ...d, year: fromUnixTime(d.ts).getFullYear() })
    const byYearDesc = (a: Discovery, b: Discovery) => b.ts - a.ts

    return {
      artists: [...artistFirst.entries()]
        .filter(([, ts]) => onDay(ts))
        .map(([artist, ts]) => ({ title: artist, artist, ts, year: fromUnixTime(ts).getFullYear() }))
        .sort(byYearDesc),
      albums: [...albumFirst.values()].filter(d => onDay(d.ts)).map(stamp).sort(byYearDesc),
      tracks: [...trackFirst.values()].filter(d => onDay(d.ts)).map(stamp).sort(byYearDesc),
    }
  }, [scrobbles, month, clampedDay])

  // Per-calendar-day artist play vectors, built once across all history.
  const dayVectors = useMemo(() => {
    const map = new Map<string, { month: number; day: number; artists: Map<string, number> }>()
    for (const s of scrobbles) {
      const d = fromUnixTime(s.timestamp)
      const m = d.getMonth(), day = d.getDate()
      const key = `${m}-${day}`
      let v = map.get(key)
      if (!v) { v = { month: m, day, artists: new Map() }; map.set(key, v) }
      v.artists.set(s.artist, (v.artists.get(s.artist) ?? 0) + 1)
    }
    return map
  }, [scrobbles])

  const similarDays = useMemo<SimilarDay[]>(() => {
    const self = dayVectors.get(`${month}-${clampedDay}`)
    if (!self) return []
    let selfNorm = 0
    for (const v of self.artists.values()) selfNorm += v * v
    selfNorm = Math.sqrt(selfNorm)
    if (selfNorm === 0) return []

    const result: SimilarDay[] = []
    for (const [key, vec] of dayVectors) {
      if (key === `${month}-${clampedDay}`) continue
      let dot = 0, sharedArtist: string | null = null, bestContrib = 0
      // Iterate the smaller map for the intersection.
      const [small, big] = self.artists.size <= vec.artists.size ? [self.artists, vec.artists] : [vec.artists, self.artists]
      for (const [artist, v] of small) {
        const w = big.get(artist)
        if (!w) continue
        const contrib = v * w
        dot += contrib
        if (contrib > bestContrib) { bestContrib = contrib; sharedArtist = artist }
      }
      if (dot === 0) continue
      let norm = 0
      for (const v of vec.artists.values()) norm += v * v
      result.push({ month: vec.month, day: vec.day, score: dot / (selfNorm * Math.sqrt(norm)), sharedArtist })
    }
    result.sort((a, b) => b.score - a.score)
    return result.slice(0, 6)
  }, [dayVectors, month, clampedDay])

  const goToDay = (m: number, d: number) => {
    setMonth(m)
    setDay(d)
    setExpanded(new Set())
  }

  if (scrobbles.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data yet.</div>
  }

  const totalPlays = groups.reduce((n, g) => n + g.total, 0)
  const allExpanded = groups.length > 0 && groups.every(g => expanded.has(g.year))
  const isToday = month === today.getMonth() && clampedDay === today.getDate()
  const hasDiscoveries = discoveries.artists.length + discoveries.albums.length + discoveries.tracks.length > 0
  const discoveryCols = [
    { title: 'Artists', items: discoveries.artists, kind: 'artist' as const },
    { title: 'Albums', items: discoveries.albums, kind: 'album' as const },
    { title: 'Tracks', items: discoveries.tracks, kind: 'track' as const },
  ]
  const overflowCols = discoveryCols.filter(c => c.items.length > DISCOVERY_LIMIT)
  const allDiscExpanded = overflowCols.length > 0 && overflowCols.every(c => discExpanded.has(c.kind))
  const toggleDisc = (kind: string) => {
    setDiscExpanded(prev => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-semibold text-gray-800">On This Day</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            What you listened to on {MONTHS[month]} {clampedDay}
            {isToday && <span className="text-red-500"> — today</span>} in past years.
          </p>
        </div>
        <div className="flex gap-2 items-center text-sm">
          <select
            value={month}
            onChange={e => setMonth(+e.target.value)}
            className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
          >
            {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
          </select>
          <select
            value={clampedDay}
            onChange={e => setDay(+e.target.value)}
            className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
          >
            {Array.from({ length: maxDay }, (_, i) => i + 1).map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <button
            onClick={() => { setMonth(today.getMonth()); setDay(today.getDate()) }}
            disabled={isToday}
            className="px-2.5 py-1 rounded border border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-500 disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:text-gray-600 transition-colors"
          >
            Today
          </button>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-gray-400">
          Nothing scrobbled on {MONTHS[month]} {clampedDay} in any year.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {topArtist && (
              <StatCard
                label="Top artist"
                media={<ArtistAvatar artist={topArtist.artist} sizeClass="w-11 h-11" iconClass="w-5 h-5" />}
                link={<EntityLink entity={{ kind: 'artist', artist: topArtist.artist }} className="block truncate font-semibold text-gray-800 text-sm">{topArtist.name}</EntityLink>}
                plays={topArtist.plays}
              />
            )}
            {topAlbum && (
              <StatCard
                label="Top album"
                media={<Art url={topAlbum.imageUrl} alt={topAlbum.name} entity={{ kind: 'album', artist: topAlbum.artist, title: topAlbum.name }} sizeClass="w-11 h-11" />}
                link={<EntityLink entity={{ kind: 'album', artist: topAlbum.artist, title: topAlbum.name }} className="block truncate font-semibold text-gray-800 text-sm">{topAlbum.name}</EntityLink>}
                sub={topAlbum.artist}
                plays={topAlbum.plays}
              />
            )}
            {topTrack && (
              <StatCard
                label="Top song"
                media={<Art url={topTrack.imageUrl} alt={topTrack.name} entity={{ kind: 'track', artist: topTrack.artist, title: topTrack.name }} sizeClass="w-11 h-11" />}
                link={<EntityLink entity={{ kind: 'track', artist: topTrack.artist, title: topTrack.name }} className="block truncate font-semibold text-gray-800 text-sm">{topTrack.name}</EntityLink>}
                sub={topTrack.artist}
                plays={topTrack.plays}
              />
            )}
          </div>

          {hasDiscoveries && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">First heard on this day</h3>
                {overflowCols.length > 0 && (
                  <button
                    onClick={() => setDiscExpanded(allDiscExpanded ? new Set() : new Set(overflowCols.map(c => c.kind)))}
                    className="text-xs text-gray-500 hover:text-red-500 transition-colors"
                  >
                    {allDiscExpanded ? 'Collapse all' : 'Expand all'}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {discoveryCols.map(c => (
                  <DiscoveryColumn
                    key={c.kind}
                    title={c.title}
                    items={c.items}
                    kind={c.kind}
                    expanded={discExpanded.has(c.kind)}
                    onToggle={() => toggleDisc(c.kind)}
                  />
                ))}
              </div>
            </div>
          )}

          {similarDays.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Similar days</h3>
              <div className="flex flex-wrap gap-2">
                {similarDays.map(sd => (
                  <button
                    key={`${sd.month}-${sd.day}`}
                    onClick={() => goToDay(sd.month, sd.day)}
                    title={sd.sharedArtist ? `Shared listening: ${sd.sharedArtist}` : undefined}
                    className="group flex items-center gap-2 rounded-full border border-gray-200 pl-3 pr-2 py-1 text-sm hover:border-red-300 hover:bg-red-50 transition-colors"
                  >
                    <span className="font-medium text-gray-700 group-hover:text-red-600">{MONTHS[sd.month].slice(0, 3)} {sd.day}</span>
                    {sd.sharedArtist && <span className="text-xs text-gray-400 truncate max-w-[10rem]">{sd.sharedArtist}</span>}
                    <span className="text-[11px] tabular-nums text-gray-400 bg-gray-100 group-hover:bg-white rounded-full px-1.5 py-0.5">
                      {Math.round(sd.score * 100)}%
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              {totalPlays.toLocaleString()} plays across {groups.length} {groups.length === 1 ? 'year' : 'years'}.
            </p>
            <button
              onClick={() => setExpanded(allExpanded ? new Set() : new Set(groups.map(g => g.year)))}
              className="text-xs text-gray-500 hover:text-red-500 transition-colors"
            >
              {allExpanded ? 'Collapse all' : 'Expand all'}
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {groups.map(g => {
              const isOpen = expanded.has(g.year)
              const lead = g.tracks[0]
              return (
                <div key={g.year}>
                  <button
                    onClick={() => toggleYear(g.year)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center gap-2 py-2.5 text-left group"
                  >
                    <svg
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                      strokeLinecap="round" strokeLinejoin="round"
                      className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    >
                      <polyline points="9 6 15 12 9 18" />
                    </svg>
                    <span className="font-semibold text-gray-800 tabular-nums w-12 shrink-0 group-hover:text-red-500 transition-colors">{g.year}</span>
                    <span className="text-xs text-gray-500 truncate">
                      {g.total.toLocaleString()} {g.total === 1 ? 'play' : 'plays'} · {g.tracks.length} {g.tracks.length === 1 ? 'track' : 'tracks'}
                      {lead && <> · {lead.track}</>}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="pl-5 pb-2 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {g.topArtist && (
                          <MiniStat
                            label="Top artist"
                            media={<ArtistAvatar artist={g.topArtist.artist} sizeClass="w-8 h-8" iconClass="w-4 h-4" />}
                            link={<EntityLink entity={{ kind: 'artist', artist: g.topArtist.artist }} className="block truncate font-medium text-gray-700">{g.topArtist.name}</EntityLink>}
                            plays={g.topArtist.plays}
                          />
                        )}
                        {g.topAlbum && (
                          <MiniStat
                            label="Top album"
                            media={<Art url={g.topAlbum.imageUrl} alt={g.topAlbum.name} entity={{ kind: 'album', artist: g.topAlbum.artist, title: g.topAlbum.name }} sizeClass="w-8 h-8" iconClass="w-4 h-4" />}
                            link={<EntityLink entity={{ kind: 'album', artist: g.topAlbum.artist, title: g.topAlbum.name }} className="block truncate font-medium text-gray-700">{g.topAlbum.name}</EntityLink>}
                            plays={g.topAlbum.plays}
                          />
                        )}
                        {g.topTrack && (
                          <MiniStat
                            label="Top song"
                            media={<Art url={g.topTrack.imageUrl} alt={g.topTrack.name} entity={{ kind: 'track', artist: g.topTrack.artist, title: g.topTrack.name }} sizeClass="w-8 h-8" iconClass="w-4 h-4" />}
                            link={<EntityLink entity={{ kind: 'track', artist: g.topTrack.artist, title: g.topTrack.name }} className="block truncate font-medium text-gray-700">{g.topTrack.name}</EntityLink>}
                            plays={g.topTrack.plays}
                          />
                        )}
                      </div>
                      <ul className="divide-y divide-gray-100">
                      {g.tracks.map(t => (
                        <li key={`${t.track}\x00${t.artist}`} className="flex items-center gap-2 py-1.5">
                          <Art url={t.imageUrl} alt={t.album || t.track} entity={t.album ? { kind: 'album', artist: t.artist, title: t.album } : { kind: 'track', artist: t.artist, title: t.track }} sizeClass="w-8 h-8" iconClass="w-4 h-4" />
                          <div className="min-w-0 flex-1">
                            <EntityLink entity={{ kind: 'track', artist: t.artist, title: t.track }} className="block truncate text-sm text-gray-800 font-medium">
                              {t.track}
                            </EntityLink>
                            <EntityLink entity={{ kind: 'artist', artist: t.artist }} className="block truncate text-xs text-gray-500">
                              {t.artist}
                            </EntityLink>
                          </div>
                          <span className="text-xs text-gray-400 whitespace-nowrap">
                            {format(fromUnixTime(t.firstTs), 'h:mm a')}
                          </span>
                          {t.plays > 1 && (
                            <span className="text-xs tabular-nums text-red-500 bg-red-50 rounded-full px-2 py-0.5 whitespace-nowrap">
                              ×{t.plays}
                            </span>
                          )}
                        </li>
                      ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function MiniStat({ label, media, link, plays }: {
  label: string; media: React.ReactNode; link: React.ReactNode; plays: number
}) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-gray-50 px-2 py-1.5 min-w-0">
      {media}
      <div className="min-w-0 flex-1 text-xs">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
        {link}
        <div className="text-[11px] text-red-500 tabular-nums">{plays.toLocaleString()} {plays === 1 ? 'play' : 'plays'}</div>
      </div>
    </div>
  )
}

function StatCard({ label, media, link, sub, plays }: {
  label: string; media: React.ReactNode; link: React.ReactNode; sub?: string; plays: number
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 min-w-0">
      {media}
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">{label}</div>
        {link}
        {sub && <div className="truncate text-xs text-gray-500">{sub}</div>}
        <div className="text-xs text-red-500 tabular-nums mt-0.5">{plays.toLocaleString()} {plays === 1 ? 'play' : 'plays'}</div>
      </div>
    </div>
  )
}

function DiscoveryColumn({ title, items, kind, expanded, onToggle }: {
  title: string; items: Discovery[]; kind: 'artist' | 'album' | 'track'
  expanded: boolean; onToggle: () => void
}) {
  const shown = expanded ? items : items.slice(0, DISCOVERY_LIMIT)
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium text-gray-600 mb-1.5">{title} <span className="text-gray-400">({items.length})</span></div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400">None.</p>
      ) : (
        <ul className="space-y-1.5">
          {shown.map(d => (
            <li key={`${d.title}\x00${d.artist}`} className="flex items-center gap-2 min-w-0">
              {kind === 'artist'
                ? <ArtistAvatar artist={d.artist} sizeClass="w-7 h-7" iconClass="w-3.5 h-3.5" />
                : <Art url={d.imageUrl} alt={d.title} entity={{ kind, artist: d.artist, title: d.title }} sizeClass="w-7 h-7" iconClass="w-3.5 h-3.5" />}
              <div className="min-w-0 flex-1">
                <EntityLink
                  entity={kind === 'artist' ? { kind: 'artist', artist: d.artist } : { kind, artist: d.artist, title: d.title }}
                  className="block truncate text-xs font-medium text-gray-700"
                >
                  {d.title}
                </EntityLink>
                {kind !== 'artist' && <div className="truncate text-[11px] text-gray-400">{d.artist}</div>}
              </div>
              <span className="text-[11px] tabular-nums text-gray-400 shrink-0">{d.year}</span>
            </li>
          ))}
          {items.length > DISCOVERY_LIMIT && (
            <li>
              <button
                onClick={onToggle}
                className="text-[11px] text-gray-400 hover:text-red-500 transition-colors"
              >
                {expanded ? 'Show less' : `+${items.length - DISCOVERY_LIMIT} more`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
