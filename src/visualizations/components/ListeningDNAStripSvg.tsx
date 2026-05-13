import { format } from 'date-fns'

interface DayInfo {
  total: number
  topArtist: string | null
}

interface Props {
  labelWidth: number
  stripWidth: number
  totalHeight: number
  monthLabels: { x: number; label: string }[]
  years: number[]
  monthOffset: number
  rowHeight: number
  rowGap: number
  cellWidth: number
  selectedDay: string | null
  dayTop: Map<string, DayInfo>
  colorForDay: (dayKey: string) => string
  daysInYear: (year: number) => number
  onHover: (payload: { date: Date; total: number; topArtist: string | null; x: number; y: number }) => void
  onLeave: () => void
  onSelectDay: (dayKey: string, hasPlays: boolean) => void
}

export function ListeningDNAStripSvg({
  labelWidth,
  stripWidth,
  totalHeight,
  monthLabels,
  years,
  monthOffset,
  rowHeight,
  rowGap,
  cellWidth,
  selectedDay,
  dayTop,
  colorForDay,
  daysInYear,
  onHover,
  onLeave,
  onSelectDay,
}: Props) {
  return (
    <svg
      width={labelWidth + stripWidth}
      height={totalHeight}
      style={{ display: 'block' }}
    >
      {monthLabels.map((m, i) => (
        <text
          key={i}
          x={labelWidth + m.x}
          y={12}
          className="fill-gray-500"
          style={{ fontSize: 10 }}
        >
          {m.label}
        </text>
      ))}

      {years.map((year, yi) => {
        const rowTop = monthOffset + yi * (rowHeight + rowGap)
        const dCount = daysInYear(year)
        return (
          <g key={year}>
            <text
              x={labelWidth - 6}
              y={rowTop + rowHeight / 2 + 4}
              textAnchor="end"
              className="fill-gray-500 tabular-nums"
              style={{ fontSize: 11 }}
            >
              {year}
            </text>
            {Array.from({ length: dCount }, (_, i) => {
              const date = new Date(year, 0, 1 + i)
              const dayKey = format(date, 'yyyy-MM-dd')
              const fill = colorForDay(dayKey)
              const isSelected = selectedDay === dayKey
              const info = dayTop.get(dayKey)
              const hasPlays = (info?.total ?? 0) > 0
              return (
                <rect
                  key={i}
                  x={labelWidth + i * cellWidth}
                  y={rowTop}
                  width={cellWidth}
                  height={rowHeight}
                  fill={fill}
                  stroke={isSelected ? '#1f2937' : 'none'}
                  strokeWidth={isSelected ? 1.5 : 0}
                  style={{ cursor: hasPlays ? 'pointer' : 'default' }}
                  onMouseEnter={e => {
                    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect()
                    onHover({
                      date,
                      total: info?.total ?? 0,
                      topArtist: info?.topArtist ?? null,
                      x: r.left + r.width / 2,
                      y: r.top,
                    })
                  }}
                  onMouseLeave={onLeave}
                  onClick={() => onSelectDay(dayKey, hasPlays)}
                />
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}
