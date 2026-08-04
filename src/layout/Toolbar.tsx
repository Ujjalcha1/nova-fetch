import {
  Plus,
  Play,
  Pause,
  Square,
  Search,
  Download,
  Wifi,
  X,
  Settings
} from 'lucide-react'
import { useEffect } from 'react'
import { useDownloadStore } from '../store/download-store'
import { useSelectionStore } from '../store/selection-store'
import { useSearchStore } from '../store/search-store'
import { formatSpeed } from '../lib/format'
import { electron } from '../lib/electron'
import type { DownloadStatus } from '../types/download'

function ActionButton({
  icon: Icon,
  label,
  disabled,
  onClick,
  hoverColor
}: {
  icon: React.ElementType
  label: string
  disabled: boolean
  onClick: () => void
  hoverColor: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex h-9 w-9 items-center justify-center rounded-lg bg-[#1A2232] text-gray-300 transition ${
        disabled ? 'cursor-not-allowed opacity-40' : hoverColor
      }`}
      title={label}
    >
      <Icon size={18} />
    </button>
  )
}

export default function Toolbar({
  onNewDownload,
  onOpenSettings
}: {
  onNewDownload?: () => void
  onOpenSettings?: () => void
}) {
  const downloads = useDownloadStore((s) => s.downloads)
  const updateDownload = useDownloadStore((s) => s.updateDownload)

  const selectedIds = useSelectionStore((s) => s.selected)
  const selectedDownloads = selectedIds.map((id) => downloads.find((d) => d.id === id)).filter(Boolean) as typeof downloads

  const rawQuery = useSearchStore((s) => s.rawQuery)
  const setRaw = useSearchStore((s) => s.setRaw)
  const setQuery = useSearchStore((s) => s.setQuery)
  const clearSearch = useSearchStore((s) => s.clear)

  useEffect(() => {
    const id = setTimeout(() => setQuery(rawQuery.trim()), 300)
    return () => clearTimeout(id)
  }, [rawQuery, setQuery])

  const hasRunning = selectedDownloads.some((d) => d.status === 'downloading')
  const hasPaused = selectedDownloads.some((d) => d.status === 'paused')
  const hasQueued = selectedDownloads.some((d) => d.status === 'queued')
  const hasActive = hasRunning || hasPaused || hasQueued

  const activeStatuses: DownloadStatus[] = ['queued', 'connecting', 'downloading', 'retrying']
  const activeDownloads = downloads.filter((d) => activeStatuses.includes(d.status))
  const totalSpeed = activeDownloads.reduce((sum, d) => sum + d.speed, 0)
  const activeCount = activeDownloads.length

  async function handleResume() {
    const targets = selectedDownloads.filter((d) => d.status === 'paused')
    if (targets.length === 0) return
    const ids = targets.map((d) => d.id)
    const processed = await electron.resumeMany(ids)
    for (const id of processed) updateDownload(id, { status: 'downloading' })
  }

  async function handlePause() {
    const targets = selectedDownloads.filter((d) => d.status === 'downloading')
    if (targets.length === 0) return
    const ids = targets.map((d) => d.id)
    const processed = await electron.pauseMany(ids)
    for (const id of processed) updateDownload(id, { status: 'paused', speed: 0, eta: 0 })
  }

  async function handleStop() {
    const targets = selectedDownloads.filter((d) => ['downloading', 'paused', 'queued'].includes(d.status))
    if (targets.length === 0) return
    for (const d of targets) {
      updateDownload(d.id, { status: 'cancelled', progress: 0, speed: 0, eta: 0 })
      await electron.cancel(d.id)
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-[#10151F] px-3 lg:gap-4 lg:px-6">
      <div className="flex items-center gap-1.5 lg:gap-3">
        <button
          onClick={() => onNewDownload?.()}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-violet-600 px-3 text-sm font-medium transition hover:bg-violet-500 lg:gap-2 lg:px-4"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">New</span>
        </button>

        <div className="mx-1 h-7 w-px bg-white/10" />

        <div className="flex items-center gap-1 lg:gap-1.5">
          <ActionButton icon={Play} label="Resume" disabled={!hasPaused} onClick={handleResume} hoverColor="hover:text-white hover:bg-green-600" />
          <ActionButton icon={Pause} label="Pause" disabled={!hasRunning} onClick={handlePause} hoverColor="hover:text-white hover:bg-yellow-600" />
          <ActionButton icon={Square} label="Stop" disabled={!hasActive} onClick={handleStop} hoverColor="hover:text-white hover:bg-red-600" />
        </div>

      </div>

      <div className="flex items-center gap-1.5 lg:gap-3">
        <div className="group relative">
          <Search size={16} className="absolute left-2.5 top-2.5 text-gray-500 transition group-focus-within:text-violet-400" />
          <input
            type="text"
            value={rawQuery}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Search..."
            className="h-9 w-32 rounded-lg border border-white/10 bg-[#1A2232] pl-8 pr-7 text-sm outline-none transition placeholder:text-gray-600 focus:border-violet-500 focus:shadow-[0_0_12px_-2px] focus:shadow-violet-500/30 sm:w-44 lg:w-56 lg:pl-10 lg:pr-8"
          />
          {rawQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-1.5 top-1.5 rounded p-0.5 text-gray-500 transition hover:bg-white/10 hover:text-white lg:right-2"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="hidden h-9 items-center gap-2 rounded-lg bg-[#1A2232] px-2.5 sm:flex lg:gap-2.5 lg:px-3">
          <Download size={16} className="text-green-400 shrink-0" />
          <div>
            <div className="text-[10px] leading-none text-gray-500">Speed</div>
            <div className="text-sm font-semibold tabular-nums leading-tight">{formatSpeed(totalSpeed)}</div>
          </div>
        </div>

        <div className="hidden h-9 items-center gap-2 rounded-lg bg-[#1A2232] px-2.5 md:flex lg:gap-2.5 lg:px-3">
          <Wifi size={16} className="text-blue-400 shrink-0" />
          <div>
            <div className="text-[10px] leading-none text-gray-500">Active</div>
            <div className="text-sm font-semibold tabular-nums leading-tight">{activeCount}</div>
          </div>
        </div>

        <button
          onClick={onOpenSettings}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1A2232] text-gray-300 transition hover:bg-white/10 hover:text-white"
          title="Settings"
        >
          <Settings size={18} />
        </button>

      </div>
    </header>
  )
}