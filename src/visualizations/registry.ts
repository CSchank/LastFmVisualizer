import type { ComponentType } from 'react'
import type { Scrobble } from '../db'

export interface VizProps {
  scrobbles: Scrobble[]
  splitCollabs: boolean
  onNavigate?: (id: string) => void
  pinned?: Set<string>
  onTogglePin?: (id: string) => void
  // Set by the Dashboard when a viz is embedded as a resizable widget. Single-
  // chart views honor it to drop their own card chrome and fill the widget
  // height (chart uses maintainAspectRatio:false). Views that don't read it
  // simply render at natural size and scroll.
  fill?: boolean
}

export interface VizDefinition {
  id: string
  label: string
  description: string
  component: ComponentType<VizProps>
}

import { ScrobblesTimeline } from './ScrobblesTimeline'
import { TopCharts } from './TopCharts'
import { ListeningHeatmap } from './ListeningHeatmap'
import { Overview } from './Overview'
import { ArtistDiscovery } from './ArtistDiscovery'
import { ArtistRace } from './ArtistRace'
import { Streamgraph } from './Streamgraph'
import { ScrobbleCalendar } from './ScrobbleCalendar'
import { ListeningSessions } from './ListeningSessions'
import { ForgottenFavorites } from './ForgottenFavorites'
import { AllViews } from './AllViews'
import { ArtistTimeline } from './ArtistTimeline'
import { ArtistNetwork } from './ArtistNetwork'
import { AlbumTimeline } from './AlbumTimeline'
import { TrackTimeline } from './TrackTimeline'
import { RecentScrobbles } from './RecentScrobbles'
import { ListeningDNA } from './ListeningDNA'
import { PlayDiversity } from './PlayDiversity'
import { NewestReleases } from './NewestReleases'
import { SeasonalFavorites } from './SeasonalFavorites'
import { YearInReview } from './YearInReview'
import { EraExplorer } from './EraExplorer'
import { RelistenPredictor } from './RelistenPredictor'
import { HiddenGems } from './HiddenGems'
import { StreaksMilestones } from './StreaksMilestones'
import { PlaylistBuilder } from './PlaylistBuilder'
import { Dashboard } from './Dashboard'

export const VISUALIZATIONS: VizDefinition[] = [
  {
    id: 'all',
    label: 'All Views',
    description: 'Browse every visualization',
    component: AllViews,
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Build a custom dashboard — drag, drop, and resize any widgets',
    component: Dashboard,
  },
  {
    id: 'recent',
    label: 'Recent Scrobbles',
    description: 'Browse and filter your play history',
    component: RecentScrobbles,
  },
  {
    id: 'overview',
    label: 'Overview',
    description: 'Summary stats and highlights',
    component: Overview,
  },
  {
    id: 'timeline',
    label: 'Scrobbles Timeline',
    description: 'Listening activity over time',
    component: ScrobblesTimeline,
  },
  {
    id: 'top-charts',
    label: 'Top Charts',
    description: 'Top artists, albums, and tracks',
    component: TopCharts,
  },
  {
    id: 'heatmap',
    label: 'Listening Heatmap',
    description: 'When you listen — by hour and day',
    component: ListeningHeatmap,
  },
  {
    id: 'calendar',
    label: 'Scrobble Calendar',
    description: 'Year-grid heatmap of daily play counts',
    component: ScrobbleCalendar,
  },
  {
    id: 'dna',
    label: 'Listening DNA',
    description: 'Every day of your history as a barcode of taste',
    component: ListeningDNA,
  },
  {
    id: 'sessions',
    label: 'Listening Sessions',
    description: 'Clusters of consecutive plays',
    component: ListeningSessions,
  },
  {
    id: 'forgotten',
    label: 'Forgotten Favorites',
    description: 'Heavily played artists you no longer return to',
    component: ForgottenFavorites,
  },
  {
    id: 'diversity',
    label: 'Play Diversity',
    description: 'How varied your listening was per week, month, or year',
    component: PlayDiversity,
  },
  {
    id: 'discovery',
    label: 'Artist Discovery',
    description: 'When you first heard each artist',
    component: ArtistDiscovery,
  },
  {
    id: 'artist-race',
    label: 'Artist Race',
    description: 'Animated top artists over time',
    component: ArtistRace,
  },
  {
    id: 'streamgraph',
    label: 'Streamgraph',
    description: 'Top artists over time as flowing rivers',
    component: Streamgraph,
  },
  {
    id: 'artist-timeline',
    label: 'Artist Timeline',
    description: 'Plays per artist over time, line or ribbon',
    component: ArtistTimeline,
  },
  {
    id: 'network',
    label: 'Artist Network',
    description: 'How your favorite artists connect through your listening',
    component: ArtistNetwork,
  },
  {
    id: 'album-timeline',
    label: 'Album Timeline',
    description: 'Plays per album over time, line or ribbon',
    component: AlbumTimeline,
  },
  {
    id: 'track-timeline',
    label: 'Track Timeline',
    description: 'Plays per track over time, line or ribbon',
    component: TrackTimeline,
  },
  {
    id: 'new-releases',
    label: 'Newest Releases',
    description: 'Scan your artists and find their latest album releases',
    component: NewestReleases,
  },
  {
    id: 'seasonal-favorites',
    label: 'Seasonal Favorites',
    description: 'Find artists, albums, and tracks that spike by season',
    component: SeasonalFavorites,
  },
  {
    id: 'year-in-review',
    label: 'Year in Review',
    description: 'Generate annual recap cards and shareable summary text',
    component: YearInReview,
  },
  {
    id: 'era-explorer',
    label: 'Era Explorer',
    description: 'Explore your listening by first-heard decades',
    component: EraExplorer,
  },
  {
    id: 'relisten-predictor',
    label: 'Re-listen Predictor',
    description: 'Predict artists you are likely to revisit next',
    component: RelistenPredictor,
  },
  {
    id: 'hidden-gems',
    label: 'Hidden Gems',
    description: 'Find quietly repeated tracks with strong replay intensity',
    component: HiddenGems,
  },
  {
    id: 'streaks-milestones',
    label: 'Streaks & Milestones',
    description: 'Track your longest listening streaks and milestone dates',
    component: StreaksMilestones,
  },
  {
    id: 'playlist-builder',
    label: 'Playlist Builder',
    description: 'Build smart playlist candidates and export as CSV',
    component: PlaylistBuilder,
  },
]

// Per-view widget sizing for the Dashboard grid (12 cols, rowHeight 36).
// `w`/`h` is the size a freshly-added widget opens at — chosen to show the
// view without scrolling at its natural content height. `minW`/`minH` is how
// far it can be shrunk: bounded views (charts, calendar, heatmap, overview,
// streaks…) keep a min that fits their content so they don't scroll; inherently
// tall views (long lists/tables: recent scrobbles, year in review, sessions,
// the timelines…) keep a small floor and simply scroll. Derived from measured
// natural heights at ~700px wide. Streamgraph/Network need a wider min because
// their graphics don't shrink below ~470px.
export interface WidgetSize { w: number; h: number; minW: number; minH: number }

export const DEFAULT_WIDGET_SIZE: WidgetSize = { w: 6, h: 9, minW: 3, minH: 4 }

export const VIZ_SIZES: Record<string, WidgetSize> = {
  recent:               { w: 5, h: 10, minW: 3, minH: 5 },
  overview:             { w: 6, h: 13, minW: 4, minH: 10 },
  timeline:             { w: 6, h: 8,  minW: 3, minH: 4 },
  'top-charts':         { w: 5, h: 9,  minW: 3, minH: 4 },
  heatmap:              { w: 5, h: 10, minW: 4, minH: 8 },
  calendar:             { w: 8, h: 7,  minW: 4, minH: 4 },
  dna:                  { w: 8, h: 8,  minW: 4, minH: 5 },
  sessions:             { w: 6, h: 10, minW: 4, minH: 5 },
  forgotten:            { w: 4, h: 8,  minW: 3, minH: 7 },
  diversity:            { w: 6, h: 11, minW: 4, minH: 6 },
  discovery:            { w: 4, h: 10, minW: 3, minH: 5 },
  'artist-race':        { w: 6, h: 10, minW: 4, minH: 6 },
  streamgraph:          { w: 6, h: 9,  minW: 5, minH: 6 },
  'artist-timeline':    { w: 7, h: 11, minW: 4, minH: 6 },
  network:              { w: 6, h: 10, minW: 5, minH: 6 },
  'album-timeline':     { w: 7, h: 11, minW: 4, minH: 6 },
  'track-timeline':     { w: 7, h: 11, minW: 4, minH: 6 },
  'new-releases':       { w: 4, h: 9,  minW: 3, minH: 6 },
  'seasonal-favorites': { w: 5, h: 11, minW: 3, minH: 6 },
  'year-in-review':     { w: 6, h: 11, minW: 4, minH: 6 },
  'era-explorer':       { w: 5, h: 11, minW: 3, minH: 6 },
  'relisten-predictor': { w: 5, h: 11, minW: 3, minH: 5 },
  'hidden-gems':        { w: 5, h: 11, minW: 3, minH: 5 },
  'streaks-milestones': { w: 6, h: 13, minW: 3, minH: 10 },
  'playlist-builder':   { w: 5, h: 11, minW: 3, minH: 5 },
}

export function widgetSize(vizId: string): WidgetSize {
  return VIZ_SIZES[vizId] ?? DEFAULT_WIDGET_SIZE
}
