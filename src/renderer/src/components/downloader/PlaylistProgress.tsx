import { Pause, Play, Square, Trash2, RefreshCcw, Clock3, Gauge } from 'lucide-react'

import { useMemo, useRef, useState } from 'react'

import { usePlaylistDownloadStore } from '../../store/playlistDownloadStore'
import { useQueueStore } from '../../store/queueStore'
import { useVideoStore } from '../../store/videoStore'

interface Props {
  playlistId: string
}

function buildPayload(item: ReturnType<typeof useQueueStore.getState>['queue'][number]) {
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

export default function PlaylistProgress({ playlistId }: Props) {
  const playlist = usePlaylistDownloadStore((s) => s.downloads[playlistId])
  const queue = useQueueStore((state) => state.queue)
  const addMany = useQueueStore((state) => state.addMany)
  const removeQueuePlaylist = useQueueStore((state) => state.removePlaylist)
  const pausePlaylist = useQueueStore((state) => state.pausePlaylist)
  const resumePlaylist = useQueueStore((state) => state.resumePlaylist)
  const cancelPlaylist = useQueueStore((state) => state.cancelPlaylist)
  const removeVideoPlaylist = useVideoStore((state) => state.removePlaylist)
  const startPlaylist = usePlaylistDownloadStore((state) => state.start)
  const removePlaylistState = usePlaylistDownloadStore((state) => state.remove)

  const [loadingAction, setLoadingAction] = useState<'pause' | 'resume' | 'cancel' | 'restart' | null>(null)
  const actionLockRef = useRef(false)

  const items = useMemo(() => queue.filter((item) => item.playlistId === playlistId), [queue, playlistId])
  const payloads = useMemo(() => items.map(buildPayload), [items])
  const progress =
    items.length === 0 ? playlist?.progress ?? 0 : items.reduce((sum, item) => sum + item.progress, 0) / items.length
  const downloading = items.find((item) => item.status === 'downloading')
  const paused = items.some((item) => item.status === 'paused')
  const status = playlist?.status ?? 'downloading'
  const canRestart = status === 'completed' || status === 'cancelled' || status === 'error'
  const buttonBusy = loadingAction !== null

  if (!playlist) {
    return null
  }

  async function runExclusive<T extends 'pause' | 'resume' | 'cancel' | 'restart'>(
    action: T,
    task: () => Promise<void>
  ) {
    if (actionLockRef.current) {
      return
    }

    actionLockRef.current = true
    setLoadingAction(action)

    try {
      await task()
    } finally {
      actionLockRef.current = false
      setLoadingAction(null)
    }
  }

  async function handlePause() {
    await runExclusive('pause', async () => {
      const ids = items.map((item) => item.id)
      pausePlaylist(playlistId)
      await window.api.download.pausePlaylist(ids)
    })
  }

  async function handleResume() {
    if (!payloads.length) {
      return
    }

    await runExclusive('resume', async () => {
      resumePlaylist(playlistId)
      await window.api.download.resumePlaylist(payloads)
    })
  }

  async function handleRestart() {
    if (!payloads.length) {
      return
    }

    await runExclusive('restart', async () => {
      const waitingPayloads = payloads.map((payload) => ({
        ...payload,
        progress: 0,
        speed: '-',
        eta: '-',
        status: 'waiting' as const,
        thumbnail: queue.find((item) => item.id === payload.id)?.thumbnail
      }))

      addMany(waitingPayloads)
      startPlaylist(playlistId, playlist.title, playlist.total)
      await window.api.download.startPlaylist(payloads)
    })
  }

  async function handleCancel() {
    await runExclusive('cancel', async () => {
      const ids = items.map((item) => item.id)
      cancelPlaylist(playlistId)
      await window.api.download.cancelPlaylist(ids)
    })
  }

  function handleRemove() {
    removeQueuePlaylist(playlistId)
    removePlaylistState(playlistId)
    removeVideoPlaylist(playlistId)
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-[#0B1220] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.20)]">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Playlist Progress</p>
            <p className="text-base font-medium text-white">
              {playlist.completed} / {playlist.total} downloaded
            </p>
          </div>

          <div className="inline-flex items-center rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-200">
            {progress.toFixed(1)}%
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border border-white/8 bg-white/3 p-4">
          <div className="h-3 overflow-hidden rounded-full bg-slate-800/80">
            <div
              className="h-full rounded-full bg-linear-to-r from-violet-500 via-cyan-500 to-emerald-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex justify-between text-xs font-medium text-slate-500">
            <span>Progress</span>
            <span>{progress.toFixed(1)}%</span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <Gauge size={14} />
              Speed
            </div>
            <p className="mt-3 text-sm font-medium text-white">{downloading?.speed ?? playlist.speed ?? '-'}</p>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <Clock3 size={14} />
              ETA
            </div>
            <p className="mt-3 text-sm font-medium text-white">{downloading?.eta ?? playlist.eta ?? '-'}</p>
          </div>

          <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <Clock3 size={14} />
              State
            </div>
            <p className="mt-3 text-sm font-medium capitalize text-white">
              {canRestart ? 'Ready to replay' : paused ? 'Paused' : status}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-white/8 pt-5">
          {status === 'downloading' && !paused && (
            <button
              onClick={handlePause}
              disabled={buttonBusy}
              className="inline-flex h-11 min-w-[120px] flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-medium text-white transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Pause size={16} />
              Pause
            </button>
          )}

          {paused && (
            <button
              onClick={handleResume}
              disabled={buttonBusy}
              className="inline-flex h-11 min-w-[120px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play size={16} />
              Resume
            </button>
          )}

          {canRestart && (
            <button
              onClick={handleRestart}
              disabled={buttonBusy}
              className="inline-flex h-11 min-w-[140px] flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCcw size={16} />
              Download Again
            </button>
          )}

          {(status === 'downloading' || status === 'paused' || canRestart) && (
            <button
              onClick={handleCancel}
              disabled={buttonBusy}
              className="inline-flex h-11 min-w-[120px] flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Square size={16} />
              Cancel
            </button>
          )}

          <button
            onClick={handleRemove}
            className="inline-flex h-11 min-w-[120px] flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/8 hover:text-white"
          >
            <Trash2 size={16} />
            Remove
          </button>
        </div>
      </div>
    </div>
  )
}

