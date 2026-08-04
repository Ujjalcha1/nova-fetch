// @ts-nocheck
import { useDownloadStore } from '../../store/downloadStore'

export default function DownloadProgress() {
  const { progress } = useDownloadStore()

  if (progress.status === 'idle') {
    return null
  }

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-[#11182A] p-5">
      {/* Header */}

      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-300">Download Progress</span>

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            progress.status === 'completed'
              ? 'bg-green-500/20 text-green-400'
              : progress.status === 'error'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-cyan-500/20 text-cyan-400'
          }`}
        >
          {progress.status.toUpperCase()}
        </span>
      </div>

      {/* Progress */}

      <div className="mb-2 flex justify-between text-sm">
        <span>{progress.percent.toFixed(1)}%</span>

        <span>{progress.speed || '--'}</span>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-gray-700">
        <div
          className="h-full rounded-full bg-linear-to-r from-cyan-500 to-violet-600 transition-all duration-300"
          style={{
            width: `${progress.percent}%`
          }}
        />
      </div>

      <div className="mt-3 flex justify-between text-sm text-gray-400">
        <span>ETA: {progress.eta || '--:--'}</span>

        <span>
          {progress.status === 'completed'
            ? '✅ Finished'
            : progress.status === 'error'
              ? '❌ Failed'
              : '⬇ Downloading'}
        </span>
      </div>
    </div>
  )
}

