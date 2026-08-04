import { useState, useCallback, memo } from 'react'
import {
  CheckCircle2, Clock3, Loader2, XCircle, AlertCircle,
  Search, Download, Wifi, Pause, RefreshCw, RotateCcw, Settings
} from 'lucide-react'
import type { DownloadItem } from '../../../types/download'
import { useSelectionStore } from '../../../store/selection-store'
import { useDownloadStore } from '../../../store/download-store'
import { useToastStore } from '../../../store/toast-store'
import { formatSpeed, formatBytes, formatEta, formatProgress } from '../../../lib/format'
import { highlightText } from '../../../lib/highlight'
import { electron } from '../../../lib/electron'
import DownloadThumbnail from './DownloadThumbnail'
import ContextMenu, { type ContextMenuState } from './ContextMenu'
import DeleteConfirmationDialog, { type DeleteAction } from '../../dialogs/DeleteConfirmationDialog'

type StatusConfig = {
  icon: React.ElementType
  label: string
  badge: string
}

type Props = {
  download: DownloadItem
  onSelect: (id: string, e: React.MouseEvent) => void
  searchQuery?: string
}

function getStatusConfig(status: DownloadItem['status']): StatusConfig {
  switch (status) {
    case 'queued':
      return { icon: Clock3, label: 'Queued', badge: 'bg-blue-500/15 text-blue-300 border border-blue-500/25' }
    case 'analyzing':
    case 'fetching-metadata':
      return { icon: Search, label: status === 'analyzing' ? 'Analyzing' : 'Fetching Meta', badge: 'bg-blue-500/15 text-blue-300 border border-blue-500/25' }
    case 'connecting':
      return { icon: Wifi, label: 'Connecting', badge: 'bg-gray-500/15 text-gray-300 border border-gray-500/25' }
    case 'downloading':
      return { icon: Download, label: 'Downloading', badge: 'bg-purple-500/20 text-purple-300 border border-purple-500/30' }
    case 'paused':
      return { icon: Pause, label: 'Paused', badge: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' }
    case 'retrying':
      return { icon: RefreshCw, label: 'Retrying', badge: 'bg-orange-500/20 text-orange-300 border border-orange-500/30' }
    case 'merging':
      return { icon: RotateCcw, label: 'Merging', badge: 'bg-purple-500/20 text-purple-300 border border-purple-500/30' }
    case 'processing':
      return { icon: Settings, label: 'Processing', badge: 'bg-orange-500/20 text-orange-300 border border-orange-500/30' }
    case 'completed':
      return { icon: CheckCircle2, label: 'Completed', badge: 'bg-green-500/20 text-green-300 border border-green-500/30' }
    case 'cancelled':
      return { icon: XCircle, label: 'Canceled', badge: 'bg-gray-500/15 text-gray-400 border border-gray-500/20' }
    case 'failed':
      return { icon: AlertCircle, label: 'Failed', badge: 'bg-red-500/20 text-red-300 border border-red-500/30' }
    default:
      return { icon: Loader2, label: String(status), badge: 'bg-white/5 text-gray-400 border border-white/10' }
  }
}

function DownloadRow({ download, onSelect, searchQuery }: Props) {
  const toggleSelection = useSelectionStore((s) => s.toggle)
  const isSelected = useSelectionStore((s) => s.selected.includes(download.id))
  const removeDownload = useDownloadStore((s) => s.removeDownload)
  const addToast = useToastStore((s) => s.addToast)
  const cfg = getStatusConfig(download.status)
  const StatusIcon = cfg.icon

  const q = searchQuery ?? ''

  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  console.log('[Dialog] render')

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, download })
  }, [download])

  const closeMenu = useCallback(() => setMenu(null), [])

  // ── Delete dialog handling ────────────────────────────────────────────────

  const handleDelete = useCallback((id: string) => {
    console.log('[Dialog] open =', id ? 'true' : 'false')
    setDeleteTarget(id)
  }, [])

  async function handleDeleteAction(action: DeleteAction) {
    const ids = (() => {
      const sel = useSelectionStore.getState().selected
      if (deleteTarget && sel.length > 1 && sel.includes(deleteTarget)) return sel
      return deleteTarget ? [deleteTarget] : []
    })()
    setDeleteTarget(null)

    if (action === 'cancel' || ids.length === 0) return

    const allDls = useDownloadStore.getState().downloads
    let hadErrors = false

    for (const id of ids) {
      const download = allDls.find((dl) => dl.id === id)
      if (!download) {
        removeDownload(id)
        continue
      }

      if (action === 'delete-with-file') {
        const filenames = download.files.map((f) => f.name)

        // Delete all files on disk (final file + .part + .partinfo + temps)
        if (filenames.length > 0) {
          const result = await electron.deleteDownloadFiles({
            id,
            savePath: download.savePath,
            filenames,
          })
          if (!result.success) {
            hadErrors = true
            console.error('[Delete] file deletion failed', result.error)
          }
        }
      } else {
        // Plain delete — stop the queue entry so a removed download never
        // keeps running in the background (pre-regression behaviour).
        await electron.cancel(id).catch(() => {})
      }

      removeDownload(id)
    }

    useSelectionStore.getState().clear()

    if (action === 'delete-with-file') {
      if (hadErrors) {
        addToast({
          message: 'Some files could not be deleted',
          subtitle: 'The download entry has been removed, but some files remain on disk.',
          type: 'error',
        })
      } else {
        addToast({
          message: ids.length > 1 ? `${ids.length} downloads deleted.` : 'Download and files deleted.',
          type: 'success',
        })
      }
    } else {
      addToast({
        message: ids.length > 1 ? `${ids.length} downloads removed.` : 'Download removed from list.',
        type: 'success',
      })
    }
  }

  return (
    <>
      <div
        onClick={(e) => onSelect(download.id, e)}
        onContextMenu={handleContextMenu}
        className={`
          relative download-grid h-[76px] cursor-pointer
          items-center border-b border-white/5 px-4
          transition-all duration-200
          ${isSelected
            ? 'bg-violet-600/25 hover:bg-violet-600/30'
            : download.status === 'downloading'
              ? 'bg-purple-900/20 hover:bg-purple-900/30'
              : download.status === 'paused'
                ? 'bg-gray-800/20 hover:bg-gray-800/30'
                : download.status === 'completed'
                  ? 'bg-green-900/15 hover:bg-green-900/25'
                  : download.status === 'failed'
                    ? 'bg-red-900/15 hover:bg-red-900/25'
                    : 'hover:bg-white/[0.07]'
          }
        `}
      >
        {(() => {
          if (isSelected) {
            return <span className="pointer-events-none absolute inset-y-0 left-0 w-[4px] rounded-r-full bg-violet-400" />
          }
          switch (download.status) {
            case 'downloading':
              return <span className="pointer-events-none absolute inset-y-0 left-0 w-[4px] rounded-r-full bg-purple-500" />
            case 'paused':
              return <span className="pointer-events-none absolute inset-y-0 left-0 w-[3px] rounded-r-full bg-gray-500" />
            case 'completed':
              return <span className="pointer-events-none absolute inset-y-0 left-0 w-[3px] rounded-r-full bg-green-500" />
            case 'failed':
              return <span className="pointer-events-none absolute inset-y-0 left-0 w-[3px] rounded-r-full bg-red-500" />
          }
          return null
        })()}

        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleSelection(download.id)}
          onClick={(e) => e.stopPropagation()}
          className={`h-4 w-4 cursor-pointer accent-violet-500 transition-all duration-200 ${
            isSelected ? 'ring-1 ring-violet-500 ring-offset-1 ring-offset-[#0D1117]' : 'ring-0 opacity-60 hover:opacity-100'
          }`}
        />

        <div className="flex items-center justify-center">
          <DownloadThumbnail thumbnail={download.thumbnail} size="row" />
        </div>

        <div className="min-w-0 overflow-hidden">
          <h3 className="truncate text-sm font-medium leading-tight">
            {highlightText(download.title, q)}
          </h3>
          <p className="truncate text-xs text-gray-500">
            {highlightText(download.url, q)}
          </p>
        </div>

        <div className="flex items-center justify-center">
          <div className={`flex w-auto min-w-0 items-center justify-center gap-1 rounded-lg px-2 py-1.5 lg:px-2.5 ${cfg.badge}`}>
            <StatusIcon size={13} className="shrink-0" />
            <span className="hidden text-[11px] font-semibold sm:inline">{cfg.label}</span>
          </div>
        </div>

        <div className="hidden flex-col items-center justify-center lg:flex">
          <span className="text-xs tabular-nums">{formatProgress(download.progress)}</span>
          <div className="mt-1 h-1.5 w-full max-w-[80px] rounded-full bg-white/10">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${
                download.status === 'paused'
                  ? 'bg-gradient-to-r from-gray-600 to-gray-400'
                  : download.status === 'failed'
                    ? 'bg-gradient-to-r from-red-600 to-red-400'
                    : download.status === 'completed'
                      ? 'bg-gradient-to-r from-green-600 to-green-400'
                      : 'bg-gradient-to-r from-violet-600 to-violet-400'
              }`}
              style={{ width: `${download.progress}%` }}
            />
          </div>
        </div>

        <div className="hidden text-right text-xs tabular-nums text-gray-300 lg:block">
          {download.status === 'failed' ? '0 B/s' : formatSpeed(download.speed)}
        </div>

        <div className="hidden whitespace-nowrap text-right text-xs tabular-nums text-gray-300 lg:block">
          {formatBytes(download.downloaded)} / {formatBytes(download.totalSize)}
        </div>

        <div className="hidden whitespace-nowrap text-right text-xs tabular-nums text-gray-300 xl:block">
          {download.status === 'retrying' && download.retryAt
            ? (() => {
                const remaining = Math.max(0, Math.ceil((download.retryAt - Date.now()) / 1000))
                return `Retry in ${remaining}s (${download.retryCount}/${download.maxRetries})`
              })()
            : formatEta(download.eta, download.status)
          }
        </div>
      </div>

      {menu && <ContextMenu state={menu} onClose={closeMenu} onDelete={handleDelete} />}
      {deleteTarget && (() => {
        const sel = useSelectionStore.getState().selected
        const count = sel.length > 1 && sel.includes(download.id) ? sel.length : undefined
        return (
          <DeleteConfirmationDialog
            title={download.title}
            count={count}
            onClose={handleDeleteAction}
          />
        )
      })()}
    </>
  )
}

export default memo(
  DownloadRow,
  (prev, next) =>
    prev.download === next.download &&
    prev.onSelect === next.onSelect &&
    prev.searchQuery === next.searchQuery
)