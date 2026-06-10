import { useEffect, useRef, useState } from 'react'
import { LastFmApi } from '../api/lastfm'
import { getDb, exportToJSON, importFromJSON } from '../db'
import { syncScrobbles, resyncRecent, type SyncProgress } from '../sync/sync'
import type { ArtistImageBackfill } from '../hooks/useArtistImageBackfill'
import { CheckSolidIcon, ChevronDownIcon, CloseIcon, PlusIcon, SettingsGearIcon } from './icons/CommonIcons'

interface Props {
  apiKey: string
  accounts: string[]
  activeAccount: string
  totalScrobbles: number
  autoFetchImages: boolean
  backfill: ArtistImageBackfill
  onSyncComplete: () => void
  onSwitchAccount: (username: string) => void
  onAddAccount: () => void
  onRemoveAccount: (username: string) => void
  onOpenSettings: () => void
}

export function Header({
  apiKey, accounts, activeAccount, totalScrobbles, autoFetchImages, backfill,
  onSyncComplete, onSwitchAccount, onAddAccount, onRemoveAccount, onOpenSettings,
}: Props) {
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [statusMsg, setStatusMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [resyncDays, setResyncDays] = useState(14)
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
    let synced = false
    try {
      await syncScrobbles(api, db, p => setProgress(p))
      onSyncComplete()
      synced = true
    } catch { /* progress already has error */ } finally {
      setIsSyncing(false)
    }
    if (synced && autoFetchImages) backfill.run(true)
  }

  const handleResync = async () => {
    setIsSyncing(true)
    setStatusMsg(null)
    const api = new LastFmApi(apiKey, activeAccount)
    const db = getDb(activeAccount)
    let ok = false
    try {
      const since = Math.floor(Date.now() / 1000) - resyncDays * 86400
      await resyncRecent(api, db, since, p => setProgress(p))
      onSyncComplete()
      ok = true
    } catch { /* progress already has error */ } finally {
      setIsSyncing(false)
    }
    if (ok && autoFetchImages) backfill.run(true)
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
        {backfill.isBackfilling && backfill.progress && (
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-gray-400">Artist images</span>
            <div className="h-1 bg-gray-100 rounded-full overflow-hidden w-48">
              <div
                className="h-full bg-purple-400 rounded-full transition-all"
                style={{ width: `${Math.min(100, (backfill.progress.done / backfill.progress.total) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-400">
              {backfill.progress.done} / {backfill.progress.total}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={handleSync} disabled={isSyncing}
          className="px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm font-medium rounded-lg transition-colors">
          {isSyncing ? 'Syncing…' : totalScrobbles === 0 ? 'Sync All' : 'Sync New'}
        </button>
        <div className="flex items-center gap-1.5">
          <select
            value={resyncDays}
            onChange={e => setResyncDays(+e.target.value)}
            disabled={isSyncing}
            title="How far back to re-fetch"
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-red-300"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
          </select>
          <button onClick={handleResync} disabled={isSyncing || totalScrobbles === 0}
            title="Re-fetch recent scrobbles to pick up edits & deletions made on Last.fm"
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 text-sm font-medium rounded-lg transition-colors">
            Re-sync
          </button>
        </div>
        <button onClick={handleExport} disabled={isSyncing || totalScrobbles === 0}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 text-sm font-medium rounded-lg transition-colors">
          Export
        </button>
        <button onClick={() => fileInputRef.current?.click()} disabled={isSyncing}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 text-sm font-medium rounded-lg transition-colors">
          Import
        </button>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        <button onClick={onOpenSettings} title="Settings"
          className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors">
          <SettingsGearIcon className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
