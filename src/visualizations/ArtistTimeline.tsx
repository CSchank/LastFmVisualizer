import type { VizProps } from './registry'
import { EntityTimeline } from './EntityTimeline'

export function ArtistTimeline({ scrobbles, splitCollabs }: VizProps) {
  return <EntityTimeline scrobbles={scrobbles} splitCollabs={splitCollabs} dimension="artist" title="Artist Plays Over Time" />
}
