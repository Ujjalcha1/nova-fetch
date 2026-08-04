import { useState } from 'react'
import { FiSearch } from 'react-icons/fi'
import type { VideoInfo } from '../../../../shared/types/video'

interface UrlInputProps {
  setVideo: React.Dispatch<React.SetStateAction<VideoInfo | null>>
}

export default function UrlInput({ setVideo }: UrlInputProps) {
  const [url, setUrl] = useState('')

  async function analyze() {
    if (!url.trim()) return

    const result = await window.api.youtube.analyze(url)

    if (!result.success || !result.data) {
      alert(result.message ?? 'Unable to analyze video.')
      return
    }

    setVideo(result.data)
  }

  return (
    <div className="flex gap-4">
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste YouTube URL..."
        className="h-16 flex-1 rounded-2xl border border-white/10 bg-[#10182D] px-6 text-lg outline-none"
      />

      <button
        onClick={analyze}
        className="flex h-16 items-center gap-3 rounded-2xl bg-linear-to-r from-cyan-500 to-violet-600 px-8"
      >
        <FiSearch />
        Analyze
      </button>
    </div>
  )
}
