import { useEffect, useRef, useState } from 'react'
import { LastFmApi } from '../api/lastfm'
import { getDb, exportToJSON, importFromJSON } from '../db'
import { syncScrobbles, type SyncProgress } from '../sync/sync'
import { backfillArtistImages, type BackfillProgress, type ImageFetchLogEntry } from '../api/artistImages'
import { getSpotifyCredentials, saveSpotifyCredentials, clearSpotifyCredentials } from '../api/spotify'
import { CheckSolidIcon, ChevronDownIcon, CloseIcon, PlusIcon } from './icons/CommonIcons'

interface Props {
  apiKey: string
  accounts: string[]
  activeAccount: string
  totalScrobbles: number
  onSyncComplete: () => void
  onSwitchAccount: (username: string) => void
  onAddAccount: () => void
  onRemoveAccount: (username: string) => void
}

export function Header({
  apiKey, accounts, activeAccount, totalScrobbles,
  onSyncComplete, onSwitchAccount, onAddAccount, onRemoveAccount,
}: Props) {
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [spotifyOpen, setSpotifyOpen] = useState(false)
  const [spotifyId, setSpotifyId] = useState('')
  const [spotifySecret, setSpotifySecret] = useState('')
  const [backfillProgress, setBackfillProgress] = useState<BackfillProgress | null>(null)
  const [isBackfilling, setIsBackfilling] = useState(false)
  const [backfillLog, setBackfillLog] = useState<ImageFetchLogEntry[] | null>(null)
  const backfillAbortRef = useRef<AbortController | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { navigator.storage?.persist() }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSync = async () => {
    setIsSyncing(true)
    setStatusMsg(null)
    const api = new LastFmApi(apiKey, activeAccount)
    const db = getDb(activeAccount)
    try {
      await syncScrobbles(api, db, p => setProgress(p))
      onSyncComplete()
    } catch { /* progress already has error */ } finally {
      setIsSyncing(false)
    }
  }

  const handleDownloadLog = () => {
    if (!backfillLog) return
    const lines = ['artist,source,url', ...backfillLog.map(e =>
      `"${e.artist.replace(/"/g, '""')}",${e.source},"${e.url ?? ''}"`
    )]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `artist-images-${activeAccount}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleBackfill = async () => {
    if (isBackfilling) {
      backfillAbortRef.current?.abort()
      return
    }
    const controller = new AbortController()
    backfillAbortRef.current = controller
    setIsBackfilling(true)
    setBackfillProgress(null)
    try {
      const { found, log } = await backfillArtistImages(
        getDb(activeAccount),
        apiKey,
        p => setBackfillProgress(p),
        controller.signal,
      )
      const bySource = log.reduce<Record<string, number>>((acc, e) => {
        acc[e.source] = (acc[e.source] ?? 0) + 1
        return acc
      }, {})
      const parts = (['theaudiodb', 'lastfm', 'spotify', 'wikipedia'] as const)
        .filter(s => bySource[s])
        .map(s => `${bySource[s]} ${s}`)
      const summary = parts.length ? ` (${parts.join(' · ')})` : ''
      setBackfillLog(log)
      setStatusMsg({ text: `Found ${found} images${summary}, ${(bySource.none ?? 0)} not found.`, ok: true })
    } catch {
      setStatusMsg({ text: 'Artist image fetch failed.', ok: false })
    } finally {
      setIsBackfilling(false)
      setBackfillProgress(null)
    }
  }

  const handleExport = async () => {
    try {
      await exportToJSON(getDb(activeAccount), activeAccount)
      setStatusMsg({ text: 'Export downloaded.', ok: true })
    } catch (e) {
      setStatusMsg({ text: `Export failed: ${e instanceof Error ? e.message : e}`, ok: false })
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const { added, skipped } = await importFromJSON(getDb(activeAccount), file)
      setStatusMsg({ text: `Imported ${added.toLocaleString()} scrobbles (${skipped.toLocaleString()} skipped).`, ok: true })
      onSyncComplete()
    } catch (err) {
      setStatusMsg({ text: `Import failed: ${err instanceof Error ? err.message : err}`, ok: false })
    }
  }

  const isError = progress?.phase === 'error'
  const isDone = progress?.phase === 'done'
  const activeMsg = (isSyncing || progress) ? { text: progress?.message ?? '', ok: !isError } : statusMsg

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-0">
        {/* Account switcher */}
        <div className="relative inline-block" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(o => !o)}
            className="flex items-center gap-1.5 font-medium text-gray-800 text-sm hover:text-red-500 transition-colors"
          >
            <span>@{activeAccount}</span>
            <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400" />
          </button>

          {dropdownOpen && (
            <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1">
              {accounts.map(acc => (
                <div key={acc} className="flex items-center px-3 py-1.5 hover:bg-gray-50 group">
                  <button
                    className="flex-1 text-left text-sm flex items-center gap-2"
                    onClick={() => { onSwitchAccount(acc); setDropdownOpen(false) }}
                  >
                    {acc === activeAccount && (
                      <CheckSolidIcon className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    )}
                    {acc !== activeAccount && <span className="w-3.5 shrink-0" />}
                    <span className={acc === activeAccount ? 'font-medium text-gray-900' : 'text-gray-700'}>
                      @{acc}
                    </span>
                  </button>
                  {accounts.length > 1 && (
                    <button
                      onClick={() => onRemoveAccount(acc)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all ml-1"
                      title="Remove account"
                    >
                      <CloseIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  onClick={() => { onAddAccount(); setDropdownOpen(false) }}
                  className="w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-gray-50 flex items-center gap-2"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  Add account…
                </button>
              </div>
              <div className="border-t border-gray-100 mt-1 pt-1 px-3 pb-2">
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-xs font-medium text-gray-500">Spotify artist images</span>
                  {getSpotifyCredentials()
                    ? <span className="text-xs text-green-500">Configured</span>
                    : <span className="text-xs text-gray-400">Not set</span>
                  }
                </div>
                {spotifyOpen ? (
                  <div className="space-y-1.5 mt-1">
                    <input
                      placeholder="Client ID"
                      value={spotifyId}
                      onChange={e => setSpotifyId(e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-green-400"
                    />
                    <input
                      type="password"
                      placeholder="Client Secret"
                      value={spotifySecret}
                      onChange={e => setSpotifySecret(e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 outline-none focus:border-green-400"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => {
                          saveSpotifyCredentials(spotifyId, spotifySecret)
                          setSpotifyOpen(false)
                        }}
                        disabled={!spotifyId.trim() || !spotifySecret.trim()}
                        className="flex-1 text-xs bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white rounded-md px-2 py-1.5 font-medium transition-colors"
                      >
                        Save
                      </button>
                      {getSpotifyCredentials() && (
                        <button
                          onClick={() => { clearSpotifyCredentials(); setSpotifyOpen(false) }}
                          className="text-xs text-red-400 hover:text-red-600 px-2 py-1.5 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                      <button
                        onClick={() => setSpotifyOpen(false)}
                        className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      const creds = getSpotifyCredentials()
                      setSpotifyId(creds?.clientId ?? '')
                      setSpotifySecret(creds?.clientSecret ?? '')
                      setSpotifyOpen(true)
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {getSpotifyCredentials() ? 'Edit credentials…' : 'Configure…'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-500">{totalScrobbles.toLocaleString()} scrobbles cached</span>
          {activeMsg && (
            <span className={`text-xs ${activeMsg.ok ? (isDone ? 'text-green-600' : 'text-gray-500') : 'text-red-500'}`}>
              · {activeMsg.text}
            </span>
          )}
        </div>

        {isSyncing && progress && progress.total > 0 && (
          <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden w-48">
            <div
              className="h-full bg-red-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, (progress.fetched / progress.total) * 100)}%` }}
            />
          </div>
        )}
        {isBackfilling && backfillProgress && (
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden w-48">
              <div
                className="h-full bg-purple-400 rounded-full transition-all"
                style={{ width: `${Math.min(100, (backfillProgress.done / backfillProgress.total) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-400">
              {backfillProgress.done} / {backfillProgress.total}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={handleSync} disabled={isSyncing}
          className="px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm font-medium rounded-lg transition-colors">
          {isSyncing ? 'Syncing…' : totalScrobbles === 0 ? 'Sync All' : 'Sync New'}
        </button>
        <button onClick={handleExport} disabled={isSyncing || totalScrobbles === 0}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 text-sm font-medium rounded-lg transition-colors">
          Export
        </button>
        <button onClick={() => fileInputRef.current?.click()} disabled={isSyncing}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 text-sm font-medium rounded-lg transition-colors">
          Import
        </button>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        <button onClick={handleBackfill} disabled={isSyncing}
          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            isBackfilling
              ? 'bg-purple-100 hover:bg-purple-200 text-purple-700'
              : 'bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700'
          }`}>
          {isBackfilling
            ? `Stop (${backfillProgress?.done ?? 0}/${backfillProgress?.total ?? '?'})`
            : 'Fetch Artist Images'}
        </button>
        {backfillLog && !isBackfilling && (
          <button onClick={handleDownloadLog}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors">
            Download Log
          </button>
        )}
      </div>
    </header>
  )
}
