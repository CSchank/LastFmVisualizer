import { useEffect, useState, useCallback } from 'react'

const KEY = 'lastfm_pinned_views'

export function usePinnedViews(defaultIds: string[]) {
  const [pinned, setPinned] = useState<Set<string>>(() => {
    const stored = localStorage.getItem(KEY)
    if (!stored) return new Set(defaultIds)
    try {
      const parsed = JSON.parse(stored)
      return Array.isArray(parsed) ? new Set(parsed) : new Set(defaultIds)
    } catch {
      return new Set(defaultIds)
    }
  })

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify([...pinned]))
  }, [pinned])

  const toggle = useCallback((id: string) => {
    setPinned(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return { pinned, toggle }
}
