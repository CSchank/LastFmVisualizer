import { useEffect, useState, useCallback } from 'react'

const KEY = 'lastfm_settings'

export interface Settings {
  splitCollabs: boolean
  autoFetchImages: boolean
}

const DEFAULTS: Settings = {
  splitCollabs: false,
  autoFetchImages: true,
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => {
    const stored = localStorage.getItem(KEY)
    if (!stored) return DEFAULTS
    try {
      return { ...DEFAULTS, ...JSON.parse(stored) }
    } catch {
      return DEFAULTS
    }
  })

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings))
  }, [settings])

  const update = useCallback((partial: Partial<Settings>) => {
    setSettings(prev => ({ ...prev, ...partial }))
  }, [])

  return { settings, update }
}
