import { memo } from 'react'
import { CheckCircle2, Clock3, Loader2, PauseCircle, XCircle } from 'lucide-react'

import type { PlaylistVideo } from '../../../../shared/types/playlist'
import type { QueueItem } from '../../types/queue'

interface Props {
  video: PlaylistVideo
  index: number
  item?: QueueItem
}

function PlaylistVideoItem({ video, index, item }: Props) {
  const progress = item?.progress ?? 0
  const status = item?.status ?? 'waiting'

  function renderStatus() {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <CheckCircle2 size={14} />
            Completed
          </span>
        )

      case 'downloading':
        return (
          <span className="inline-flex items-center gap-2 rounded-full bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300">
            <Loader2 size={14} className="animate-spin" />
            Downloading
          </span>
        )

      case 'paused':
        return (
          <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
            <PauseCircle size={14} />
            Paused
          </span>
        )

      case 'error':
        return (
          <span className="inline-flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-300">
            <XCircle size={14} />
            Error
          </span>
        )

      default:
        return (
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-500/10 px-3 py-1 text-xs font-medium text-slate-300">
            <Clock3 size={14} />
            Waiting
          </span>
        )
    }
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-[#0F172A] p-5 transition-all duration-200 hover:border-violet-500/30 hover:bg-[#111C30]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-slate-300">
            {index + 1}
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <p className="truncate text-sm font-medium leading-6 text-white">{video.title}</p>

            <div className="space-y-2 rounded-2xl border border-white/8 bg-black/10 p-3">
              <div className="h-2 overflow-hidden rounded-full bg-slate-800/80">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                {renderStatus()}
                <span className="font-medium text-slate-300">{progress.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>

        {(item?.speed || item?.eta) && (
          <div className="grid min-w-[180px] gap-2 sm:text-right">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Speed</div>
            <div className="text-sm font-medium text-white">{item?.speed ?? '-'}</div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">ETA</div>
            <div className="text-sm font-medium text-white">{item?.eta ?? '-'}</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(PlaylistVideoItem)
