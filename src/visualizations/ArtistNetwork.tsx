import { useEffect, useMemo, useRef, useState } from 'react'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import type { VizProps } from './registry'
import {
  ArtistNetworkGraphSvg,
  type ArtistNetworkRenderEdge,
  type ArtistNetworkRenderNode,
} from './components/ArtistNetworkGraphSvg'

// NOTE: splitCollabs is accepted on the props for interface consistency, but
// this viz currently operates on raw `s.artist` strings only. Splitting
// collaborators here would require deciding how to attribute transitions
// across multi-artist tracks; not yet supported.

const PALETTE = [
  '#e6194b', '#f58231', '#ffe119', '#3cb44b', '#42d4f4',
  '#4363d8', '#911eb4', '#f032e6',
  '#800000', '#7c4700', '#5a5a00', '#1a5c1a', '#005f73',
  '#1a2f80', '#4b0082', '#7a005f',
  '#ff7c7c', '#ffb347', '#c9a800', '#57a857', '#29b6d8',
  '#7b96e8', '#c47de8', '#e87bc4',
  '#8b4513', '#2e8b57', '#4682b4', '#9932cc', '#20b2aa',
  '#cd853f', '#708090', '#c0392b',
]

const TRANSITION_WINDOW_S = 30 * 60 // 30 minutes

interface NetNode extends SimulationNodeDatum {
  id: string
  plays: number
  rank: number
  r: number
  color: string
}

interface NetLink extends SimulationLinkDatum<NetNode> {
  source: string | NetNode
  target: string | NetNode
  weight: number
}

interface TooltipState {
  node: NetNode
  neighbors: number
  x: number
  y: number
}

function computeTopArtists(scrobbles: { artist: string }[], n: number): { id: string; plays: number }[] {
  const counts = new Map<string, number>()
  for (const s of scrobbles) {
    if (!s.artist) continue
    counts.set(s.artist, (counts.get(s.artist) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id, plays]) => ({ id, plays }))
}

function computeTransitions(
  scrobbles: { artist: string; timestamp: number }[],
  topSet: Set<string>,
): Map<string, number> {
  // Sort ascending by timestamp; pair adjacent scrobbles within window
  const sorted = [...scrobbles].sort((a, b) => a.timestamp - b.timestamp)
  const edges = new Map<string, number>()
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const cur = sorted[i]
    const gap = cur.timestamp - prev.timestamp
    if (gap > TRANSITION_WINDOW_S) continue
    if (!prev.artist || !cur.artist) continue
    if (prev.artist === cur.artist) continue
    if (!topSet.has(prev.artist) || !topSet.has(cur.artist)) continue
    const a = prev.artist
    const b = cur.artist
    const key = a < b ? `${a}\x00${b}` : `${b}\x00${a}`
    edges.set(key, (edges.get(key) ?? 0) + 1)
  }
  return edges
}

export function ArtistNetwork({ scrobbles, onNavigate }: VizProps) {
  const [topN, setTopN] = useState<20 | 30 | 50>(30)
  const [minWeight, setMinWeight] = useState(3)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(800)
  const height = 600

  // Container width via ResizeObserver
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        const w = e.contentRect.width
        if (w > 0) setWidth(w)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Build initial nodes & edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const top = computeTopArtists(scrobbles, topN)
    const topSet = new Set(top.map(t => t.id))
    const maxPlays = top[0]?.plays ?? 1
    const nodes: NetNode[] = top.map((t, i) => ({
      id: t.id,
      plays: t.plays,
      rank: i,
      // r = 6..28 scaled by sqrt(plays/maxPlays)
      r: 6 + 22 * Math.sqrt(t.plays / maxPlays),
      color: PALETTE[i % PALETTE.length],
    }))

    const edgeMap = computeTransitions(scrobbles, topSet)
    const edges: NetLink[] = []
    for (const [key, weight] of edgeMap) {
      if (weight < minWeight) continue
      const [a, b] = key.split('\x00')
      edges.push({ source: a, target: b, weight })
    }
    return { initialNodes: nodes, initialEdges: edges }
  }, [scrobbles, topN, minWeight])

  // Live state for nodes/edges that the simulation updates
  const [tickNodes, setTickNodes] = useState<NetNode[]>([])
  const [tickEdges, setTickEdges] = useState<NetLink[]>([])
  const simRef = useRef<Simulation<NetNode, NetLink> | null>(null)

  // Spin up simulation when inputs change
  useEffect(() => {
    // Stop previous sim
    if (simRef.current) {
      simRef.current.stop()
      simRef.current = null
    }

    if (initialNodes.length === 0) {
      setTickNodes([])
      setTickEdges([])
      return
    }

    // Clone nodes/edges so the simulation owns them
    const nodes: NetNode[] = initialNodes.map(n => ({ ...n }))
    const nodeById = new Map(nodes.map(n => [n.id, n]))
    const edges: NetLink[] = initialEdges
      .map(e => {
        const sId = typeof e.source === 'string' ? e.source : e.source.id
        const tId = typeof e.target === 'string' ? e.target : e.target.id
        const s = nodeById.get(sId)
        const t = nodeById.get(tId)
        if (!s || !t) return null
        return { source: s, target: t, weight: e.weight } as NetLink
      })
      .filter((e): e is NetLink => e !== null)

    const sim = forceSimulation<NetNode>(nodes)
      .force('charge', forceManyBody<NetNode>().strength(-200))
      .force(
        'link',
        forceLink<NetNode, NetLink>(edges)
          .id(d => d.id)
          .distance(d => 100 - Math.min(80, d.weight * 2)),
      )
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide<NetNode>().radius(d => d.r + 4))

    sim.on('tick', () => {
      setTickNodes([...nodes])
      setTickEdges([...edges])
    })

    simRef.current = sim
    setTickNodes([...nodes])
    setTickEdges([...edges])

    return () => {
      sim.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNodes, initialEdges])

  // Re-center when width changes (without re-creating the simulation)
  useEffect(() => {
    const sim = simRef.current
    if (!sim) return
    sim.force('center', forceCenter(width / 2, height / 2))
    sim.alpha(0.3).restart()
  }, [width])

  // Neighbor lookup
  const neighborMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const e of tickEdges) {
      const s = typeof e.source === 'string' ? e.source : e.source.id
      const t = typeof e.target === 'string' ? e.target : e.target.id
      if (!map.has(s)) map.set(s, new Set())
      if (!map.has(t)) map.set(t, new Set())
      map.get(s)!.add(t)
      map.get(t)!.add(s)
    }
    return map
  }, [tickEdges])

  // Hover & drag state
  const [hovered, setHovered] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const dragRef = useRef<{ id: string } | null>(null)

  const onNodeMouseDown = (e: React.MouseEvent, node: NetNode) => {
    e.preventDefault()
    e.stopPropagation()
    const sim = simRef.current
    if (!sim) return
    sim.alphaTarget(0.3).restart()
    node.fx = node.x ?? 0
    node.fy = node.y ?? 0
    dragRef.current = { id: node.id }
  }

  // Global mousemove / mouseup for drag
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const drag = dragRef.current
      if (!drag) return
      const svg = containerRef.current?.querySelector('svg')
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const node = tickNodes.find(n => n.id === drag.id)
      if (!node) return
      node.fx = x
      node.fy = y
    }
    function onUp() {
      const drag = dragRef.current
      if (!drag) return
      const node = tickNodes.find(n => n.id === drag.id)
      if (node) {
        node.fx = null
        node.fy = null
      }
      const sim = simRef.current
      if (sim) sim.alphaTarget(0)
      dragRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [tickNodes])

  const onNodeMouseEnter = (e: React.MouseEvent, node: NetNode) => {
    const rect = (e.currentTarget as Element).getBoundingClientRect()
    setHovered(node.id)
    setTooltip({
      node,
      neighbors: neighborMap.get(node.id)?.size ?? 0,
      x: rect.left + rect.width / 2,
      y: rect.top,
    })
  }

  const onNodeMouseLeave = () => {
    setHovered(null)
    setTooltip(null)
  }

  const onNodeClick = (node: NetNode) => {
    if (dragRef.current) return
    if (onNavigate) onNavigate('artist-timeline')
    // Currently artist-timeline does not accept a pre-selected artist; navigation is enough.
    void node
  }

  if (scrobbles.length === 0) {
    return <div className="flex items-center justify-center h-64 text-gray-400">No data yet.</div>
  }

  const hoveredNeighbors = hovered ? neighborMap.get(hovered) : null
  const renderNodes: ArtistNetworkRenderNode[] = tickNodes
  const renderEdges = useMemo<ArtistNetworkRenderEdge[]>(
    () => tickEdges.map(e => ({ source: e.source as NetNode, target: e.target as NetNode, weight: e.weight })),
    [tickEdges],
  )

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-semibold text-gray-800">Artist Network</h2>
          <p className="text-xs text-gray-500">
            Artists you play back-to-back, clustered by similarity in your listening.
          </p>
        </div>
        <div className="flex gap-1 flex-wrap items-center">
          <span className="text-xs text-gray-400 mr-1">Top</span>
          {([20, 30, 50] as const).map(n => (
            <button
              key={n}
              onClick={() => setTopN(n)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                topN === n ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs text-gray-500 flex items-center gap-2">
          Min transitions
          <input
            type="range"
            min={1}
            max={20}
            value={minWeight}
            onChange={e => setMinWeight(Number(e.target.value))}
            className="accent-red-500"
          />
          <span className="tabular-nums text-gray-700 font-medium w-6 text-right">{minWeight}</span>
        </label>
        <span className="text-xs text-gray-400">
          {tickNodes.length} artists · {tickEdges.length} connections
        </span>
      </div>

      <div ref={containerRef} className="relative w-full" style={{ height }}>
        {tickEdges.length === 0 && tickNodes.length > 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm text-center px-4">
            Not enough back-to-back plays — try lowering the minimum-transitions threshold.
          </div>
        ) : null}
        <ArtistNetworkGraphSvg
          width={width}
          height={height}
          tickNodes={renderNodes}
          tickEdges={renderEdges}
          hovered={hovered}
          hoveredNeighbors={hoveredNeighbors ?? null}
          onNodeMouseDown={onNodeMouseDown}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          onNodeClick={onNodeClick}
        />

        {tooltip && (
          <div
            className="fixed z-50 pointer-events-none bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 shadow-lg -translate-x-1/2 -translate-y-full -mt-1.5"
            style={{ left: tooltip.x, top: tooltip.y - 6 }}
          >
            <div className="font-medium">{tooltip.node.id}</div>
            <div className="text-gray-300">
              {tooltip.node.plays.toLocaleString()} {tooltip.node.plays === 1 ? 'play' : 'plays'}
              {' · '}
              {tooltip.neighbors} {tooltip.neighbors === 1 ? 'neighbor' : 'neighbors'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
