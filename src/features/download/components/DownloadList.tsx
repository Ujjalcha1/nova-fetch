import { useRef, useEffect, useCallback, useMemo } from 'react'
import { SearchX } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useDownloadStore } from '../../../store/download-store'
import { useSelectionStore } from '../../../store/selection-store'
import DownloadRow from './DownloadRow'
import EmptyState from '../../../components/common/EmptyState'
import type { DownloadStatus, DownloadPriority } from '../../../types/download'
import type { ComponentProps } from 'react'

type Props = {
  statusFilter?: DownloadStatus | DownloadStatus[]
  searchQuery?: string
  emptyState?: ComponentProps<typeof EmptyState>
}

const ROW_HEIGHT = 76

/** Extract the file extension from a savePath or from any file in the files list */
function getExtension(savePath: string, files: { name: string }[]): string {
  if (files.length > 0) {
    const ext = files[0].name.split('.').pop() ?? ''
    return ext.toLowerCase()
  }
  const ext = savePath.split('.').pop() ?? ''
  return ext.toLowerCase()
}

/** Folder = the directory portion of the savePath */
function getFolder(savePath: string): string {
  return savePath.replace(/[\\/][^\\/]*$/, '').toLowerCase()
}

/** Returns true if `text` contains `q` (case-insensitive) */
function contains(text: string, q: string): boolean {
  return text.toLowerCase().includes(q)
}

export default function DownloadList({ statusFilter, searchQuery, emptyState }: Props) {
  const allDownloads = useDownloadStore((s) => s.downloads)
  const selectDownload = useDownloadStore((s) => s.selectDownload)

  const selected = useSelectionStore((s) => s.selected)
  const toggle = useSelectionStore((s) => s.toggle)
  const selectMany = useSelectionStore((s) => s.selectMany)
  const clear = useSelectionStore((s) => s.clear)

  const PRIORITY_ORDER: Record<DownloadPriority, number> = {
    'very-high': 4,
    high: 3,
    normal: 2,
    low: 1,
    'very-low': 0,
  }

  const downloads = useMemo(
    () =>
      allDownloads.filter((d) => {
        // Status filter
        if (statusFilter) {
          const statuses = Array.isArray(statusFilter) ? statusFilter : [statusFilter]
          if (!statuses.includes(d.status)) return false
        }

        // Search filter — title, URL, status, extension, folder
        if (searchQuery) {
          const q = searchQuery.toLowerCase()
          const ext = getExtension(d.savePath, d.files)
          const folder = getFolder(d.savePath)
          const matched =
            contains(d.title, q) ||
            contains(d.url, q) ||
            contains(d.status, q) ||
            contains(ext, q) ||
            contains(folder, q)
          if (!matched) return false
        }

        return true
      })
        .sort((a, b) => {
          const aFinished = a.status === 'completed' || a.status === 'failed' || a.status === 'cancelled'
          const bFinished = b.status === 'completed' || b.status === 'failed' || b.status === 'cancelled'
          if (aFinished && bFinished) return a.addedAt - b.addedAt
          if (aFinished) return 1
          if (bFinished) return -1
          const pa = PRIORITY_ORDER[a.priority] ?? 2
          const pb = PRIORITY_ORDER[b.priority] ?? 2
          if (pa !== pb) return pb - pa
          return a.addedAt - b.addedAt
        }),
    [allDownloads, statusFilter, searchQuery]
  )

  const visibleIds = useMemo(() => downloads.map((d) => d.id), [downloads])
  const visibleSelectedCount = useMemo(
    () => visibleIds.filter((id) => selected.includes(id)).length,
    [visibleIds, selected]
  )
  const allVisibleSelected = visibleIds.length > 0 && visibleSelectedCount === visibleIds.length
  const someSelected = visibleSelectedCount > 0 && !allVisibleSelected

  const checkboxRef = useRef<HTMLInputElement>(null)
  const lastClickedIndex = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const visibleIdsRef = useRef<string[]>([])
  visibleIdsRef.current = visibleIds

  const virtualizer = useVirtualizer({
    count: downloads.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5
  })

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = someSelected
    }
  }, [someSelected])

  function handleHeaderSelect() {
    if (allVisibleSelected) {
      clear()
    } else {
      selectMany(visibleIds)
    }
  }

  const handleRowSelect = useCallback((id: string, e: React.MouseEvent) => {
    selectDownload(id)
    const index = visibleIdsRef.current.indexOf(id)

    if (e.shiftKey) {
      const anchor = lastClickedIndex.current ?? 0
      const start = Math.min(anchor, index)
      const end = Math.max(anchor, index)
      const ids = visibleIdsRef.current
      selectMany(ids.slice(start, end + 1))
      return
    }

    if (e.ctrlKey || e.metaKey) {
      toggle(id)
      lastClickedIndex.current = index
      return
    }

    selectMany([id])
    lastClickedIndex.current = index
  }, [selectDownload, toggle, selectMany])

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault()
      selectMany(visibleIds)
      return
    }

    if (e.key === 'Escape') {
      clear()
    }
  }

  // No downloads at all (before search filter)
  if (allDownloads.filter((d) => {
    if (!statusFilter) return true
    const statuses = Array.isArray(statusFilter) ? statusFilter : [statusFilter]
    return statuses.includes(d.status)
  }).length === 0) {
    return <EmptyState {...emptyState} />
  }

  // Downloads exist but none match the search query
  if (downloads.length === 0 && searchQuery) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5">
          <SearchX size={28} className="text-gray-500" />
        </span>
        <div className="text-center">
          <p className="font-medium text-gray-300">No matching downloads</p>
          <p className="mt-1 text-sm text-gray-500">
            No results for <span className="font-mono text-violet-400">"{searchQuery}"</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="download-grid border-b border-white/10 bg-[#141B29] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
        <label className="flex items-center">
          <input
            ref={checkboxRef}
            type="checkbox"
            checked={allVisibleSelected}
            onChange={handleHeaderSelect}
            className="h-4 w-4 accent-violet-500"
          />
        </label>
        <div />
        <div>Name</div>
        <div className="text-center">Status</div>
        <div className="hidden lg:block text-center">Progress</div>
        <div className="hidden lg:block text-right">Speed</div>
        <div className="hidden lg:block text-right">Size</div>
        <div className="hidden xl:block text-right">ETA</div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden outline-none"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            clear()
          }
        }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative'
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const download = downloads[virtualItem.index]
            return (
              <div
                key={download.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`
                }}
              >
                <DownloadRow
                  download={download}
                  onSelect={handleRowSelect}
                  searchQuery={searchQuery}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}