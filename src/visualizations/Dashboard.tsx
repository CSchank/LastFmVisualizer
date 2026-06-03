import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import GridLayout, { type Layout } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import type { VizProps } from './registry'
import { VISUALIZATIONS, widgetSize } from './registry'
import { useDashboards } from '../hooks/useDashboards'
import type { DashboardWidget } from '../db'
import { getViewIcon } from '../components/icons/ViewIcons'
import { CloseIcon } from '../components/icons/CommonIcons'

function getAccount(): string {
  return localStorage.getItem('lastfm_active_account') ?? ''
}

export function Dashboard({ scrobbles, splitCollabs }: VizProps) {
  const account = getAccount()
  const { dashboards, create, rename, remove, saveWidgets } = useDashboards(account)
  const [activeId, setActiveId] = useState<number | null>(() => {
    const stored = localStorage.getItem(`lastfm_active_dashboard_${account}`)
    return stored ? Number(stored) : null
  })
  const [picking, setPicking] = useState(false)
  const addable = useMemo(() => VISUALIZATIONS.filter(v => v.id !== 'all' && v.id !== 'dashboard'), [])

  // Measure the grid container ourselves — react-grid-layout's useContainerWidth
  // hook gets stuck at its 1280px default here, leaving dead space on the right.
  const [width, setWidth] = useState(0)
  const observerRef = useRef<ResizeObserver | null>(null)
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    if (!node) return
    setWidth(node.clientWidth)
    observerRef.current = new ResizeObserver(() => setWidth(node.clientWidth))
    observerRef.current.observe(node)
  }, [])

  useEffect(() => {
    if (!dashboards) return
    if (dashboards.length === 0) { setActiveId(null); return }
    if (activeId == null || !dashboards.some(d => d.id === activeId)) {
      setActiveId(dashboards[0].id!)
    }
  }, [dashboards, activeId])

  useEffect(() => {
    if (activeId != null) localStorage.setItem(`lastfm_active_dashboard_${account}`, String(activeId))
  }, [activeId, account])

  const active = dashboards?.find(d => d.id === activeId) ?? null

  const layout: Layout = useMemo(
    () => (active?.widgets ?? []).map(w => {
      const sz = widgetSize(w.vizId)
      return { i: w.i, x: w.x, y: w.y, w: w.w, h: w.h, minW: sz.minW, minH: sz.minH }
    }),
    [active],
  )

  const persist = (next: Layout) => {
    if (!active?.id) return
    const widgets = active.widgets.map(w => {
      const l = next.find(n => n.i === w.i)
      return l ? { ...w, x: l.x, y: l.y, w: l.w, h: l.h } : w
    })
    saveWidgets(active.id, widgets)
  }

  const handleCreate = async () => {
    const name = window.prompt('Dashboard name:', `Dashboard ${(dashboards?.length ?? 0) + 1}`)
    if (name === null) return
    const id = await create(name.trim() || 'Untitled')
    setActiveId(id)
  }

  const handleRename = async () => {
    if (!active?.id) return
    const name = window.prompt('Rename dashboard:', active.name)
    if (name === null || !name.trim()) return
    await rename(active.id, name.trim())
  }

  const handleDelete = async () => {
    if (!active?.id) return
    if (!window.confirm(`Delete “${active.name}”?`)) return
    await remove(active.id)
    setActiveId(null)
  }

  const addWidget = (vizId: string) => {
    if (!active?.id) return
    const maxY = active.widgets.reduce((m, w) => Math.max(m, w.y + w.h), 0)
    const i = `${vizId}-${crypto.randomUUID().slice(0, 8)}`
    const sz = widgetSize(vizId)
    const widget: DashboardWidget = { i, vizId, x: 0, y: maxY, w: sz.w, h: sz.h }
    saveWidgets(active.id, [...active.widgets, widget])
    setPicking(false)
  }

  const removeWidget = (i: string) => {
    if (!active?.id) return
    saveWidgets(active.id, active.widgets.filter(w => w.i !== i))
  }

  if (dashboards === null) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="font-semibold text-gray-800 mr-1">Dashboard</h2>
        {dashboards.length > 0 && (
          <select
            value={activeId ?? ''}
            onChange={e => setActiveId(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-red-300"
          >
            {dashboards.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        <button onClick={handleCreate}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">
          New
        </button>
        {active && (
          <>
            <button onClick={handleRename}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">
              Rename
            </button>
            <button onClick={handleDelete}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">
              Delete
            </button>
            <button onClick={() => setPicking(true)}
              className="ml-auto px-3 py-1.5 text-sm font-medium rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors">
              + Add widget
            </button>
          </>
        )}
      </div>

      {!active ? (
        <div className="text-center py-20">
          <p className="text-gray-500 mb-4">No dashboards yet.</p>
          <button onClick={handleCreate}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors">
            Create your first dashboard
          </button>
        </div>
      ) : active.widgets.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
          Empty dashboard — click “Add widget” to start.
        </div>
      ) : (
        <div ref={containerRef}>
          {width > 0 && (
          <GridLayout
            key={active.id}
            width={width}
            layout={layout}
            gridConfig={{ cols: 12, rowHeight: 36, margin: [12, 12] }}
            dragConfig={{ handle: '.rgl-drag', cancel: '.rgl-no-drag' }}
            onDragStop={persist}
            onResizeStop={persist}
          >
          {active.widgets.map(w => {
            const def = VISUALIZATIONS.find(v => v.id === w.vizId)
            const Comp = def?.component
            return (
              <div key={w.i} className="bg-white border border-gray-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
                <div className="rgl-drag cursor-move flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 bg-gray-50">
                  <span className="text-red-500 shrink-0">{getViewIcon(w.vizId, 'w-4 h-4')}</span>
                  <span className="text-xs font-medium text-gray-700 truncate flex-1">{def?.label ?? w.vizId}</span>
                  <button onClick={() => removeWidget(w.i)} title="Remove widget"
                    className="rgl-no-drag text-gray-400 hover:text-red-500 transition-colors shrink-0">
                    <CloseIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-3 min-h-0 flex flex-col">
                  {Comp
                    ? <Comp scrobbles={scrobbles} splitCollabs={splitCollabs} fill />
                    : <p className="text-sm text-gray-400">Unknown widget: {w.vizId}</p>}
                </div>
              </div>
            )
          })}
          </GridLayout>
          )}
        </div>
      )}

      {picking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onMouseDown={() => setPicking(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onMouseDown={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h2 className="font-semibold text-gray-800">Add widget</h2>
              <button onClick={() => setPicking(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {addable.map(v => (
                <button key={v.id} onClick={() => addWidget(v.id)}
                  className="text-left p-3 bg-white border border-gray-200 rounded-xl hover:border-red-300 hover:shadow-md transition-all group flex gap-3 items-start">
                  <span className="w-9 h-9 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0 group-hover:bg-red-100 transition-colors">
                    {getViewIcon(v.id, 'w-5 h-5')}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-gray-800 group-hover:text-red-500 transition-colors truncate">{v.label}</span>
                    <span className="block text-xs text-gray-500 leading-snug line-clamp-2">{v.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
