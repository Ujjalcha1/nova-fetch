import { useState, useEffect } from 'react'
import { Download, Play, Clock, CheckCircle2 } from 'lucide-react'
import { useDownloadStore } from '../../../store/download-store'
import { formatSpeed, formatBytes } from '../../../lib/format'

export default function SummaryBar() {
  const [, setTick] = useState(0)
  const downloads = useDownloadStore((s) => s.downloads)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const activeDownloads = downloads.filter((d) => d.status === 'downloading')
  const activeCount = activeDownloads.length
  const currentSpeed = activeDownloads.reduce((sum, d) => sum + d.speed, 0)

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayTs = todayStart.getTime()
  const completedToday = downloads
    .filter((d) => d.status === 'completed' && d.addedAt >= todayTs)
    .reduce((sum, d) => sum + d.downloaded, 0)

  const queueCount = downloads.filter((d) => d.status === 'queued').length

  return (
    <div className="flex h-auto min-h-[3.5rem] shrink-0 flex-wrap items-center gap-3 border-b border-white/10 bg-[#111827] px-3 py-2 lg:gap-6 lg:px-6 lg:py-0 lg:h-14">
      <div className="flex items-center gap-1.5 lg:gap-2">
        <Download size={14} className="shrink-0 text-purple-400 lg:size-4" />
        <span className="text-xs text-gray-400">Active</span>
        <span className="text-sm font-semibold tabular-nums text-white">{activeCount}</span>
      </div>

      <div className="flex items-center gap-1.5 lg:gap-2">
        <Play size={14} className="shrink-0 text-green-400 lg:size-4" />
        <span className="text-xs text-gray-400">Speed</span>
        <span className="text-sm font-semibold tabular-nums text-white">{formatSpeed(currentSpeed)}</span>
      </div>

      <div className="flex items-center gap-1.5 lg:gap-2">
        <CheckCircle2 size={14} className="shrink-0 text-emerald-400 lg:size-4" />
        <span className="hidden text-xs text-gray-400 sm:inline">Completed</span>
        <span className="text-xs text-gray-400 sm:hidden">Today</span>
        <span className="text-sm font-semibold tabular-nums text-white">{formatBytes(completedToday)}</span>
      </div>

      <div className="flex items-center gap-1.5 lg:gap-2">
        <Clock size={14} className="shrink-0 text-blue-400 lg:size-4" />
        <span className="text-xs text-gray-400">Queue</span>
        <span className="text-sm font-semibold tabular-nums text-white">{queueCount}</span>
      </div>
    </div>
  )
}