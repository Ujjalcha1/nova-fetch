import { Download, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import type { PlaylistInfo } from '../../../../shared/types/playlist'
import type { AppSettings } from '../../../../shared/types/settings'

import { usePlaylistDownloadStore } from '../../store/playlistDownloadStore'
import { useQueueStore } from '../../store/queueStore'

interface Props {
  playlist: PlaylistInfo
}

export default function DownloadPlaylistOptions({ playlist }: Props) {
  const addMany = useQueueStore((s) => s.addMany)
  const downloadState = usePlaylistDownloadStore((s) => s.downloads[playlist.id])
  const startPlaylist = usePlaylistDownloadStore((s) => s.start)

  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(false)

  const formats = playlist.formats ?? []
  const [formatId, setFormatId] = useState('')

  useEffect(() => {
    void window.api.settings.get().then(setSettings)
  }, [])

  useEffect(() => {
    if (formats.length) {
      setFormatId(formats[0].formatId)
    }
  }, [formats])

  const selectedFormat = useMemo(() => formats.find((f) => f.formatId === formatId), [formats, formatId])

  async function handleDownloadAll() {
    if (loading || !selectedFormat || !settings?.downloadFolder) {
      return
    }

    try {
      setLoading(true)

      startPlaylist(playlist.id, playlist.title, playlist.videoCount)
      const format: 'mp3' | 'mp4' = selectedFormat.ext === 'mp3' ? 'mp3' : 'mp4'
      const payloads = playlist.videos.map((video, index) => ({
        id: video.id,
        type: 'youtube' as const,
        title: video.title,
        url: video.url,
        folder: settings.downloadFolder,
        formatId: selectedFormat.formatId,
        format,
        playlistId: playlist.id,
        playlistTitle: playlist.title,
        playlistIndex: index + 1,
        playlistTotal: playlist.videoCount
      }))

      addMany(
        payloads.map((payload, index) => ({
          ...payload,
          thumbnail: playlist.videos[index].thumbnail,
          progress: 0,
          speed: '-',
          eta: '-',
          status: 'waiting' as const
        }))
      )

      await window.api.download.startPlaylist(payloads)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5 rounded-2xl border border-white/8 bg-white/4 p-5">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Download Options
        </p>
        <p className="text-sm text-slate-400">Pick a shared quality for the entire playlist.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Format
          </label>

          <select
            value={formatId}
            disabled={loading || !!downloadState}
            onChange={(e) => setFormatId(e.target.value)}
            className="h-12 w-full rounded-xl border border-white/10 bg-[#0B1220] px-4 text-sm text-white outline-none transition focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {formats.map((format) => (
              <option key={format.formatId} value={format.formatId}>
                {format.quality} • {format.ext.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleDownloadAll}
          disabled={loading || !!downloadState || !selectedFormat || !settings?.downloadFolder}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-violet-600 to-blue-600 px-4 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(124,58,237,0.20)] transition hover:shadow-[0_14px_36px_rgba(124,58,237,0.32)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Preparing...
            </>
          ) : (
            <>
              <Download size={18} />
              Download All ({playlist.videoCount})
            </>
          )}
        </button>
      </div>
    </div>
  )
}