import { Download } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { AppSettings } from '../../../../shared/types/settings'
import type { VideoInfo } from '../../../../shared/types/video'
import { useQueueStore } from '../../store/queueStore'
import QueueItemCard from './QueueItemCard'

interface Props {
  video: VideoInfo
}

function formatFileSize(size: number) {
  if (!size) return '-'

  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="
        inline-flex
        h-8
        items-center
        rounded-full
        border
        border-slate-700
        bg-slate-800/70
        text-xs
        font-semibold
        text-slate-100
        backdrop-blur-sm
      "
      style={{ paddingLeft: 4, paddingRight: 4 }}
    >
      {children}
    </span>
  )
}

export default function DownloadOptions({ video }: Props) {
  const queue = useQueueStore((s) => s.queue)
  const add = useQueueStore((s) => s.add)

  const item = queue.find((q) => q.id === video.id)
  const formats = video.formats ?? []
  const [formatId, setFormatId] = useState(formats.length ? formats[0].formatId : '')
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    window.api.settings.get().then(setSettings)
  }, [])

  const selectedFormat = useMemo(() => formats.find((f) => f.formatId === formatId), [formats, formatId])
  const selectedFileSize = selectedFormat?.filesize ?? 0

  async function handleDownload() {
    if (!selectedFormat) return

    setLoading(true)

    try {
      add({
        id: video.id,
        type: 'youtube',
        title: video.title,
        url: video.url,
        thumbnail: video.thumbnail,
        folder: settings?.downloadFolder ?? '',
        formatId: selectedFormat.formatId,
        format: selectedFormat.ext === 'mp3' ? 'mp3' : 'mp4',
        progress: 0,
        speed: '-',
        eta: '-',
        status: 'waiting'
      })

      await window.api.download.start({
        id: video.id,
        url: video.url,
        folder: settings?.downloadFolder ?? '',
        formatId: selectedFormat.formatId,
        format: selectedFormat.ext === 'mp3' ? 'mp3' : 'mp4',
        type: 'youtube',
        title: video.title
      })
    } finally {
      setLoading(false)
    }
  }

  if (item) {
    return <QueueItemCard item={item} />
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-400">
          Video Quality
        </label>

        <select
          value={formatId}
          onChange={(e) => setFormatId(e.target.value)}
          className="
            h-12
            w-full
            rounded-xl
            border
            border-slate-700
            bg-slate-950/60
            px-4
            text-sm
            font-medium
            text-white
            transition-all
            outline-none
            focus:border-violet-500
            focus:ring-2
            focus:ring-violet-500/20
          "
        >
          {formats.map((format) => (
            <option key={`${format.formatId}-${format.quality}`} value={format.formatId}>
              {format.quality}
              {format.ext && ` • ${format.ext.toUpperCase()}`}
              {format.filesize ? ` • ${formatFileSize(format.filesize)}` : ''}
            </option>
          ))}
        </select>
      </div>

      {selectedFormat && (
        <div className="flex flex-wrap gap-2">
          <Chip>{selectedFormat.ext.toUpperCase()}</Chip>
          <Chip>{selectedFormat.quality}</Chip>
          <Chip>{selectedFormat.fps ? `${selectedFormat.fps} FPS` : 'Unknown FPS'}</Chip>
          <Chip>{selectedFormat.codec ?? 'Unknown Codec'}</Chip>
          {selectedFileSize > 0 && <Chip>{formatFileSize(selectedFileSize)}</Chip>}
        </div>
      )}

      <button
        onClick={handleDownload}
        disabled={loading || !settings?.downloadFolder}
        className="
          mt-1
          flex
          h-12
          w-full
          items-center
          justify-center
          gap-2
          rounded-xl
          bg-linear-to-r
          from-violet-600
          to-blue-600
          text-sm
          font-semibold
          text-white
          shadow-lg
          shadow-violet-600/20
          transition-all
          duration-200
          hover:scale-[1.01]
          hover:shadow-violet-600/40
          active:scale-[0.98]
          disabled:pointer-events-none
          disabled:opacity-50
          cursor-pointer
        "
      >
        <Download size={18} />

        {loading ? 'Starting Download...' : 'Download'}
      </button>
    </div>
  )
}