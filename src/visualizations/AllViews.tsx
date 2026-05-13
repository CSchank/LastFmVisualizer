import type { VizProps } from './registry'
import { VISUALIZATIONS } from './registry'
import { getViewIcon } from '../components/icons/ViewIcons'
import { PinBookmarkIcon } from '../components/icons/CommonIcons'

export function AllViews({ onNavigate, pinned, onTogglePin }: VizProps) {
  const others = VISUALIZATIONS.filter(v => v.id !== 'all')

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold text-gray-800">All Views</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Pick a visualization to explore your data. Use the bookmark to pin it to your sidebar.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {others.map(v => {
          const isPinned = pinned?.has(v.id) ?? false
          return (
            <div
              key={v.id}
              role="button"
              tabIndex={0}
              onClick={() => onNavigate?.(v.id)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate?.(v.id) }
              }}
              className="relative text-left p-4 bg-white border border-gray-200 rounded-xl hover:border-red-300 hover:shadow-md hover:-translate-y-0.5 transition-all group cursor-pointer"
            >
              <button
                onClick={e => { e.stopPropagation(); onTogglePin?.(v.id) }}
                title={isPinned ? 'Unpin from sidebar' : 'Pin to sidebar'}
                className={`absolute top-3 right-3 p-1.5 rounded-md transition-colors ${
                  isPinned
                    ? 'text-red-500 hover:bg-red-50'
                    : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
                }`}
              >
                <PinBookmarkIcon filled={isPinned} />
              </button>
              <div className="w-12 h-12 rounded-lg bg-red-50 text-red-500 flex items-center justify-center mb-3 group-hover:bg-red-100 transition-colors">
                {getViewIcon(v.id)}
              </div>
              <h3 className="font-semibold text-gray-800 group-hover:text-red-500 transition-colors pr-6">
                {v.label}
              </h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{v.description}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
