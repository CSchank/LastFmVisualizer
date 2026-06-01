import { useEffect, useRef, useState } from 'react'
import { getArtistImage, setArtistImageManual } from '../api/artistImages'
import { getDb } from '../db'
import { UserAvatarIcon } from './icons/CommonIcons'

function getApiKey(): string { return localStorage.getItem('lastfm_api_key') ?? '' }
function getUsername(): string { return localStorage.getItem('lastfm_active_account') ?? '' }

interface Props {
  artist: string
  sizeClass?: string
  iconClass?: string
}

// Fetches the artist image only once the avatar scrolls into view, so long
// unpaginated lists don't fire thousands of requests at once. getArtistImage
// dedups and caches, so repeated artists across rows cost nothing.
// Click an avatar to paste a manual image URL (e.g. for a not-found artist).
export function ArtistAvatar({ artist, sizeClass = 'w-8 h-8', iconClass = 'w-4 h-4' }: Props) {
  const [url, setUrl] = useState<string | null>(null)
  const [errored, setErrored] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setUrl(null)
    setErrored(false)
    const el = ref.current
    if (!el) return
    let cancelled = false

    const observer = new IntersectionObserver(
      entries => {
        if (!entries.some(e => e.isIntersecting)) return
        observer.disconnect()
        const apiKey = getApiKey()
        const username = getUsername()
        if (!apiKey || !username) return
        getArtistImage(artist, apiKey, getDb(username)).then(u => {
          if (!cancelled) setUrl(u)
        })
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => { cancelled = true; observer.disconnect() }
  }, [artist])

  const handleClick = async () => {
    const username = getUsername()
    if (!username) return
    const input = window.prompt(`Image URL for ${artist} (leave blank to clear):`, url ?? '')
    if (input === null) return
    await setArtistImageManual(getDb(username), artist, input)
    setErrored(false)
    setUrl(input.trim() || null)
  }

  return (
    <button
      ref={ref}
      onClick={handleClick}
      title={`Set image for ${artist}`}
      className={`${sizeClass} rounded-full overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center hover:ring-2 hover:ring-red-300 transition-shadow`}
    >
      {url && !errored ? (
        <img src={url} alt={artist} onError={() => setErrored(true)} className="w-full h-full object-cover" />
      ) : (
        <UserAvatarIcon className={`${iconClass} text-gray-300`} />
      )}
    </button>
  )
}
