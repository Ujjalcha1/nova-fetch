import { useState, useCallback, useMemo } from 'react'
import { ListMusic, CheckSquare, Square, Download, Loader2, Clock, Film, EyeOff } from 'lucide-react'
import type { PlaylistMetadata } from '../../types/download-metadata'
import { useDownloadStore } from '../../store/download-store'
import { electron } from '../../lib/electron'

type Props = {
  metadata: PlaylistMetadata
  folder: string
  onClose?: () => void
}

export default function PlaylistView({ metadata, folder, onClose }: Props) {
  const addDownload = useDownloadStore((s) => s.addDownload)
  const [showUnavailable, setShowUnavailable] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(
    new Set(metadata.entries.filter((e) => e.status === 'available').map((e) => e.id as string))
  )
  const [downloading, setDownloading] = useState(false)

  const visibleEntries = useMemo(
    () => showUnavailable ? metadata.entries : metadata.entries.filter((e) => e.status === 'available'),
    [metadata.entries, showUnavailable]
  )

  const allSelected = visibleEntries.length > 0 && visibleEntries.every((e) => selected.has(e.id as string))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = useCallback(() => {
    setSelected(new Set(visibleEntries.map((e) => e.id as string)))
  }, [visibleEntries])

  const deselectAll = useCallback(() => {
    setSelected(new Set())
  }, [])

  async function downloadSelected() {
    const entries = metadata.entries.filter((e) => selected.has(e.id as string))
    if (entries.length === 0) return

    setDownloading(true)

    for (const entry of entries) {
      const id = crypto.randomUUID()

      addDownload({
        id,
        title: entry.title,
        url: entry.url ?? '',
        thumbnail: entry.thumbnail ?? '',
        status: 'queued',
        progress: 0,
        speed: 0,
        eta: 0,
        downloaded: 0,
        totalSize: 0,
        priority: 'normal',
        retryCount: 0,
        maxRetries: 3,
        retryDelay: 30,
        retryAt: null,
        savePath: folder,
        addedAt: Date.now(),
        logs: [],
        files: [],
        connections: []
      })

      await electron.start({
        id,
        url: entry.url ?? '',
        outputPath: folder,
        format: ''
      }).catch(() => {})
    }

    onClose?.()
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Playlist info header — fixed */}
      <div className="flex shrink-0 items-start gap-4 border-b border-white/10 px-6 py-4">
        {metadata.thumbnail ? (
          <img
            src={metadata.thumbnail}
            alt=""
            className="h-16 w-28 flex-shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-16 w-28 flex-shrink-0 items-center justify-center rounded-lg bg-[#1A2232]">
            <ListMusic size={24} className="text-gray-500" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold">{metadata.title}</h3>
          {metadata.uploader && (
            <p className="mt-0.5 text-sm text-gray-400">{metadata.uploader}</p>
          )}
          <p className="mt-0.5 text-xs text-gray-500">
            {metadata.availableCount} video{metadata.availableCount !== 1 ? 's' : ''}
            {metadata.unavailableCount > 0 && ` (${metadata.unavailableCount} unavailable)`}
          </p>
        </div>
      </div>

      {/* Scroll container (for sticky toolbar + list) */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Sticky toolbar */}
        <div className="sticky top-0 z-10 border-b border-white/10 bg-[#111827] px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={allSelected ? deselectAll : selectAll}
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
            >
              {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>

            {metadata.unavailableCount > 0 && (
              <button
                onClick={() => setShowUnavailable((v) => !v)}
                className={`flex items-center gap-2 text-sm transition ${
                  showUnavailable ? 'text-violet-400' : 'text-gray-400 hover:text-white'
                }`}
              >
                <EyeOff size={16} />
                Show unavailable
              </button>
            )}

            <div className="ml-auto">
              <button
                onClick={downloadSelected}
                disabled={selected.size === 0 || downloading}
                className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-medium transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {downloading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Download size={16} />
                )}
                {downloading
                  ? 'Adding...'
                  : `Download Selected (${selected.size})`}
              </button>
            </div>
          </div>
        </div>

        {/* Video list */}
        <div className="px-4 py-2">
        {visibleEntries.map((entry) => (
          <label
            key={entry.id}
            className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition hover:bg-white/5"
          >
            <input
              type="checkbox"
              checked={selected.has(entry.id as string)}
              onChange={() => toggle(entry.id as string)}
              disabled={entry.status === 'unavailable'}
              className="h-4 w-4 flex-shrink-0 accent-violet-500"
            />

            <div className="relative h-11 w-[70px] flex-shrink-0 overflow-hidden rounded bg-[#1A2232]">
              {entry.thumbnail ? (
                <img
                  src={entry.thumbnail}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Film size={14} className="text-gray-500" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className={`truncate text-sm ${entry.status === 'unavailable' ? 'text-gray-500' : ''}`}>
                {entry.title}
              </p>
              {entry.status === 'unavailable' && entry.reason && (
                <p className="text-xs text-red-400">{entry.reason}</p>
              )}
            </div>

            {entry.duration != null && entry.status === 'available' && (
              <span className="flex flex-shrink-0 items-center gap-1 text-xs text-gray-400">
                <Clock size={11} />
                {formatTime(entry.duration)}
              </span>
            )}
          </label>
        ))}
      </div>
    </div>
  </div>
  )
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
