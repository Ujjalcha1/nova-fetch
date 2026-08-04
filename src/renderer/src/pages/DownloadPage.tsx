import UrlInput from '../components/downloader/UrlInput'
import VideoCard from '../components/downloader/VideoCard'
import FileCard from '../components/downloader/FileCard'
import PlaylistCard from '../components/downloader/PlaylistCard'
import type { PlaylistInfo } from '../../../shared/types/playlist'

import type { FileInfo } from '../../../shared/types/file'
import type { VideoInfo } from '../../../shared/types/video'

import { useCallback } from 'react'
import { useVideoStore } from '../store/videoStore'

export default function DownloadPage() {
  const videos = useVideoStore((s) => s.videos)
  const playlists = useVideoStore((s) => s.playlists)
  const files = useVideoStore((s) => s.files)

  const addVideo = useVideoStore((s) => s.addVideo)
  const addPlaylist = useVideoStore((s) => s.addPlaylist)
  const addFile = useVideoStore((s) => s.addFile)

  const onAnalyze = useCallback(
    async (urls: any) => {
      const results = await Promise.all(urls.map((url) => window.api.download.analyze(url)))

      for (const response of results) {
        if (!response.success) {
          throw new Error(response.error || 'Analyze failed')
        }

        switch (response.type) {
          case 'youtube': {
            const data = response.data as VideoInfo | PlaylistInfo

            if ('videos' in data) {
              addPlaylist(data)
            } else {
              addVideo(data)
            }

            break
          }

          case 'file': {
            addFile(response.data as FileInfo)
            break
          }

          default:
            throw new Error(`Unsupported response type: ${response.type}`)
        }
      }

      return true
    },
    [addFile, addPlaylist, addVideo]
  )

  const isEmpty = videos.length === 0 && playlists.length === 0 && files.length === 0

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#09090B] text-white">
      <header className="page-header shrink-0 border-b border-[#1E293B] bg-[#111827]/80 backdrop-blur-xl">
        <div className="absolute inset-0 bg-linear-to-r from-[#7C3AED]/10 to-[#2563EB]/10" />

        <div className="relative">
          <h1 className="bg-linear-to-br from-white to-slate-400 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
            NovaFetch
          </h1>

          <p className="mt-2 text-sm text-slate-400">Download Anything</p>
        </div>
      </header>

      <main className="hide-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="container" style={{ paddingTop: 6, paddingBottom: 6 }}>
          <div
            className="sticky top-0 z-20 bg-[#09090B]/95 backdrop-blur-xl"
            style={{ marginBottom: 6, paddingBottom: 4 }}
          >
            <UrlInput onAnalyze={onAnalyze} />
          </div>

          {isEmpty ? (
            <div className="empty-state border border-dashed border-[#1E293B] bg-[#111827]/50 transition-colors hover:bg-[#111827]/80">
              <div className="icon-box-lg bg-[#1E293B]/50 shadow-inner" style={{ marginBottom: 6 }}>
                <svg
                  className="h-10 w-10 text-[#7C3AED]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>

              <h2 className="text-2xl font-semibold">Ready to Download</h2>

              <p className="mt-3 max-w-sm text-sm text-slate-400">
                Paste a media URL above and click Analyze.
              </p>
            </div>
          ) : (
            <div className="stack-lg">
              {playlists.map((playlist) => (
                <PlaylistCard key={playlist.id} playlist={playlist} />
              ))}
              {videos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}

              {files.map((file) => (
                <FileCard key={file.url} file={file} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
