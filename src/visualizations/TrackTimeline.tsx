import type { VizProps } from './registry'
import { EntityTimeline } from './EntityTimeline'

export function TrackTimeline({ scrobbles, splitCollabs }: VizProps) {
  return <EntityTimeline scrobbles={scrobbles} splitCollabs={splitCollabs} dimension="track" title="Track Plays Over Time" />
}
