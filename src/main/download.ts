// @ts-nocheck
import ytdlp from 'yt-dlp-exec'
import path from 'node:path'

interface DownloadPayload {
  url: string
  folder: string
  quality: string
  format: 'mp4' | 'mp3'
}

export async function downloadVideo(payload: DownloadPayload) {
  const output = path.join(payload.folder, '%(title)s.%(ext)s')

  try {
    if (payload.format === 'mp3') {
      await ytdlp(payload.url, {
        output,
        extractAudio: true,
        audioFormat: 'mp3'
      })
    } else {
      await ytdlp(payload.url, {
        output,
        format: `${payload.quality}+bestaudio`,
        mergeOutputFormat: 'mp4'
      })
    }

    return {
      success: true
    }
  } catch (error) {
    console.error(error)

    return {
      success: false,
      message: 'Download failed.'
    }
  }
}
