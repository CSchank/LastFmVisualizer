import { useMemo, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { useApiKey } from './hooks/useApiKey'
import { useAccounts } from './hooks/useAccounts'
import { useScrobbles } from './hooks/useScrobbles'
import { usePinnedViews } from './hooks/usePinnedViews'
import { useSettings } from './hooks/useSettings'
import { useArtistImageBackfill } from './hooks/useArtistImageBackfill'
import { SetupFlow } from './components/SetupFlow'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { SettingsModal } from './components/SettingsModal'
import { EntityDetailProvider } from './components/EntityDetail'
import { VISUALIZATIONS } from './visualizations/registry'

const ALL_VIEW_IDS = VISUALIZATIONS.map(v => v.id)

export default function App() {
  const { apiKey, save: saveApiKey } = useApiKey()
  const { accounts, activeAccount, addAccount, switchAccount, removeAccount } = useAccounts()
  const { settings, update: updateSettings } = useSettings()
  const backfill = useArtistImageBackfill(activeAccount ?? '', apiKey ?? '')
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeViz, setActiveViz] = useState(VISUALIZATIONS[0].id)
  const [addingAccount, setAddingAccount] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const splitCollabs = settings.splitCollabs
  const toggleSplitCollabs = () => updateSettings({ splitCollabs: !settings.splitCollabs })
  const { pinned, toggle: togglePin } = usePinnedViews(ALL_VIEW_IDS)
  const vizRef = useRef<HTMLDivElement>(null)
  const [isCapturing, setIsCapturing] = useState(false)

  const handleDownloadPng = async () => {
    if (!vizRef.current || isCapturing) return
    setIsCapturing(true)
    try {
      const dataUrl = await toPng(vizRef.current, { pixelRatio: 2 })
      const label = VISUALIZATIONS.find(v => v.id === activeViz)?.label ?? activeViz
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `${label.toLowerCase().replace(/\s+/g, '-')}-${activeAccount}.png`
      a.click()
    } finally {
      setIsCapturing(false)
    }
  }

  // The "all" view is always present in the nav, regardless of pin state
  const navViews = useMemo(
    () => VISUALIZATIONS.filter(v => v.id === 'all' || pinned.has(v.id)),
    [pinned],
  )

  const { scrobbles, total, loading } = useScrobbles(activeAccount ?? '', refreshKey)

  // Show setup if no API key, no accounts, or user is explicitly adding an account
  if (!apiKey || !activeAccount || addingAccount) {
    return (
      <SetupFlow
        hasApiKey={!!apiKey}
        onSaveApiKey={saveApiKey}
        onAddAccount={username => {
          addAccount(username)
          setAddingAccount(false)
        }}
      />
    )
  }

  const activeDefinition = VISUALIZATIONS.find(v => v.id === activeViz) ?? VISUALIZATIONS[0]
  const ActiveComponent = activeDefinition.component

  return (
    <EntityDetailProvider scrobbles={scrobbles} splitCollabs={splitCollabs}>
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header
        apiKey={apiKey}
        accounts={accounts}
        activeAccount={activeAccount}
        totalScrobbles={total}
        autoFetchImages={settings.autoFetchImages}
        backfill={backfill}
        onSyncComplete={() => setRefreshKey(k => k + 1)}
        onSwitchAccount={username => { switchAccount(username); setRefreshKey(k => k + 1) }}
        onAddAccount={() => setAddingAccount(true)}
        onRemoveAccount={removeAccount}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdate={updateSettings}
        apiKey={apiKey}
        onSaveApiKey={saveApiKey}
        backfill={backfill}
        activeAccount={activeAccount}
        onSyncComplete={() => setRefreshKey(k => k + 1)}
      />

      {/* Mobile nav */}
      <div className="md:hidden bg-white border-b border-gray-200 px-4 py-2 flex gap-2 overflow-x-auto">
        {navViews.map(v => (
          <button key={v.id} onClick={() => setActiveViz(v.id)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeViz === v.id ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700'
            }`}>
            {v.label}
          </button>
        ))}
        <button
          onClick={toggleSplitCollabs}
          className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ml-auto ${
            splitCollabs ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
          }`}>
          Split collabs
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          visualizations={navViews}
          activeId={activeViz}
          onSelect={setActiveViz}
          onUnpin={togglePin}
          splitCollabs={splitCollabs}
          onToggleSplitCollabs={toggleSplitCollabs}
        />
        <main className="flex-1 overflow-auto p-6">
          {!loading && (
            <div className="flex justify-end mb-3">
              <button
                onClick={handleDownloadPng}
                disabled={isCapturing}
                className="px-2.5 py-1 text-xs text-gray-500 bg-white border border-gray-200 hover:border-gray-300 hover:text-gray-700 disabled:opacity-40 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M8 2v8m0 0-3-3m3 3 3-3M2 11v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {isCapturing ? 'Capturing…' : 'Download PNG'}
              </button>
            </div>
          )}
          <div ref={vizRef}>
            {loading ? (
              <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
            ) : (
              <ActiveComponent
                scrobbles={scrobbles}
                splitCollabs={splitCollabs}
                onNavigate={setActiveViz}
                pinned={pinned}
                onTogglePin={togglePin}
              />
            )}
          </div>
        </main>
      </div>
    </div>
    </EntityDetailProvider>
  )
}
