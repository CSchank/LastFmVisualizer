import { useEffect, useMemo, useState } from 'react'
import { format, fromUnixTime } from 'date-fns'
import type { VizProps } from './registry'
import { splitArtists, buildRawArtistSet } from '../utils/artists'
import { getArtistImage } from '../api/artistImages'
import { getDb } from '../db'
import { downloadYearRecapInfographicPng, imageUrlToDataUrl } from '../utils/yearRecapInfographic'

function topN(values: string[], n: number): { name: string; plays: number }[] {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (!value.trim()) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, plays]) => ({ name, plays }))
}

function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function getApiKey(): string { return localStorage.getItem('lastfm_api_key') ?? '' }
function getUsername(): string { return localStorage.getItem('lastfm_active_account') ?? '' }

export function YearInReview({ scrobbles, splitCollabs }: VizProps) {
  const years = useMemo(() => {
    const set = new Set<number>()
    for (const s of scrobbles) set.add(fromUnixTime(s.timestamp).getFullYear())
    return [...set].sort((a, b) => b - a)
  }, [scrobbles])
  const [year, setYear] = useState<number | null>(null)
  const selectedYear = year ?? years[0] ?? new Date().getFullYear()
  const [artistImageUrls, setArtistImageUrls] = useState<Map<string, string | null>>(new Map())
  const [isDownloading, setIsDownloading] = useState(false)
  const [exportStatus, setExportStatus] = useState<string | null>(null)

  const rawArtistSet = useMemo(() => buildRawArtistSet(scrobbles), [scrobbles])

  const recap = useMemo(() => {
    const rows = scrobbles.filter(s => fromUnixTime(s.timestamp).getFullYear() === selectedYear)
    if (rows.length === 0) return null

    const artistList = rows.flatMap(s => (splitCollabs ? splitArtists(s.artist, rawArtistSet) : [s.artist]))
    const topArtists = topN(artistList, 10)
    const topTracks = topN(rows.map(s => `${s.track} — ${s.artist}`), 10)
    const albumStats = new Map<string, { name: string; plays: number; imageUrl: string | null; latestTs: number }>()
    for (const s of rows) {
      if (!s.album.trim()) continue
      const key = `${s.album}\u0000${s.artist}`
      const existing = albumStats.get(key) ?? { name: `${s.album} — ${s.artist}`, plays: 0, imageUrl: null, latestTs: 0 }
      existing.plays += 1
      if (s.imageUrl && s.timestamp >= existing.latestTs) {
        existing.imageUrl = s.imageUrl
        existing.latestTs = s.timestamp
      }
      albumStats.set(key, existing)
    }
    const topAlbums = [...albumStats.values()]
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 10)
      .map(a => ({ name: a.name, plays: a.plays, imageUrl: a.imageUrl }))
    const activeDays = new Set(rows.map(s => format(fromUnixTime(s.timestamp), 'yyyy-MM-dd'))).size
    const uniqueArtists = new Set(artistList).size
    const uniqueAlbums = new Set(rows.map(s => `${s.album} — ${s.artist}`)).size
    const uniqueTracks = new Set(rows.map(s => `${s.track} — ${s.artist}`)).size

    const summaryText = [
      `My ${selectedYear} Last.fm Recap`,
      `Total plays: ${rows.length.toLocaleString()}`,
      `Active days: ${activeDays.toLocaleString()}`,
      `Unique artists: ${uniqueArtists.toLocaleString()}`,
      `Unique albums: ${uniqueAlbums.toLocaleString()}`,
      `Unique tracks: ${uniqueTracks.toLocaleString()}`,
      '',
      'Top 5 artists:',
      ...topArtists.slice(0, 5).map((a, i) => `${i + 1}. ${a.name} (${a.plays.toLocaleString()})`),
      '',
      'Top 5 tracks:',
      ...topTracks.slice(0, 5).map((t, i) => `${i + 1}. ${t.name} (${t.plays.toLocaleString()})`),
    ].join('\n')

    return { rows, topArtists, topTracks, topAlbums, activeDays, uniqueArtists, uniqueAlbums, uniqueTracks, summaryText }
  }, [scrobbles, selectedYear, splitCollabs, rawArtistSet])

  useEffect(() => {
    if (!recap) return
    const apiKey = getApiKey()
    const username = getUsername()
    if (!apiKey || !username) return
    const db = getDb(username)
    const topArtistNames = recap.topArtists.slice(0, 3).map(a => a.name)
    const missing = topArtistNames.filter(name => !artistImageUrls.has(name))
    if (missing.length === 0) return

    missing.forEach(name => {
      getArtistImage(name, apiKey, db).then(url => {
        setArtistImageUrls(prev => {
          if (prev.get(name) === url) return prev
          return new Map(prev).set(name, url)
        })
      })
    })
  }, [recap, artistImageUrls])

  const handleDownloadInfographic = async () => {
    if (!recap) return
    setExportStatus(null)
    setIsDownloading(true)
    try {
      const topArtists = recap.topArtists.slice(0, 3)
      const artistImages = await Promise.all(
        topArtists.map(async artist => {
          const url = artistImageUrls.get(artist.name)
          const imageDataUrl = url ? await imageUrlToDataUrl(url) : null
          return { ...artist, imageDataUrl }
        }),
      )
      const topAlbum = recap.topAlbums[0]
      const topAlbumImageDataUrl = topAlbum?.imageUrl ? await imageUrlToDataUrl(topAlbum.imageUrl) : null

      await downloadYearRecapInfographicPng({
        year: selectedYear,
        totalPlays: recap.rows.length,
        activeDays: recap.activeDays,
        uniqueArtists: recap.uniqueArtists,
        uniqueAlbums: recap.uniqueAlbums,
        uniqueTracks: recap.uniqueTracks,
        topArtists: artistImages,
        topAlbum: topAlbum ? { name: topAlbum.name, plays: topAlbum.plays, imageDataUrl: topAlbumImageDataUrl } : undefined,
      })

      setExportStatus('Infographic downloaded.')
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : 'Could not export infographic.')
    } finally {
      setIsDownloading(false)
    }
  }

  if (scrobbles.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data yet.</div>
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-semibold text-gray-800">Year in Review</h2>
            <p className="text-sm text-gray-500 mt-0.5">Auto-generated recap cards from your scrobbles.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">
              <span className="mr-2">Year</span>
              <select
                value={selectedYear}
                onChange={e => setYear(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            {recap && (
              <>
                <button
                  onClick={() => downloadTextFile(`lastfm-recap-${selectedYear}.txt`, recap.summaryText)}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Download Recap Text
                </button>
                <button
                  onClick={handleDownloadInfographic}
                  disabled={isDownloading}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-900 disabled:bg-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {isDownloading ? 'Rendering…' : 'Download Infographic PNG'}
                </button>
              </>
            )}
          </div>
        </div>
        {exportStatus && <p className="text-xs text-gray-500 mt-3">{exportStatus}</p>}
      </div>

      {!recap ? (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-gray-400 text-center">
          No scrobbles for {selectedYear}.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Stat label="Total Plays" value={recap.rows.length.toLocaleString()} />
            <Stat label="Active Days" value={recap.activeDays.toLocaleString()} />
            <Stat label="Artists" value={recap.uniqueArtists.toLocaleString()} />
            <Stat label="Albums" value={recap.uniqueAlbums.toLocaleString()} />
            <Stat label="Tracks" value={recap.uniqueTracks.toLocaleString()} />
            <Stat label="Top Artist" value={recap.topArtists[0]?.name ?? '—'} sub={recap.topArtists[0] ? `${recap.topArtists[0].plays.toLocaleString()} plays` : undefined} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <TopList title="Top Artists" rows={recap.topArtists.slice(0, 10)} />
            <TopList title="Top Tracks" rows={recap.topTracks.slice(0, 10)} />
            <TopList title="Top Albums" rows={recap.topAlbums.slice(0, 10)} />
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-800 truncate">{value}</p>
      {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
    </div>
  )
}

function TopList({ title, rows }: { title: string; rows: { name: string; plays: number }[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-2">{title}</h3>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={row.name} className="flex items-center gap-2">
            <span className="w-5 text-xs text-gray-400">{i + 1}</span>
            <span className="flex-1 text-sm text-gray-700 truncate" title={row.name}>{row.name}</span>
            <span className="text-xs text-gray-500 tabular-nums">{row.plays.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
