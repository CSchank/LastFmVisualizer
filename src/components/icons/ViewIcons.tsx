import type { ReactNode } from 'react'

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function iconClass(className?: string): string {
  return className ?? 'w-7 h-7'
}

export function getViewIcon(viewId: string, className?: string): ReactNode {
  const cls = iconClass(className)
  const icons: Record<string, ReactNode> = {
    dashboard: (
      <svg {...base} className={cls}>
        <rect x="3" y="3" width="8" height="8" rx="1" />
        <rect x="13" y="3" width="8" height="5" rx="1" />
        <rect x="13" y="10" width="8" height="11" rx="1" />
        <rect x="3" y="13" width="8" height="8" rx="1" />
      </svg>
    ),
    recent: (
      <svg {...base} className={cls}>
        <path d="M3 6h18M3 12h18M3 18h12" />
        <circle cx="20" cy="18" r="1.4" fill="currentColor" />
      </svg>
    ),
    overview: (
      <svg {...base} className={cls}>
        <rect x="3" y="3" width="7.5" height="7.5" rx="1" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="1" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="1" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1" />
      </svg>
    ),
    timeline: (
      <svg {...base} className={cls}>
        <polyline points="3,18 8,12 13,15 18,7 21,4" />
        <line x1="3" y1="21" x2="21" y2="21" />
      </svg>
    ),
    'top-charts': (
      <svg {...base} className={cls}>
        <line x1="3" y1="20" x2="21" y2="20" />
        <rect x="5" y="13" width="3" height="7" />
        <rect x="11" y="8" width="3" height="12" />
        <rect x="17" y="4" width="3" height="16" />
      </svg>
    ),
    heatmap: (
      <svg {...base} className={cls}>
        <rect x="3.5" y="3.5" width="3.5" height="3.5" />
        <rect x="8.5" y="3.5" width="3.5" height="3.5" />
        <rect x="13.5" y="3.5" width="3.5" height="3.5" fill="currentColor" />
        <rect x="3.5" y="8.5" width="3.5" height="3.5" fill="currentColor" />
        <rect x="8.5" y="8.5" width="3.5" height="3.5" fill="currentColor" />
        <rect x="13.5" y="8.5" width="3.5" height="3.5" />
        <rect x="18.5" y="8.5" width="2" height="3.5" />
        <rect x="3.5" y="13.5" width="3.5" height="3.5" />
        <rect x="8.5" y="13.5" width="3.5" height="3.5" fill="currentColor" />
        <rect x="13.5" y="13.5" width="3.5" height="3.5" />
      </svg>
    ),
    calendar: (
      <svg {...base} className={cls}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="3" x2="8" y2="7" />
        <line x1="16" y1="3" x2="16" y2="7" />
        <rect x="7" y="13" width="2" height="2" fill="currentColor" stroke="none" />
        <rect x="11" y="13" width="2" height="2" fill="currentColor" stroke="none" />
        <rect x="15" y="13" width="2" height="2" fill="currentColor" stroke="none" />
        <rect x="7" y="17" width="2" height="2" fill="currentColor" stroke="none" />
      </svg>
    ),
    dna: (
      <svg {...base} className={cls}>
        <line x1="4" y1="6" x2="4" y2="18" />
        <line x1="6" y1="9" x2="6" y2="15" />
        <line x1="8" y1="5" x2="8" y2="19" />
        <line x1="10" y1="7" x2="10" y2="17" />
        <line x1="12" y1="4" x2="12" y2="20" />
        <line x1="14" y1="8" x2="14" y2="16" />
        <line x1="16" y1="6" x2="16" y2="18" />
        <line x1="18" y1="9" x2="18" y2="15" />
        <line x1="20" y1="5" x2="20" y2="19" />
      </svg>
    ),
    sessions: (
      <svg {...base} className={cls}>
        <circle cx="6" cy="7" r="1.8" />
        <circle cx="10" cy="9" r="1.8" />
        <circle cx="6.5" cy="13" r="1.8" />
        <circle cx="17" cy="6" r="1.8" />
        <circle cx="19" cy="11" r="1.8" />
        <circle cx="14" cy="17" r="1.8" />
        <circle cx="18" cy="18" r="1.8" />
      </svg>
    ),
    discovery: (
      <svg {...base} className={cls}>
        <polygon points="12,3 14,10 21,12 14,14 12,21 10,14 3,12 10,10" />
      </svg>
    ),
    'artist-race': (
      <svg {...base} className={cls}>
        <line x1="3" y1="20" x2="21" y2="20" />
        <line x1="3" y1="6" x2="14" y2="6" />
        <line x1="3" y1="11" x2="20" y2="11" />
        <line x1="3" y1="16" x2="11" y2="16" />
      </svg>
    ),
    streamgraph: (
      <svg {...base} className={cls}>
        <path d="M3 7 Q7 4 12 7 T21 7" />
        <path d="M3 12 Q7 9 12 12 T21 12" />
        <path d="M3 17 Q7 14 12 17 T21 17" />
      </svg>
    ),
    'artist-timeline': (
      <svg {...base} className={cls}>
        <circle cx="8" cy="8" r="3" />
        <path d="M3 21v-2a5 5 0 0 1 10 0v2" />
        <polyline points="14,12 17,9 20,12 22,7" />
      </svg>
    ),
    network: (
      <svg {...base} className={cls}>
        <circle cx="5" cy="6" r="2" />
        <circle cx="19" cy="6" r="2" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="5" cy="18" r="2" />
        <circle cx="19" cy="18" r="2" />
        <line x1="5" y1="6" x2="12" y2="12" />
        <line x1="19" y1="6" x2="12" y2="12" />
        <line x1="12" y1="12" x2="5" y2="18" />
        <line x1="12" y1="12" x2="19" y2="18" />
        <line x1="5" y1="6" x2="5" y2="18" />
      </svg>
    ),
    'album-timeline': (
      <svg {...base} className={cls}>
        <circle cx="9" cy="12" r="6" />
        <circle cx="9" cy="12" r="1.5" fill="currentColor" />
        <polyline points="17,8 20,11 17,15 22,17" />
      </svg>
    ),
    'track-timeline': (
      <svg {...base} className={cls}>
        <path d="M9 18V5l9-2v13" />
        <circle cx="6" cy="18" r="2" />
        <circle cx="15" cy="16" r="2" />
      </svg>
    ),
    forgotten: (
      <svg {...base} className={cls}>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        <line x1="3" y1="3" x2="21" y2="21" strokeDasharray="2 2" />
      </svg>
    ),
    diversity: (
      <svg {...base} className={cls}>
        <circle cx="9" cy="9" r="5" />
        <circle cx="15" cy="9" r="5" />
        <circle cx="12" cy="15" r="5" />
      </svg>
    ),
    'new-releases': (
      <svg {...base} className={cls}>
        <path d="M12 3v12" />
        <path d="M8 7l4-4 4 4" />
        <rect x="4" y="14" width="16" height="7" rx="1.5" />
        <line x1="8" y1="17.5" x2="16" y2="17.5" />
      </svg>
    ),
    'seasonal-favorites': (
      <svg {...base} className={cls}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v18M3 12h18" />
        <path d="M12 3c2.6 0 5.2 1.1 7 3" />
        <path d="M21 12c0 2.6-1.1 5.2-3 7" />
        <path d="M12 21c-2.6 0-5.2-1.1-7-3" />
        <path d="M3 12c0-2.6 1.1-5.2 3-7" />
      </svg>
    ),
    'year-in-review': (
      <svg {...base} className={cls}>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <line x1="8" y1="8" x2="16" y2="8" />
        <line x1="8" y1="12" x2="16" y2="12" />
        <line x1="8" y1="16" x2="13" y2="16" />
      </svg>
    ),
    'era-explorer': (
      <svg {...base} className={cls}>
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="12" x2="12" y2="7" />
        <line x1="12" y1="12" x2="16" y2="12" />
      </svg>
    ),
    'relisten-predictor': (
      <svg {...base} className={cls}>
        <path d="M4 12a8 8 0 0 1 14-5" />
        <polyline points="16,3 18,7 14,8" />
        <path d="M20 12a8 8 0 0 1-14 5" />
        <polyline points="8,21 6,17 10,16" />
      </svg>
    ),
    'hidden-gems': (
      <svg {...base} className={cls}>
        <path d="M12 3l2.7 5.5 6.1.9-4.4 4.2 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.2 6.1-.9z" />
      </svg>
    ),
    'streaks-milestones': (
      <svg {...base} className={cls}>
        <line x1="3" y1="20" x2="21" y2="20" />
        <line x1="6" y1="20" x2="6" y2="14" />
        <line x1="12" y1="20" x2="12" y2="9" />
        <line x1="18" y1="20" x2="18" y2="5" />
      </svg>
    ),
    'playlist-builder': (
      <svg {...base} className={cls}>
        <path d="M9 18V5l9-2v13" />
        <circle cx="6" cy="18" r="2" />
        <circle cx="15" cy="16" r="2" />
        <line x1="3" y1="4" x2="8" y2="4" />
      </svg>
    ),
  }

  return icons[viewId] ?? (
    <svg {...base} className={cls}>
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}
