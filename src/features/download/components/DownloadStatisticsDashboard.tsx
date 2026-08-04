import { useDownloadStore } from '../../../store/download-store'
import SpeedGraph from './SpeedGraph'
import ConnectionChart from './ConnectionChart'
import TransferCards from './TransferCards'

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#1A2232] p-3 transition-all duration-200 hover:bg-[#1E2A3E] hover:shadow-sm hover:shadow-white/5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{title}</p>
      <h2 className="mt-1 text-xl font-bold tabular-nums">{value}</h2>
    </div>
  )
}

export default function DownloadStatisticsDashboard() {
  const downloads = useDownloadStore((s) => s.downloads)

  return (
    <div className="shrink-0 border-b border-white/10 bg-[#111827] px-4 py-3">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Status
      </div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard title="Total Downloads" value={String(downloads.length)} />
        <StatCard title="Active Downloads" value={String(downloads.filter((d) => d.status === 'downloading').length)} />
        <StatCard title="Completed Downloads" value={String(downloads.filter((d) => d.status === 'completed').length)} />
        <StatCard title="Failed Downloads" value={String(downloads.filter((d) => d.status === 'failed').length)} />
        <StatCard title="Queued Downloads" value={String(downloads.filter((d) => d.status === 'queued').length)} />
        <StatCard title="Paused Downloads" value={String(downloads.filter((d) => d.status === 'paused').length)} />
      </div>

      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Transfer
      </div>
      <TransferCards />

      <SpeedGraph />

      <ConnectionChart />
    </div>
  )
}
