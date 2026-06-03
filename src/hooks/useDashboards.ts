import { useCallback, useEffect, useState } from 'react'
import { getDb, type Dashboard, type DashboardWidget } from '../db'

export function useDashboards(account: string) {
  const [dashboards, setDashboards] = useState<Dashboard[] | null>(null)

  const reload = useCallback(async () => {
    if (!account) { setDashboards([]); return }
    setDashboards(await getDb(account).dashboards.orderBy('createdAt').toArray())
  }, [account])

  useEffect(() => { reload() }, [reload])

  const create = async (name: string): Promise<number> => {
    const id = (await getDb(account).dashboards.add({ name, createdAt: Date.now(), widgets: [] })) as number
    await reload()
    return id
  }

  const rename = async (id: number, name: string) => {
    await getDb(account).dashboards.update(id, { name })
    await reload()
  }

  const remove = async (id: number) => {
    await getDb(account).dashboards.delete(id)
    await reload()
  }

  // Persist widget positions without a full reload, to avoid remounting the
  // grid mid-interaction. Keeps local state in sync optimistically.
  const saveWidgets = async (id: number, widgets: DashboardWidget[]) => {
    setDashboards(prev => prev?.map(d => (d.id === id ? { ...d, widgets } : d)) ?? null)
    await getDb(account).dashboards.update(id, { widgets })
  }

  return { dashboards, reload, create, rename, remove, saveWidgets }
}
