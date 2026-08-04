import type { DownloadItem } from '../../../types/download'

type Props = {
  download: DownloadItem
}

export default function LogTab({ download }: Props) {
  if ((download.logs?.length ?? 0) === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400">
        No logs yet. Start a download to see activity here.
      </div>
    )
  }

  return (
    <div className="space-y-2 font-mono text-sm">
      {download.logs?.map((log) => (
        <div key={log.id} className="rounded-lg bg-[#1A2232] p-3">
          <span className="mr-2 text-gray-500">
            {new Date(log.timestamp).toLocaleTimeString()}
          </span>

          {log.message}
        </div>
      ))}
    </div>
  )
}
