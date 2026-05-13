import type { MouseEventHandler } from 'react'

interface Layer {
  artist: string
  path: string
  color: string
}

interface Tick {
  x: number
  label: string
}

interface Props {
  width: number
  height: number
  layers: Layer[]
  guideX: number | null
  paddingTop: number
  innerHeight: number
  xTicks: Tick[]
  onMouseMove: MouseEventHandler<SVGSVGElement>
  onMouseLeave: MouseEventHandler<SVGSVGElement>
}

export function StreamgraphChartSvg({
  width,
  height,
  layers,
  guideX,
  paddingTop,
  innerHeight,
  xTicks,
  onMouseMove,
  onMouseLeave,
}: Props) {
  return (
    <svg
      width={width}
      height={height}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{ display: 'block' }}
    >
      {layers.map(layer => (
        <path
          key={layer.artist}
          d={layer.path}
          fill={layer.color}
          fillOpacity={0.85}
          stroke="white"
          strokeWidth={0.5}
        />
      ))}
      {guideX !== null && (
        <line
          x1={guideX}
          x2={guideX}
          y1={paddingTop}
          y2={paddingTop + innerHeight}
          stroke="#1f2937"
          strokeWidth={1}
          strokeDasharray="3 3"
          pointerEvents="none"
        />
      )}
      {xTicks.map((t, i) => (
        <text
          key={i}
          x={t.x}
          y={height - 6}
          textAnchor="middle"
          fontSize="10"
          fill="#9ca3af"
        >
          {t.label}
        </text>
      ))}
    </svg>
  )
}
