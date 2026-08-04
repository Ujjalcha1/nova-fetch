import { Search, Trash2, Clock3, X } from 'lucide-react'
import { useDownloadStore } from '../store/download-store'
import { useNavigationStore } from '../store/navigation-store'
import { useSearch } from '../hooks/useSearch'
import type { DownloadStatus } from '../types/download'
import DownloadList from '../features/download/components/DownloadList'
import DetailsPanel from '../features/details/components/DetailsPanel'
import { useState } from 'react'

type FilterTab = 'all' | 'completed' | 'failed' | 'cancelled'

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',       label: 'All'       },
  { id: 'completed', label: 'Completed' },
  { id: 'failed',    label: 'Failed'    },
  { id: 'cancelled', label: 'Cancelled' },
]

const HISTORY_STATUSES: DownloadStatus[] = ['completed', 'failed', 'cancelled']

function statusFilterForTab(tab: FilterTab): DownloadStatus | DownloadStatus[] {
  if (tab === 'all') return HISTORY_STATUSES
  return tab
}

export default function HistoryPage() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const { value, setValue, debouncedQuery, clear } = useSearch()

  const downloads = useDownloadStore((s) => s.downloads)
  const removeDownload = useDownloadStore((s) => s.removeDownload)
  const selectDownload = useDownloadStore((s) => s.selectDownload)
  const navigate = useNavigationStore((s) => s.navigate)

  function handleClearAll() {
    const historyIds = downloads
      .filter((d) => HISTORY_STATUSES.includes(d.status))
      .map((d) => d.id)
    for (const id of historyIds) {
      removeDownload(id)
    }
    selectDownload(null as unknown as string)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2">
        {/* Search input with clear button */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-500" />

          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Search by title, URL, status, extension, folder…"
            className="w-full rounded-xl border border-white/10 bg-[#1A2232] py-2 pl-10 pr-8 text-sm outline-none transition focus:border-violet-500"
          />

          {value && (
            <button
              onClick={clear}
              className="absolute right-2.5 top-2.5 rounded p-0.5 text-gray-500 transition hover:text-white"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                activeFilter === tab.id
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleClearAll}
          className="flex items-center gap-2 rounded-lg bg-[#1A2232] px-3 py-1.5 text-sm text-red-400 transition hover:bg-red-600 hover:text-white"
        >
          <Trash2 size={16} />
          Clear All
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <DownloadList
          statusFilter={statusFilterForTab(activeFilter)}
          searchQuery={debouncedQuery || undefined}
          emptyState={{
            icon: Clock3,
            title: 'No History',
            description: 'Your download history will appear here.',
            action: { label: 'Start a New Download', onClick: () => navigate('downloads') }
          }}
        />
      </div>

      <div className="h-72 border-t border-white/10 bg-[#111827]">
        <DetailsPanel />
      </div>
    </div>
  )
}
