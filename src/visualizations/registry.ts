import type { ComponentType } from 'react'
import type { Scrobble } from '../db'

export interface VizProps {
  scrobbles: Scrobble[]
  splitCollabs: boolean
  onNavigate?: (id: string) => void
  pinned?: Set<string>
  onTogglePin?: (id: string) => void
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

export const VISUALIZATIONS: VizDefinition[] = [
  {
    id: 'all',
    label: 'All Views',
    description: 'Browse every visualization',
    component: AllViews,
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
