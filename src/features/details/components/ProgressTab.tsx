import type { DownloadItem } from '../../../types/download'
import { formatSpeed, formatBytes, formatEta, formatProgress } from '../../../lib/format'

type Props = {
  download: DownloadItem
}

// ---------------------------------------------------------------------------
// SizeDisplay — downloaded / remaining / total stacked widget
// ---------------------------------------------------------------------------

function SizeDisplay({ downloaded, remaining, total }: {
  downloaded: number
  remaining: number
  total: number
}) {
  const hasTotal = total > 0
  return (
    <div className="flex flex-wrap items-baseline gap-4">
      {/* Downloaded — primary */}
      <div className="flex flex-col">
        <span className="font-mono text-xl font-bold tabular-nums text-white">
          {formatBytes(downloaded)}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">downloaded</span>
      </div>

      {hasTotal && (
        <>
          <div className="h-8 w-px shrink-0 self-center bg-white/10" />

          {/* Remaining */}
          <div className="flex flex-col">
            <span className="font-mono text-base font-semibold tabular-nums text-violet-300">
              {formatBytes(remaining)}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">remaining</span>
          </div>

          <div className="h-8 w-px shrink-0 self-center bg-white/10" />

          {/* Total */}
          <div className="flex flex-col">
            <span className="font-mono text-base font-medium tabular-nums text-gray-400">
              {formatBytes(total)}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">total</span>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card — generic stat tile
// ---------------------------------------------------------------------------

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#1A2232] p-4">
      <p className="text-xs text-gray-400">{title}</p>
      <h2 className="mt-2 text-2xl font-bold">{value}</h2>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProgressTab
// ---------------------------------------------------------------------------

export default function ProgressTab({ download }: Props) {
  const isFailed = download.status === 'failed'
  const elapsed  = (Date.now() - download.addedAt) / 1000
  const avgSpeed = !isFailed && elapsed > 0 && download.downloaded > 0 ? download.downloaded / elapsed : 0
  const remaining = Math.max(0, download.totalSize - download.downloaded)

  return (
    <div className="space-y-5">
      {/* Progress bar */}
      <div>
        <div className="mb-2 text-sm">Download Progress</div>
        <div className="relative h-6 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
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
          <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
            {formatProgress(download.progress)}
          </span>
        </div>
      </div>

      {/* Size display */}
      <div className="rounded-xl bg-[#1A2232] px-4 py-3">
        <SizeDisplay
          downloaded={download.downloaded}
          remaining={remaining}
          total={download.totalSize}
        />
      </div>

      {/* Speed / ETA */}
      <div className="grid grid-cols-3 gap-5">
        <Card title="Current Speed" value={isFailed ? '0 B/s' : formatSpeed(download.speed)} />
        <Card title="Average Speed" value={isFailed ? '0 B/s' : formatSpeed(avgSpeed)} />
        <Card title="ETA"           value={formatEta(download.eta, download.status)} />
      </div>
    </div>
  )
}
