import { useRef, useState } from 'react'
import {
  backfillArtistImages,
  setArtistImageManual,
  getNotFoundArtists,
  type BackfillProgress,
  type ImageFetchLogEntry,
} from '../api/artistImages'
import { getDb } from '../db'

export interface BackfillStatus { text: string; ok: boolean }

export function useArtistImageBackfill(activeAccount: string, apiKey: string) {
  const [isBackfilling, setIsBackfilling] = useState(false)
  const [progress, setProgress] = useState<BackfillProgress | null>(null)
  const [log, setLog] = useState<ImageFetchLogEntry[] | null>(null)
  const [status, setStatus] = useState<BackfillStatus | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const runningRef = useRef(false)

  // auto=true suppresses the "found 0" message when a post-sync run has
  // nothing new to fetch, and stays silent on failure. retryNotFound also
  // re-attempts artists previously stored as not-found.
  const run = async (auto: boolean, retryNotFound = false) => {
    if (runningRef.current) return
    runningRef.current = true
    const controller = new AbortController()
    abortRef.current = controller
    setIsBackfilling(true)
    setProgress(null)
    try {
      const { found, log: entries } = await backfillArtistImages(
        getDb(activeAccount),
        apiKey,
        p => setProgress(p),
        controller.signal,
        { retryNotFound },
      )
      if (!auto || entries.length > 0) {
        const bySource = entries.reduce<Record<string, number>>((acc, e) => {
          acc[e.source] = (acc[e.source] ?? 0) + 1
          return acc
        }, {})
        const parts = (['theaudiodb', 'lastfm', 'wikipedia'] as const)
          .filter(s => bySource[s])
          .map(s => `${bySource[s]} ${s}`)
        const summary = parts.length ? ` (${parts.join(' · ')})` : ''
        setLog(entries)
        setStatus({ text: `Found ${found} images${summary}, ${bySource.none ?? 0} not found.`, ok: true })
      }
    } catch {
      if (!auto) setStatus({ text: 'Artist image fetch failed.', ok: false })
    } finally {
      setIsBackfilling(false)
      setProgress(null)
      runningRef.current = false
    }
  }

  const stop = () => abortRef.current?.abort()

  const downloadLog = () => {
    if (!log) return
    const lines = ['artist,source,url', ...log.map(e =>
      `"${e.artist.replace(/"/g, '""')}",${e.source},"${e.url ?? ''}"`,
    )]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `artist-images-${activeAccount}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const setImage = (artist: string, url: string) => setArtistImageManual(getDb(activeAccount), artist, url)
  const loadNotFound = () => getNotFoundArtists(getDb(activeAccount))

  return { isBackfilling, progress, log, status, run, stop, downloadLog, setImage, loadNotFound }
}

export type ArtistImageBackfill = ReturnType<typeof useArtistImageBackfill>
