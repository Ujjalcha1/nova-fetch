import { spawn } from 'node:child_process'
import type { AnalyzeVideoResponse, VideoFormat } from '../../shared/types/video'
import { getYtDlpPath } from '../utils/binaries'
import { normalizeYoutubeUrl } from '../utils/normalizeYoutubeUrl'

const PLAYLIST_PREFIXES = ['PL', 'UU', 'OLAK', 'FL', 'WL', 'LL']

function getFormats(formats: any[] = []): VideoFormat[] {
  const videoMap = new Map<number, VideoFormat>()

  for (const format of formats) {
    if (format.vcodec !== 'none' && format.ext === 'mp4' && typeof format.height === 'number') {
      if (!videoMap.has(format.height)) {
        videoMap.set(format.height, {
          id: format.format_id,
          formatId: format.format_id,
          quality: `${format.height}p`,
          height: format.height,
          ext: 'mp4',
          filesize: format.filesize ?? format.filesize_approx ?? 0,
          fps: format.fps,
          codec: format.vcodec
        })
      }
    }
  }

  const videoFormats = [...videoMap.values()].sort((a, b) => b.height - a.height)

  const audioFormats: VideoFormat[] = [
    {
      id: 'mp3-320',
      formatId: 'mp3-320',
      quality: 'MP3 320 kbps',
      height: 0,
      ext: 'mp3',
      filesize: 0,
      codec: 'mp3'
    },
    {
      id: 'mp3-192',
      formatId: 'mp3-192',
      quality: 'MP3 192 kbps',
      height: 0,
      ext: 'mp3',
      filesize: 0,
      codec: 'mp3'
    },
    {
      id: 'mp3-128',
      formatId: 'mp3-128',
      quality: 'MP3 128 kbps',
      height: 0,
      ext: 'mp3',
      filesize: 0,
      codec: 'mp3'
    }
  ]

  return [...videoFormats, ...audioFormats]
}

function isPlaylist(info: any): boolean {
  return Array.isArray(info?.entries)
}

function isPlaylistUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const list = parsed.searchParams.get('list')

    if (parsed.pathname === '/playlist') {
      return true
    }

    if (!list) {
      return false
    }

    return PLAYLIST_PREFIXES.some((prefix) => list.startsWith(prefix))
  } catch {
    return false
  }
}

async function runYtDlp(args: string[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const child = spawn(getYtDlpPath(), args, {
      windowsHide: true
    })

    let stdout = ''
    let stderr = ''

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')

    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })

    child.once('error', reject)

    child.once('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`))
        return
      }

      try {
        resolve(JSON.parse(stdout))
      } catch (err) {
        reject(err)
      }
    })
  })
}

async function analyzeSingleVideo(url: string): Promise<AnalyzeVideoResponse> {
  try {
    const info = await runYtDlp(['--dump-single-json', '--no-warnings', url])

    if (!info?.id) {
      return {
        success: false,
        message: 'Invalid video.'
      }
    }

    return {
      success: true,
      data: {
        id: info.id,
        url,
        title: info.title,
        thumbnail: info.thumbnail,
        duration: info.duration,
        uploader: info.uploader,
        viewCount: info.view_count,
        webpageUrl: info.webpage_url,
        formats: getFormats(info.formats)
      }
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to analyze video.'
    }
  }
}

async function analyzePlaylist(url: string): Promise<AnalyzeVideoResponse> {
  try {
    const info = await runYtDlp([
      '--dump-single-json',
      '--flat-playlist',
      '--ignore-errors',
      '--no-warnings',
      url
    ])

    if (!isPlaylist(info)) {
      return {
        success: false,
        message: 'Invalid playlist.'
      }
    }

    const videos =
      info.entries
        ?.filter((entry: any) => entry?.id)
        .map((entry: any) => ({
          id: entry.id,
          url: entry.webpage_url ?? `https://www.youtube.com/watch?v=${entry.id}`,
          webpageUrl: entry.webpage_url ?? `https://www.youtube.com/watch?v=${entry.id}`,
          title: entry.title ?? 'Unknown',
          thumbnail: entry.thumbnail ?? '',
          duration: entry.duration ?? 0,
          uploader: entry.uploader ?? info.uploader ?? '',
          viewCount: entry.view_count ?? 0
        })) ?? []

    let commonFormats: VideoFormat[] = []
    const representativeVideo = videos[0]

    if (representativeVideo) {
      const result = await analyzeSingleVideo(representativeVideo.webpageUrl)
      if (result.success && 'formats' in result.data && result.data.formats.length > 0) {
        commonFormats = result.data.formats
      }
    }

    return {
      success: true,
      data: {
        id: info.id,
        title: info.title,
        thumbnail: info.thumbnail ?? videos.find((v) => v.thumbnail)?.thumbnail ?? null,
        uploader: info.uploader ?? videos[0]?.uploader ?? '',
        videoCount: info.playlist_count ?? videos.length,
        formats: commonFormats,
        videos
      }
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unable to analyze playlist.'
    }
  }
}

export async function analyzeYoutube(url: string): Promise<AnalyzeVideoResponse> {
  const normalizedUrl = normalizeYoutubeUrl(url)

  if (isPlaylistUrl(normalizedUrl)) {
    return analyzePlaylist(normalizedUrl)
  }

  return analyzeSingleVideo(normalizedUrl)
}
