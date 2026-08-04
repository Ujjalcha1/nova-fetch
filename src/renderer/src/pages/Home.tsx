// @ts-nocheck
import VideoPreview from '@renderer/components/preview/VideoPreview'
import { useEffect, useState } from 'react'
import Hero from '../components/hero/Hero'
import UrlInput from '../components/input/UrlInput'
import type { VideoInfo } from '../../../shared/types/video'
import { registerDownloadEvents } from '@renderer/ipc/events'

export default function Home() {
  const [video, setVideo] = useState<VideoInfo | null>(null)

  useEffect(() => {
    const cleanup = registerDownloadEvents()

    return cleanup
  }, [])

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070B1A]">
      {/* Glow */}

      <div className="absolute left-[-150px] top-[-120px] h-96 w-96 rounded-full bg-cyan-500/25 blur-[120px]" />

      <div className="absolute bottom-[-120px] right-[-100px] h-[450px] w-[450px] rounded-full bg-pink-500/20 blur-[160px]" />

      <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-700/20 blur-[180px]" />

      <section className="relative w-full max-w-5xl rounded-[34px] border border-white/10 bg-white/5 p-14 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,.45)]">
        <Hero />

        <div className="mt-10">
          <UrlInput setVideo={setVideo} />
          {video && <VideoPreview video={video} />}
        </div>
      </section>
    </main>
  )
}
