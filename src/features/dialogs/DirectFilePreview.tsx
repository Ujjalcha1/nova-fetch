import { useState } from 'react'
import { FileDown, Loader2, Download } from 'lucide-react'

import { electron } from '../../lib/electron'
import { formatBytes } from '../../lib/format'
import { useDownloadStore } from '../../store/download-store'
import FolderPicker from './FolderPicker'

type DirectFileInfo = {
  filename: string
  contentLength: number
  contentType: string
}

type Props = {
  url: string
  info: DirectFileInfo
  folder: string
  setFolder: (folder: string) => void
  onClose?: () => void
  onError?: (error: string) => void
}

export default function DirectFilePreview({
  url,
  info,
  folder,
  setFolder,
  onClose,
  onError,
}: Props) {
  const addDownload = useDownloadStore((state) => state.addDownload)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    if (!folder) {
      onError?.('Please select a save folder')
      return
    }

    setDownloading(true)

    try {
      const id = crypto.randomUUID()

      addDownload({
        id,
        title: info.filename,
        url,
        thumbnail: '',
        status: 'queued',
        progress: 0,
        speed: 0,
        eta: 0,
        downloaded: 0,
        totalSize: info.contentLength,
        priority: 'normal',
        retryCount: 0,
        maxRetries: 3,
        retryDelay: 30,
        retryAt: null,
        savePath: folder,
        addedAt: Date.now(),
        logs: [],
        files: [],
        connections: [],
      })

      await electron.start({
        id,
        url,
        outputPath: folder,
      })

      onClose?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start download'
      onError?.(message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
      {/* File info card */}
      <div className="flex items-start gap-5 rounded-xl bg-[#1A2232] p-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-violet-600/20">
          <FileDown size={26} className="text-violet-400" />
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">{info.filename}</h2>

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <span className="text-gray-400">
              Size{' '}
              <b className="ml-1 text-white">
                {info.contentLength > 0 ? formatBytes(info.contentLength) : 'Unknown'}
              </b>
            </span>

            <span className="text-gray-400">
              Type{' '}
              <b className="ml-1 text-white">
                {info.contentType || 'Unknown'}
              </b>
            </span>
          </div>
        </div>
      </div>

      {/* Folder picker */}
      <FolderPicker folder={folder} setFolder={setFolder} />

      {/* Download button */}
      <div className="flex justify-end">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 font-medium transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {downloading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Download size={18} />
              Start Download
            </>
          )}
        </button>
      </div>
    </div>
  )
}
