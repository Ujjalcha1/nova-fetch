// @ts-nocheck
import ytdlp from 'yt-dlp-exec'
import { getVideoFormats } from './format'

export async function analyzeVideo(url: string) {
  try {
    const info = await ytdlp(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCheckCertificates: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true
    })

    return {
      success: true,
      data: {
        id: info.id,
        title: info.title,
        thumbnail: info.thumbnail,
        duration: info.duration,
        uploader: info.uploader,
        viewCount: info.view_count,
        webpageUrl: info.webpage_url,
        formats: getVideoFormats(info.formats)
      }
    }
  } catch (error) {
    console.error(error)

    return {
      success: false,
      message: 'Unable to analyze video.'
    }
  }
}
