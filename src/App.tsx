import { useMemo, useState } from 'react'
import { useApiKey } from './hooks/useApiKey'
import { useAccounts } from './hooks/useAccounts'
import { useScrobbles } from './hooks/useScrobbles'
import { usePinnedViews } from './hooks/usePinnedViews'
import { SetupFlow } from './components/SetupFlow'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { VISUALIZATIONS } from './visualizations/registry'

const ALL_VIEW_IDS = VISUALIZATIONS.map(v => v.id)

export default function App() {
  const { apiKey, save: saveApiKey } = useApiKey()
  const { accounts, activeAccount, addAccount, switchAccount, removeAccount } = useAccounts()
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeViz, setActiveViz] = useState(VISUALIZATIONS[0].id)
  const [addingAccount, setAddingAccount] = useState(false)
  const [splitCollabs, setSplitCollabs] = useState(false)
  const { pinned, toggle: togglePin } = usePinnedViews(ALL_VIEW_IDS)

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header
        apiKey={apiKey}
        accounts={accounts}
        activeAccount={activeAccount}
        totalScrobbles={total}
        onSyncComplete={() => setRefreshKey(k => k + 1)}
        onSwitchAccount={username => { switchAccount(username); setRefreshKey(k => k + 1) }}
        onAddAccount={() => setAddingAccount(true)}
        onRemoveAccount={removeAccount}
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
          onClick={() => setSplitCollabs(v => !v)}
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
          onToggleSplitCollabs={() => setSplitCollabs(v => !v)}
        />
        <main className="flex-1 overflow-auto p-6">
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
        </main>
      </div>
    </div>
  )
}
