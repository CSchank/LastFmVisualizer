// Centered moving average. At edges, uses all available data rather than returning null.
export function movingAverage(data: number[], window: number): number[] {
  const half = Math.floor(window / 2)
  return data.map((_, i) => {
    const start = Math.max(0, i - half)
    const end = Math.min(data.length, i + half + 1)
    const slice = data.slice(start, end)
    return slice.reduce((a, b) => a + b, 0) / slice.length
  })
}

export type MAOption = { label: string; value: number }

export const MA_OPTIONS: Record<string, MAOption[]> = {
  day:   [{ label: '7d', value: 7 }, { label: '14d', value: 14 }, { label: '30d', value: 30 }],
  week:  [{ label: '4w', value: 4 }, { label: '8w', value: 8 },  { label: '13w', value: 13 }],
  month: [{ label: '3m', value: 3 }, { label: '6m', value: 6 },  { label: '12m', value: 12 }],
}

// Default window (first option) for each granularity
export const MA_WINDOW: Record<string, number> = Object.fromEntries(
  Object.entries(MA_OPTIONS).map(([k, opts]) => [k, opts[0].value])
)
