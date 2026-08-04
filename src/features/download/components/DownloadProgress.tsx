type Props = {
  progress: number
  status?: string
}

export default function DownloadProgress({ progress, status = 'downloading' }: Props) {
  const isActive = status === 'downloading'

  return (
    <div className="mt-3">
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${
            isActive
              ? 'bg-gradient-to-r from-violet-600 to-violet-400'
              : status === 'paused'
                ? 'bg-gradient-to-r from-gray-600 to-gray-400'
                : status === 'failed'
                  ? 'bg-gradient-to-r from-red-600 to-red-400'
                  : status === 'completed'
                    ? 'progress-celebrate bg-gradient-to-r from-green-600 to-green-400'
                    : 'bg-gradient-to-r from-violet-600 to-violet-400'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
