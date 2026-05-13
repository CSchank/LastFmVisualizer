import { useState } from 'react'

interface Props {
  hasApiKey: boolean
  onSaveApiKey: (key: string) => void
  onAddAccount: (username: string) => void
}

export function SetupFlow({ hasApiKey, onSaveApiKey, onAddAccount }: Props) {
  const [apiKey, setApiKey] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!hasApiKey && !apiKey.trim()) { setError('API key is required.'); return }
    if (!username.trim()) { setError('Username is required.'); return }
    if (!hasApiKey) onSaveApiKey(apiKey.trim())
    onAddAccount(username.trim())
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Last.fm Visualizer</h1>
          <p className="text-gray-500 mt-1">
            {hasApiKey ? 'Add a Last.fm username to track.' : 'Enter your API key and a username to get started.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!hasApiKey && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <input
                type="text"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Your Last.fm API key"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <p className="text-xs text-gray-400 mt-1">
                Get a free key at <span className="text-red-500">last.fm/api/account/create</span>
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last.fm Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="username"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {hasApiKey ? 'Add account' : "Let's go"}
          </button>
        </form>

        <p className="text-xs text-gray-400">
          Credentials stored in localStorage. Scrobble data cached in IndexedDB, namespaced per user.
        </p>
      </div>
    </div>
  )
}
