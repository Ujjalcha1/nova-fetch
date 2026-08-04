import { useState, useEffect } from 'react'
import { useDownloadStore } from '../../../store/download-store'
import { formatBytes } from '../../../lib/format'

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#1A2232] p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{title}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-white">{value}</p>
    </div>
  )
}

export default function TransferCards() {
  const [, setTick] = useState(0)
  const downloads = useDownloadStore((s) => s.downloads)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const weekStart = new Date(now); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const monthStart = new Date(now); monthStart.setHours(0, 0, 0, 0); monthStart.setDate(1)

  const todayTs = todayStart.getTime()
  const weekTs = weekStart.getTime()
  const monthTs = monthStart.getTime()

  const today = downloads.filter((d) => d.addedAt >= todayTs).reduce((s, d) => s + d.downloaded, 0)
  const week = downloads.filter((d) => d.addedAt >= weekTs).reduce((s, d) => s + d.downloaded, 0)
  const month = downloads.filter((d) => d.addedAt >= monthTs).reduce((s, d) => s + d.downloaded, 0)
  const allTime = downloads.reduce((s, d) => s + d.downloaded, 0)

  return (
    <div className="grid grid-cols-4 gap-3">
      <Card title="Today" value={formatBytes(today)} />
      <Card title="Week" value={formatBytes(week)} />
      <Card title="Month" value={formatBytes(month)} />
      <Card title="All Time" value={formatBytes(allTime)} />
    </div>
  )
}
