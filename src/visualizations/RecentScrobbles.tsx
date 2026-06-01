import { useEffect, useMemo, useState } from 'react'
import { format, fromUnixTime } from 'date-fns'
import type { VizProps } from './registry'
import { getArtistImage } from '../api/artistImages'
import { getDb } from '../db'
import { MusicNoteIcon, UserAvatarIcon } from '../components/icons/CommonIcons'

const PAGE_SIZE = 100

function getApiKey(): string { return localStorage.getItem('lastfm_api_key') ?? '' }
function getUsername(): string { return localStorage.getItem('lastfm_active_account') ?? '' }

function Photo({ url, alt, round }: { url?: string | null; alt: string; round?: boolean }) {
  const [errored, setErrored] = useState(false)
  const shape = round ? 'rounded-full' : 'rounded'
  return (
    <div className={`w-10 h-10 ${shape} overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center`}>
      {url && !errored ? (
        <img src={url} alt={alt} onError={() => setErrored(true)} className="w-full h-full object-cover" />
      ) : (
        round ? <UserAvatarIcon className="w-5 h-5 text-gray-300" /> : <MusicNoteIcon className="w-5 h-5 text-gray-300" />
      )}
    </div>
  )
}

export function RecentScrobbles({ scrobbles }: VizProps) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [artistImages, setArtistImages] = useState<Map<string, string | null>>(new Map())

  const sorted = useMemo(
    () => [...scrobbles].sort((a, b) => b.timestamp - a.timestamp),
    [scrobbles],
  )

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    if (!q) return sorted
    return sorted.filter(
      s =>
        s.track.toLowerCase().includes(q) ||
        s.artist.toLowerCase().includes(q) ||
        s.album.toLowerCase().includes(q),
    )
  }, [sorted, query])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const page_ = Math.min(page, Math.max(0, totalPages - 1))
  const visible = filtered.slice(page_ * PAGE_SIZE, (page_ + 1) * PAGE_SIZE)

  // Fetch artist images for unique artists on the current page
  useEffect(() => {
    const apiKey = getApiKey()
    const username = getUsername()
    if (!apiKey || !username) return
    const db = getDb(username)
    const artists = [...new Set(visible.map(s => s.artist))]
    const missing = artists.filter(a => !artistImages.has(a))
    if (missing.length === 0) return

    missing.forEach(artist => {
      getArtistImage(artist, apiKey, db).then(url => {
        setArtistImages(prev => {
          if (prev.get(artist) === url) return prev
          return new Map(prev).set(artist, url)
        })
      })
    })
  }, [page_, query, visible, artistImages])

  const handleSearch = (q: string) => { setQuery(q); setPage(0) }

  if (scrobbles.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data yet.</div>
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-4 border-b border-gray-200 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-800">Recent Scrobbles</h2>
          <p className="text-sm text-gray-500">
            {filtered.length.toLocaleString()} {query ? 'matching' : 'total'}
          </p>
        </div>
        <input
          type="search"
          placeholder="Filter by track, artist, or album…"
          value={query}
          onChange={e => handleSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-red-300"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="py-2 pl-4 pr-1 w-12" />
              <th className="text-left py-2 px-2 font-medium text-gray-500">Track</th>
              <th className="text-left py-2 px-2 font-medium text-gray-500">Artist</th>
              <th className="text-left py-2 px-2 font-medium text-gray-500 hidden md:table-cell">Album</th>
              <th className="text-right py-2 pl-2 pr-4 font-medium text-gray-500">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.map((s, i) => (
              <tr key={`${s.timestamp}-${i}`} className="hover:bg-gray-50">
                <td className="py-1.5 pl-4 pr-1">
                  <Photo url={s.imageUrl} alt={s.album || s.track} />
                </td>
                <td className="py-1.5 px-2 font-medium text-gray-800 max-w-xs truncate">{s.track}</td>
                <td className="py-1.5 px-2 text-gray-600">
                  <div className="flex items-center gap-2 max-w-xs">
                    <Photo url={artistImages.get(s.artist)} alt={s.artist} round />
                    <span className="truncate">{s.artist}</span>
                  </div>
                </td>
                <td className="py-1.5 px-2 text-gray-500 max-w-xs truncate hidden md:table-cell">{s.album || '—'}</td>
                <td className="py-1.5 pl-2 pr-4 text-right text-gray-400 whitespace-nowrap">
                  {format(fromUnixTime(s.timestamp), 'MMM d, yyyy HH:mm')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="p-4 border-t border-gray-200 flex items-center justify-between">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page_ === 0}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 text-sm font-medium rounded-lg transition-colors">
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page_ + 1} of {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page_ === totalPages - 1}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 text-sm font-medium rounded-lg transition-colors">
            Next
          </button>
        </div>
      )}
    </div>
  )
}
