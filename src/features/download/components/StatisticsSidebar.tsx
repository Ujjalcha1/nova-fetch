import { useState, useEffect } from 'react'
import { useDownloadStore } from '../../../store/download-store'
import { formatBytes, formatSpeed } from '../../../lib/format'

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#1A2232] p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{title}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-white">{value}</p>
    </div>
  )
}

export default function StatisticsSidebar() {
  const [, setTick] = useState(0)
  const downloads = useDownloadStore((s) => s.downloads)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const activeDownloads = downloads.filter((d) => d.status === 'downloading')
  const activeSpeeds = activeDownloads.map((d) => d.speed)
  const currentSpeed = activeSpeeds.reduce((sum, s) => sum + s, 0)
  const avgSpeed = activeSpeeds.length > 0
    ? activeSpeeds.reduce((a, b) => a + b, 0) / activeSpeeds.length
    : 0

  const totalTransferred = downloads.reduce((sum, d) => sum + d.downloaded, 0)

  return (
    <div className="w-60 shrink-0 border-l border-white/10 bg-[#111827] p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
        Statistics
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <StatCard title="Downloads" value={String(downloads.length)} />
        <StatCard title="Transfer" value={formatBytes(totalTransferred)} />
        <StatCard title="Completed" value={String(downloads.filter((d) => d.status === 'completed').length)} />
        <StatCard title="Failed" value={String(downloads.filter((d) => d.status === 'failed').length)} />
        <StatCard title="Paused" value={String(downloads.filter((d) => d.status === 'paused').length)} />
        <StatCard title="Queue" value={String(downloads.filter((d) => d.status === 'queued').length)} />
        <StatCard title="Current Speed" value={formatSpeed(currentSpeed)} />
        <StatCard title="Average Speed" value={formatSpeed(avgSpeed)} />
      </div>
    </div>
  )
}
