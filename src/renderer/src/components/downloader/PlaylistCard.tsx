import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, ListVideo, User, X } from 'lucide-react'

import type { PlaylistInfo } from '../../../../shared/types/playlist'
import PlaylistVideoItem from './PlaylistVideoItem'
import { useVideoStore } from '../../store/videoStore'
import { usePlaylistDownloadStore } from '../../store/playlistDownloadStore'
import { useQueueStore } from '../../store/queueStore'

import DownloadPlaylistOptions from './DownloadPlaylistOptions'
import PlaylistProgress from './PlaylistProgress'

interface Props {
  playlist: PlaylistInfo
}

export default function PlaylistCard({ playlist }: Props) {
  const [expanded, setExpanded] = useState(false)

  const removePlaylist = useVideoStore((state) => state.removePlaylist)
  const removePlaylistState = usePlaylistDownloadStore((state) => state.remove)
  const removeQueuePlaylist = useQueueStore((state) => state.removePlaylist)
  const progress = usePlaylistDownloadStore((state) => state.downloads[playlist.id])
  const queue = useQueueStore((state) => state.queue)
  const active = progress?.status === 'downloading' || progress?.status === 'paused'

  const queueById = useMemo(() => {
    const map = new Map(queue.filter((item) => item.playlistId === playlist.id).map((item) => [item.id, item]))
    return map
  }, [queue, playlist.id])

  function handleRemove() {
    removeQueuePlaylist(playlist.id)
    removePlaylistState(playlist.id)
    removePlaylist(playlist.id)
  }

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/8 bg-[#111827] p-8 shadow-[0_20px_80px_rgba(0,0,0,0.28)] transition-all duration-300 hover:border-white/12 hover:shadow-[0_24px_80px_rgba(124,58,237,0.10)]">
      <button
        disabled={active}
        onClick={handleRemove}
        className="absolute right-6 top-6 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#0F172A] text-slate-400 transition hover:border-red-500/60 hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <X size={18} />
      </button>

      <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#09090B] shadow-inner">
          {playlist.thumbnail ? (
            <img src={playlist.thumbnail} alt={playlist.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex aspect-video items-center justify-center bg-[#09090B] text-slate-600">
              <ListVideo size={40} />
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Playlist</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  {playlist.videoCount} items
                </span>
              </div>

              <h2 className="max-w-3xl text-2xl font-semibold leading-tight text-white md:text-[28px]">
                {playlist.title}
              </h2>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-400">
                <div className="flex items-center gap-2">
                  <User size={16} className="shrink-0" />
                  <span className="truncate">{playlist.uploader}</span>
                </div>

                <div className="flex items-center gap-2">
                  <ListVideo size={16} className="shrink-0" />
                  <span>{playlist.videoCount} videos</span>
                </div>
              </div>
            </div>

            {progress && (
              <div className="inline-flex items-center self-start rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-200">
                {progress.completed} / {progress.total}
              </div>
            )}
          </div>

          <div className="mt-8 space-y-6 border-t border-white/8 pt-6">
            <div className="space-y-4">
              {progress ? <PlaylistProgress playlistId={playlist.id} /> : <DownloadPlaylistOptions playlist={playlist} />}
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-white/8 pt-6">
              <button
                onClick={() => setExpanded((prev) => !prev)}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/8 hover:text-white"
              >
                {expanded ? (
                  <>
                    <ChevronUp size={18} />
                    Hide Videos
                  </>
                ) : (
                  <>
                    <ChevronDown size={18} />
                    Show Videos
                  </>
                )}
              </button>

              <span className="text-sm text-slate-500">
                {expanded ? 'Scroll to inspect individual items' : 'Inspect the playlist before downloading'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-8 border-t border-white/8 pt-6">
          <div className="max-h-80 space-y-3 overflow-y-auto pr-3" style={{ scrollbarGutter: 'stable' }}>
            {playlist.videos.map((video, index) => (
              <PlaylistVideoItem key={video.id} video={video} index={index} item={queueById.get(video.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
