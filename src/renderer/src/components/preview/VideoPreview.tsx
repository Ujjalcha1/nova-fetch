// @ts-nocheck
import { useState } from 'react'
import type { VideoInfo } from '../../../../shared/types/video'

import { FaClock, FaEye, FaFolderOpen, FaUserCircle } from 'react-icons/fa'

import DownloadProgress from '../progress/DownloadProgress'
import { useDownloadStore } from '../../store/downloadStore'

interface Props {
  video: VideoInfo
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60

  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatViews(views: number) {
  return new Intl.NumberFormat().format(views)
}

export default function VideoPreview({ video }: Props) {
  const { progress } = useDownloadStore()

  const [quality, setQuality] = useState(video.formats[0]?.id ?? '')
  const [format, setFormat] = useState<'mp4' | 'mp3'>('mp4')
  const [folder, setFolder] = useState('')

  async function browseFolder() {
    const selectedFolder = await window.api.dialog.selectFolder()

    if (selectedFolder) {
      setFolder(selectedFolder)
    }
  }

  async function download() {
    if (!folder) {
      alert('Please choose a download folder.')
      return
    }

    try {
      await window.api.youtube.download({
        url: video.webpageUrl,
        folder,
        quality,
        format
      })
    } catch (error) {
      console.error(error)
      alert('Download failed.')
    }
  }

  async function cancelDownload() {
    await window.api.youtube.cancel()
  }

  async function openFolder() {
    if (!folder) return

    await window.api.system.openFolder(folder)
  }

  return (
    <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
      {/* Header */}

      <div className="flex gap-6">
        <img
          src={video.thumbnail}
          alt={video.title}
          className="h-44 w-72 shrink-0 rounded-2xl object-cover"
        />

        <div className="flex flex-1 flex-col justify-between">
          <div>
            <h2 className="text-3xl font-bold">{video.title}</h2>

            <div className="mt-5 flex flex-wrap gap-6 text-gray-300">
              <div className="flex items-center gap-2">
                <FaUserCircle />
                {video.uploader}
              </div>

              <div className="flex items-center gap-2">
                <FaClock />
                {formatDuration(video.duration)}
              </div>

              <div className="flex items-center gap-2">
                <FaEye />
                {formatViews(video.viewCount)} views
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Download Options */}

      <div className="mt-8 border-t border-white/10 pt-6">
        <label className="mb-2 block text-sm text-gray-300">Video Quality</label>

        <select
          value={quality}
          onChange={(e) => setQuality(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-[#11182A] px-4 py-3"
        >
          {video.formats.map((item) => (
            <option key={item.id} value={item.id}>
              {item.quality}
            </option>
          ))}
        </select>

        <div className="mt-6">
          <label className="mb-2 block text-sm text-gray-300">Output Format</label>

          <div className="flex gap-8">
            <label className="flex items-center gap-2">
              <input type="radio" checked={format === 'mp4'} onChange={() => setFormat('mp4')} />
              MP4
            </label>

            <label className="flex items-center gap-2">
              <input type="radio" checked={format === 'mp3'} onChange={() => setFormat('mp3')} />
              MP3
            </label>
          </div>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-sm text-gray-300">Download Folder</label>

          <div className="flex gap-3">
            <input
              readOnly
              value={folder}
              placeholder="Choose download folder..."
              className="flex-1 rounded-xl border border-white/10 bg-[#11182A] px-4 py-3"
            />

            <button
              onClick={browseFolder}
              className="flex items-center gap-2 rounded-xl bg-cyan-600 px-5 transition hover:bg-cyan-500"
            >
              <FaFolderOpen />
              Browse
            </button>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={download}
            disabled={progress.status === 'downloading'}
            className="flex-1 rounded-2xl bg-linear-to-r from-cyan-500 to-violet-600 py-4 text-lg font-bold transition hover:scale-[1.02] disabled:opacity-60"
          >
            {progress.status === 'downloading' ? 'Downloading...' : 'Download Video'}
          </button>

          {progress.status === 'downloading' && (
            <button
              onClick={cancelDownload}
              className="rounded-2xl bg-red-600 px-6 font-semibold transition hover:bg-red-500"
            >
              Cancel
            </button>
          )}
        </div>

        <DownloadProgress />

        {progress.status === 'completed' && (
          <button
            onClick={openFolder}
            className="mt-4 w-full rounded-xl bg-green-600 py-3 font-semibold transition hover:bg-green-500"
          >
            📂 Open Download Folder
          </button>
        )}
      </div>
    </div>
  )
}

