import {
  FolderOpen,
  Loader2,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  PauseCircle,
  Trash2,
  RefreshCcw,
  ExternalLink
} from 'lucide-react'

import { useRef, useState } from 'react'

import { useQueueStore } from '../../store/queueStore'
import type { QueueItem } from '../../types/queue'

interface Props {
  item: QueueItem
}

function buildPayload(item: QueueItem) {
  return {
    id: item.id,
    url: item.url,
    folder: item.folder,
    formatId: item.formatId ?? 'best',
    format: item.format ?? 'mp4',
    type: item.type,
    filename: item.filename,
    title: item.title,
    playlistId: item.playlistId,
    playlistTitle: item.playlistTitle,
    playlistIndex: item.playlistIndex,
    playlistTotal: item.playlistTotal
  }
}

function ActionButton({
  children,
  className,
  disabled,
  onClick
}: {
  children: React.ReactNode
  className: string
  disabled?: boolean
  onClick: () => void | Promise<void>
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  )
}

export default function QueueItemCard({ item }: Props) {
  const [loading, setLoading] = useState(false)
  const actionLockRef = useRef(false)

  const remove = useQueueStore((s) => s.remove)
  const add = useQueueStore((s) => s.add)
  const update = useQueueStore((s) => s.update)

  const safeProgress = Math.min(Math.max(item.progress, 0), 100)
  const isWaiting = item.status === 'waiting'
  const isPaused = item.status === 'paused'
  const isDownloading = item.status === 'downloading'
  const isTerminal =
    item.status === 'completed' || item.status === 'error' || item.status === 'cancelled'

  async function runExclusive(task: () => Promise<void>) {
    if (actionLockRef.current) {
      return
    }

    actionLockRef.current = true
    setLoading(true)

    try {
      await task()
    } finally {
      actionLockRef.current = false
      setLoading(false)
    }
  }

  async function handlePause() {
    await runExclusive(async () => {
      await window.api.download.pause(item.id)
    })
  }

  async function handleResume() {
    if (!isPaused) {
      return
    }

    await runExclusive(async () => {
      update(item.id, {
        status: 'waiting'
      })

      await window.api.download.resume(buildPayload(item))
    })
  }

  async function handleRestart() {
    if (!isTerminal) {
      return
    }

    await runExclusive(async () => {
      const payload = buildPayload(item)

      add({
        ...item,
        progress: 0,
        speed: '-',
        eta: '-',
        status: 'waiting'
      })

      await window.api.download.start(payload)
    })
  }

  async function handleCancel() {
    await runExclusive(async () => {
      await window.api.download.cancel(item.id)
    })
  }

  async function handleDelete() {
    if (!item.filePath) return

    const confirmed = confirm(
      'Are you sure you want to permanently delete this downloaded file?\n\nThis action cannot be undone.'
    )

    if (!confirmed) return

    await runExclusive(async () => {
      try {
        await window.api.download.delete(item.filePath!)

        remove(item.id)

        window.api.system.notify('NovaFetch', 'File deleted successfully.')
      } catch (error) {
        console.error(error)

        window.api.system.notify('NovaFetch', 'Failed to delete the file.')
      }
    })
  }

  function handleRemove() {
    remove(item.id)
  }

  if (item.status === 'completed') {
    return (
      <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/6 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-300">
            <CheckCircle2 size={22} />
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300/80">
                Download Completed
              </div>
              <div className="mt-1 text-base font-medium text-white">Your file is ready.</div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <ActionButton
                onClick={handleRestart}
                disabled={loading}
                className="flex-1 min-w-[160px] bg-linear-to-r from-violet-600 to-blue-600 text-white"
              >
                <RefreshCcw size={16} />
                Download Again
              </ActionButton>
              <ActionButton
                onClick={async () => {
                  if (item.filePath) {
                    await window.api.download.openFile(item.filePath)
                  }
                }}
                disabled={!item.filePath}
                className="flex-1 min-w-[160px] border border-emerald-500/20 bg-emerald-500/10 text-emerald-200 hover:border-emerald-400/40 hover:bg-emerald-500/15"
              >
                <ExternalLink size={16} />
                Open File
              </ActionButton>
              <ActionButton
                onClick={async () => {
                  await window.api.system.openFolder(item.folder)
                }}
                className="flex-1 min-w-[160px] border border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/8"
              >
                <FolderOpen size={16} />
                Open Folder
              </ActionButton>
              <ActionButton
                onClick={handleDelete}
                className="flex-1 min-w-[160px] border border-red-500/20 bg-red-500/10 text-red-200 hover:border-red-400/40 hover:bg-red-500/15"
              >
                <Trash2 size={16} />
                Delete File
              </ActionButton>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (item.status === 'error') {
    return (
      <div className="rounded-[24px] border border-red-500/20 bg-red-500/6 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-300">
            <AlertTriangle size={22} />
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-red-300/80">
                Download Failed
              </div>
              <div className="mt-1 text-base font-medium text-white">
                Something went wrong while downloading.
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <ActionButton
                onClick={handleRestart}
                disabled={loading}
                className="flex-1 min-w-[160px] bg-linear-to-r from-violet-600 to-blue-600 text-white"
              >
                <RefreshCcw size={16} />
                Retry
              </ActionButton>

              <ActionButton
                onClick={handleRemove}
                className="flex-1 min-w-[160px] border border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/8"
              >
                <XCircle size={16} />
                Remove
              </ActionButton>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (item.status === 'cancelled') {
    return (
      <div className="rounded-[24px] border border-white/8 bg-white/4 p-6 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-500/10 text-slate-300">
            <XCircle size={22} />
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400/90">
                Download Cancelled
              </div>
              <div className="mt-1 text-base font-medium text-white">
                This download has been cancelled.
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <ActionButton
                onClick={handleRestart}
                disabled={loading}
                className="flex-1 min-w-[160px] bg-linear-to-r from-violet-600 to-blue-600 text-white"
              >
                <RefreshCcw size={16} />
                Retry
              </ActionButton>

              <ActionButton
                onClick={handleRemove}
                className="flex-1 min-w-[160px] border border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/8"
              >
                <Trash2 size={16} />
                Remove
              </ActionButton>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[24px] border border-white/8 bg-[#09090B] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {(isWaiting || isDownloading) && (
              <Loader2 size={18} color="#7C3AED" className="animate-spin" />
            )}
            {isPaused && <PauseCircle size={18} color="#F59E0B" />}
            {isTerminal && <XCircle size={18} color="#94A3B8" />}

            <div className="min-w-0">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                {item.type === 'file' ? 'Direct File' : 'YouTube Download'}
              </div>
              <h3 className="truncate text-base font-medium text-white">{item.title}</h3>
            </div>
          </div>

          <div className="inline-flex items-center rounded-full border border-white/8 bg-white/5 px-3 py-1 text-sm font-semibold text-slate-200">
            {safeProgress.toFixed(1)}%
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border border-white/8 bg-white/4 p-4">
          <div className="h-3 overflow-hidden rounded-full bg-slate-800/80">
            <div
              className="h-full rounded-full bg-linear-to-r from-violet-500 via-cyan-500 to-emerald-500 transition-all duration-300"
              style={{ width: `${safeProgress}%` }}
            />
          </div>

          <div className="flex justify-between text-xs font-medium text-slate-500">
            <span>Progress</span>
            <span>{safeProgress.toFixed(1)}%</span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Speed
            </div>
            <div className="mt-3 text-sm font-medium text-white">
              {isPaused ? 'Paused' : item.speed}
            </div>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              ETA
            </div>
            <div className="mt-3 text-sm font-medium text-white">{isPaused ? '-' : item.eta}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-white/8 pt-5">
          {isPaused ? (
            <ActionButton
              onClick={handleResume}
              disabled={loading}
              className="flex-1 min-w-[140px] bg-linear-to-r from-violet-600 to-blue-600 text-white"
            >
              <PlayCircle size={16} />
              Resume
            </ActionButton>
          ) : (
            <ActionButton
              onClick={handlePause}
              disabled={loading || isWaiting}
              className="flex-1 min-w-[140px] bg-amber-500 text-white hover:bg-amber-400"
            >
              <PauseCircle size={16} />
              Pause
            </ActionButton>
          )}

          <ActionButton
            onClick={handleCancel}
            disabled={loading}
            className="flex-1 min-w-[140px] bg-red-500 text-white hover:bg-red-400"
          >
            <XCircle size={16} />
            Cancel
          </ActionButton>

          <ActionButton
            onClick={handleRemove}
            className="flex-1 min-w-[140px] border border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/8"
          >
            <Trash2 size={16} />
            Remove
          </ActionButton>
        </div>
      </div>
    </div>
  )
}
