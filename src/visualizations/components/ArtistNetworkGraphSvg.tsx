import type React from 'react'

export interface ArtistNetworkRenderNode {
  id: string
  plays: number
  rank: number
  r: number
  color: string
  x?: number
  y?: number
}

export interface ArtistNetworkRenderEdge {
  source: ArtistNetworkRenderNode
  target: ArtistNetworkRenderNode
  weight: number
}

interface Props {
  width: number
  height: number
  tickNodes: ArtistNetworkRenderNode[]
  tickEdges: ArtistNetworkRenderEdge[]
  hovered: string | null
  hoveredNeighbors: Set<string> | null
  onNodeMouseDown: (e: React.MouseEvent, node: ArtistNetworkRenderNode) => void
  onNodeMouseEnter: (e: React.MouseEvent, node: ArtistNetworkRenderNode) => void
  onNodeMouseLeave: () => void
  onNodeClick: (node: ArtistNetworkRenderNode) => void
}

export function ArtistNetworkGraphSvg({
  width,
  height,
  tickNodes,
  tickEdges,
  hovered,
  hoveredNeighbors,
  onNodeMouseDown,
  onNodeMouseEnter,
  onNodeMouseLeave,
  onNodeClick,
}: Props) {
  return (
    <svg width={width} height={height} className="select-none">
      <g>
        {tickEdges.map((e, i) => {
          const s = e.source
          const t = e.target
          const isHover = hovered && (s.id === hovered || t.id === hovered)
          const dimmed = hovered != null && !isHover
          const w = Math.min(6, Math.max(0.5, Math.log2(e.weight + 1)))
          return (
            <line
              key={i}
              x1={s.x ?? 0}
              y1={s.y ?? 0}
              x2={t.x ?? 0}
              y2={t.y ?? 0}
              stroke={isHover ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.15)'}
              strokeWidth={isHover ? w + 1 : w}
              opacity={dimmed ? 0.15 : 1}
            />
          )
        })}
      </g>

      <g>
        {tickNodes.map(node => {
          const isHover = hovered === node.id
          const connected = hoveredNeighbors?.has(node.id) ?? false
          const dimmed = hovered != null && !isHover && !connected
          return (
            <g
              key={node.id}
              transform={`translate(${node.x ?? 0}, ${node.y ?? 0})`}
              style={{ cursor: 'pointer' }}
              onMouseDown={e => onNodeMouseDown(e, node)}
              onMouseEnter={e => onNodeMouseEnter(e, node)}
              onMouseLeave={onNodeMouseLeave}
              onClick={() => onNodeClick(node)}
              opacity={dimmed ? 0.25 : 1}
            >
              <circle
                r={node.r}
                fill={node.color}
                stroke={isHover ? '#1f2937' : 'rgba(255,255,255,0.7)'}
                strokeWidth={isHover ? 2 : 1}
              />
            </g>
          )
        })}
      </g>

      <g style={{ pointerEvents: 'none' }}>
        {tickNodes.map(node => {
          const isHover = hovered === node.id
          const connected = hoveredNeighbors?.has(node.id) ?? false
          const dimmed = hovered != null && !isHover && !connected
          if (node.r < 8) return null
          const fontSize = Math.max(9, Math.min(15, node.r * 0.55))
          return (
            <text
              key={node.id}
              x={(node.x ?? 0) + node.r + 3}
              y={(node.y ?? 0) + fontSize * 0.35}
              fontSize={fontSize}
              fill="#1f2937"
              opacity={dimmed ? 0.25 : 1}
              fontWeight={isHover ? 600 : 500}
              style={{
                paintOrder: 'stroke',
                stroke: 'white',
                strokeWidth: 3,
                strokeLinejoin: 'round',
              } as React.CSSProperties}
            >
              {node.id}
            </text>
          )
        })}
      </g>
    </svg>
  )
}
