import type { VizDefinition } from '../visualizations/registry'
import { CloseIcon } from './icons/CommonIcons'

interface Props {
  visualizations: VizDefinition[]
  activeId: string
  onSelect: (id: string) => void
  onUnpin: (id: string) => void
  splitCollabs: boolean
  onToggleSplitCollabs: () => void
}

export function Sidebar({ visualizations, activeId, onSelect, onUnpin, splitCollabs, onToggleSplitCollabs }: Props) {
  return (
    <nav className="w-52 shrink-0 bg-white border-r border-gray-200 py-4 hidden md:flex md:flex-col">
      <p className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Views</p>
      <div className="flex-1">
        {visualizations.map(v => {
          const isActive = activeId === v.id
          const canUnpin = v.id !== 'all'
          return (
            <div key={v.id} className={`group relative flex items-center transition-colors ${
              isActive ? 'bg-red-50 border-r-2 border-red-500' : 'hover:bg-gray-50'
            }`}>
              <button
                onClick={() => onSelect(v.id)}
                className={`flex-1 text-left px-4 py-2.5 ${
                  isActive ? 'text-red-600 font-medium' : 'text-gray-700'
                }`}
              >
                <span className="text-sm">{v.label}</span>
              </button>
              {canUnpin && (
                <button
                  onClick={() => onUnpin(v.id)}
                  title="Unpin from sidebar"
                  className="opacity-0 group-hover:opacity-100 px-2 py-1 mr-2 text-gray-400 hover:text-red-500 transition-opacity"
                >
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )
        })}
      </div>
      <div className="px-4 pt-3 border-t border-gray-100">
        <button
          onClick={onToggleSplitCollabs}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
            splitCollabs ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span className="font-medium">Split collabs</span>
          <div className={`w-8 h-4 rounded-full transition-colors relative ${splitCollabs ? 'bg-blue-500' : 'bg-gray-300'}`}>
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${splitCollabs ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
        </button>
      </div>
    </nav>
  )
}
