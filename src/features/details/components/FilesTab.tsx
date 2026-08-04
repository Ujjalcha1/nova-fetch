import { formatBytes } from '../../../lib/format'
import type { DownloadItem } from '../../../types/download'

type Props = {
  download: DownloadItem
}

export default function FilesTab({ download }: Props) {
  if ((download.files?.length ?? 0) === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400">
        No files yet. Complete the download to see output files.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {download.files?.map((file) => {
        const ext = file.name.includes('.') ? file.name.split('.').pop()?.toUpperCase() : ''

        return (
          <div key={file.id} className="rounded-lg bg-[#1A2232] p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">{file.name}</span>

              {file.size > 0 && (
                <span className="text-xs text-gray-400">{formatBytes(file.size)}</span>
              )}
            </div>

            {ext && <span className="text-xs text-gray-500">{ext}</span>}
          </div>
        )
      })}
    </div>
  )
}
