import { useEffect, useState } from 'react'
import { getDb, getAllScrobbles, getTotalScrobbles, type Scrobble } from '../db'

export interface ScrobbleStore {
  scrobbles: Scrobble[]
  total: number
  loading: boolean
}

export function useScrobbles(username: string, refreshKey: number): ScrobbleStore {
  const [scrobbles, setScrobbles] = useState<Scrobble[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const db = getDb(username)
    Promise.all([getAllScrobbles(db), getTotalScrobbles(db)]).then(([rows, count]) => {
      setScrobbles(rows)
      setTotal(count)
      setLoading(false)
    })
  }, [username, refreshKey])

  return { scrobbles, total, loading }
}
