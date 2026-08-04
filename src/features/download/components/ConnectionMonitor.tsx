import { useState, useEffect } from 'react'
import { useDownloadStore } from '../../../store/download-store'

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#1A2232] p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{title}</p>
      <h2 className="mt-1 text-xl font-bold tabular-nums">{value}</h2>
    </div>
  )
}

export default function ConnectionMonitor() {
  const [, setTick] = useState(0)
  const downloads = useDownloadStore((s) => s.downloads)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const allConnections = downloads.flatMap((d) => d.connections)
  const activeDownloads = downloads.filter((d) => d.status === 'downloading')
  const activeConnectionPool = activeDownloads.flatMap((d) => d.connections)

  const activeConnectionsCount = allConnections.length
  const currentThreadsCount = activeConnectionPool.length
  const currentDownloadsCount = activeDownloads.length
  const queueLength = downloads.filter((d) => d.status === 'queued').length

  const statusCounts = allConnections.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1
    return acc
  }, {})

  const statusEntries = Object.entries(statusCounts)

  return (
    <div className="mt-4">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Connections
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard title="Active Connections" value={String(activeConnectionsCount)} />
        <StatCard title="Current Threads" value={String(currentThreadsCount)} />
        <StatCard title="Current Downloads" value={String(currentDownloadsCount)} />
        <StatCard title="Queue Length" value={String(queueLength)} />
      </div>
      {statusEntries.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {statusEntries.map(([status, count]) => (
            <span
              key={status}
              className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] capitalize text-gray-400"
            >
              {status}: {count}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
