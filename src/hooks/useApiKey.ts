import { useState } from 'react'

const KEY = 'lastfm_api_key'

export function useApiKey() {
  const [apiKey, setApiKey] = useState<string | null>(() => localStorage.getItem(KEY))

  const save = (key: string) => {
    localStorage.setItem(KEY, key)
    setApiKey(key)
  }

  const clear = () => {
    localStorage.removeItem(KEY)
    setApiKey(null)
  }

  return { apiKey, save, clear }
}
