import type { VizProps } from './registry'
import { EntityTimeline } from './EntityTimeline'

export function AlbumTimeline({ scrobbles, splitCollabs }: VizProps) {
  return <EntityTimeline scrobbles={scrobbles} splitCollabs={splitCollabs} dimension="album" title="Album Plays Over Time" />
}
