import { Clock3, Eye, PlayCircle, X } from 'lucide-react'

import type { VideoInfo } from '../../../../shared/types/video'
import DownloadOptions from './DownloadOptions'
import { useVideoStore } from '@renderer/store/videoStore'

interface Props {
  video: VideoInfo
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatViews(views: number) {
  return new Intl.NumberFormat().format(views)
}

export default function VideoCard({ video }: Props) {
  const removeVideo = useVideoStore((s) => s.removeVideo)

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#1E293B] bg-[#111827] p-6 shadow-2xl transition-all duration-300 hover:border-[#7C3AED]/40 hover:shadow-[#7C3AED]/10">
      {/* Remove */}
      <button
        onClick={() => removeVideo(video.id)}
        className="cursor-pointer absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-[#334155] bg-[#0F172A] text-[#94A3B8] transition-all hover:border-[#EF4444] hover:bg-[#EF4444]/10 hover:text-[#EF4444]"
      >
        <X size={18} />
      </button>

      <div className="grid grid-cols-[220px_1fr] gap-6">
        {/* Thumbnail */}
        <div className="relative overflow-hidden rounded-2xl bg-[#09090B]">
          <img
            src={video.thumbnail}
            alt={video.title}
            className="aspect-video h-full w-full object-contain"
          />

          <div className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2 py-1 text-xs font-semibold text-white backdrop-blur">
            {formatDuration(video.duration)}
          </div>
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-col">
          <h2 className="line-clamp-2 pr-12 text-2xl font-bold leading-tight text-white">
            {video.title}
          </h2>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-[#94A3B8]">
            <div className="flex items-center gap-2">{video.uploader}</div>

            <div className="flex items-center gap-2">
              <Clock3 size={16} />
              {formatDuration(video.duration)}
            </div>

            <div className="flex items-center gap-2">
              <Eye size={16} />
              {formatViews(video.viewCount)}
            </div>

            <div className="flex items-center gap-2">
              <PlayCircle size={16} />
              Media Video
            </div>
          </div>

          <div className="mt-6">
            <DownloadOptions video={video} />
          </div>
        </div>
      </div>
    </div>
  )
}
