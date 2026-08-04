import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { useDownloadStore } from '../../store/download-store'
import { electron } from '../../lib/electron'
import { parseYoutubeUrl } from '../../lib/url-parser'
import { formatErrorMessage } from '../../lib/format'
import type { DownloadMetadata } from '../../types/download-metadata'

type Props = {
  metadata: DownloadMetadata

  folder: string

  selectedFormatId: string

  onDownloadStarted?: () => void

  onError?: (error: string) => void
}

export default function DownloadButton({ metadata, folder, selectedFormatId, onDownloadStarted, onError }: Props) {
  const addDownload = useDownloadStore((state) => state.addDownload)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    if (!selectedFormatId) {
      onError?.('Please select a format')
      return
    }

    if (!folder) {
      onError?.('Please select a save folder')
      return
    }

    setDownloading(true)
    onError?.(null as unknown as string)

    try {
      const id = crypto.randomUUID()
      const parsed = parseYoutubeUrl(metadata.webpageUrl)

      if (!parsed.supported) {
        onError?.('Unsupported YouTube URL')
        return
      }

      const format = metadata.formats.find(f => f.id === selectedFormatId)
      const initialSize = format?.filesize ?? format?.filesize_approx ?? metadata.filesize ?? metadata.filesize_approx ?? 0

      addDownload({
        id,
        title: metadata.title,
        url: parsed.url,
        thumbnail: metadata.thumbnail ?? '',
        status: 'queued',
        progress: 0,
        speed: 0,
        eta: 0,
        downloaded: 0,
        totalSize: initialSize,
        priority: 'normal',
        retryCount: 0,
        maxRetries: 3,
        retryDelay: 30,
        retryAt: null,
        savePath: folder,
        addedAt: Date.now(),
        logs: [],
        files: [],
        connections: []
      })

      console.trace('[IPC RESUME CALL]', {
        function: 'DownloadButton.handleDownload',
        id,
        ids: [id],
        status: 'clicked-start',
        paused: false,
        stack: new Error().stack,
      })

      await electron.start({
        id,
        url: parsed.url,
        outputPath: folder,
        format: selectedFormatId,
        noPlaylist: parsed.playlistId ? true : undefined
      })

      onDownloadStarted?.()
    } catch (err) {
      onError?.(formatErrorMessage(err) || 'Failed to start download')
    } finally {
      setDownloading(false)
    }
  }

  return (
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
  )
}
