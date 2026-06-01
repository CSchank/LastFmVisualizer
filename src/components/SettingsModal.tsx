import { useEffect, useState } from 'react'
import type { Settings } from '../hooks/useSettings'
import type { ArtistImageBackfill } from '../hooks/useArtistImageBackfill'
import { CloseIcon } from './icons/CommonIcons'

interface Props {
  open: boolean
  onClose: () => void
  settings: Settings
  onUpdate: (partial: Partial<Settings>) => void
  apiKey: string
  onSaveApiKey: (key: string) => void
  backfill: ArtistImageBackfill
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-red-500' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </button>
  )
}

function Row({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      {children}
    </div>
  )
}

export function SettingsModal({ open, onClose, settings, onUpdate, apiKey, onSaveApiKey, backfill }: Props) {
  const [keyDraft, setKeyDraft] = useState(apiKey)

  useEffect(() => { if (open) setKeyDraft(apiKey) }, [open, apiKey])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const keyChanged = keyDraft.trim() !== apiKey && keyDraft.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onMouseDown={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md"
        onMouseDown={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-2 divide-y divide-gray-100">
          <Row
            title="Split collaborations"
            description="Count “X feat. Y” as separate artists across all visualizations."
          >
            <Toggle checked={settings.splitCollabs} onChange={() => onUpdate({ splitCollabs: !settings.splitCollabs })} />
          </Row>

          <Row
            title="Auto-fetch artist images"
            description="After each sync, automatically fetch images for any new artists."
          >
            <Toggle checked={settings.autoFetchImages} onChange={() => onUpdate({ autoFetchImages: !settings.autoFetchImages })} />
          </Row>

          <div className="py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">Fetch artist images now</p>
                <p className="text-xs text-gray-500 mt-0.5">Scan all artists and fetch any missing images.</p>
              </div>
              <button
                onClick={() => (backfill.isBackfilling ? backfill.stop() : backfill.run(false))}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors shrink-0 ${
                  backfill.isBackfilling
                    ? 'bg-purple-100 hover:bg-purple-200 text-purple-700'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {backfill.isBackfilling
                  ? `Stop (${backfill.progress?.done ?? 0}/${backfill.progress?.total ?? '?'})`
                  : 'Fetch'}
              </button>
            </div>
            {backfill.isBackfilling && backfill.progress && (
              <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-400 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (backfill.progress.done / backfill.progress.total) * 100)}%` }}
                />
              </div>
            )}
            {backfill.status && !backfill.isBackfilling && (
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className={`text-xs ${backfill.status.ok ? 'text-gray-500' : 'text-red-500'}`}>
                  {backfill.status.text}
                </span>
                {backfill.log && (
                  <button onClick={backfill.downloadLog} className="text-xs text-red-500 hover:underline shrink-0">
                    Download log
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="py-3">
            <p className="text-sm font-medium text-gray-800">Last.fm API key</p>
            <p className="text-xs text-gray-500 mt-0.5 mb-2">
              Used for all accounts. Get one at{' '}
              <a href="https://www.last.fm/api/accounts" target="_blank" rel="noopener noreferrer" className="text-red-500 hover:underline">
                last.fm/api/accounts
              </a>.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={keyDraft}
                onChange={e => setKeyDraft(e.target.value)}
                placeholder="Your Last.fm API key"
                className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <button
                onClick={() => { onSaveApiKey(keyDraft.trim()); onClose() }}
                disabled={!keyChanged}
                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
              >
                Save
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex justify-end">
          <button onClick={onClose} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
