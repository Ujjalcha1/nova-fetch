import type { DownloadFormat } from '../types/download-metadata'

function getHeight(resolution: string | undefined): number {
  if (!resolution) return 0
  const cross = resolution.match(/(\d+)x(\d+)/)
  if (cross) return parseInt(cross[2], 10)
  const p = resolution.match(/(\d+)p/i)
  if (p) return parseInt(p[1], 10)
  return 0
}

function isDownloadable(f: DownloadFormat): boolean {
  if (f.ext === 'mhtml') return false
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg'].includes(f.ext)) return false
  if (f.ext === 'json') return false
  if (!f.videoCodec && !f.audioCodec) return false
  if ((!f.videoCodec || f.videoCodec === 'none') && (!f.audioCodec || f.audioCodec === 'none')) return false
  return true
}

function fileSize(f: DownloadFormat): number {
  return f.filesize ?? f.filesize_approx ?? 0
}

export function selectBestFormat(formats: DownloadFormat[]): string {
  if (formats.length === 0) return ''

  const downloadable = formats.filter(isDownloadable)
  if (downloadable.length === 0) return formats[0].id

  const byQuality = (a: DownloadFormat, b: DownloadFormat) => {
    // 1. Higher resolution first
    const h = getHeight(b.resolution) - getHeight(a.resolution)
    if (h !== 0) return h
    // 2. Prefer MP4 over WebM
    const extRank = (ext: string) => ext === 'mp4' ? 0 : ext === 'webm' ? 1 : 2
    const er = extRank(a.ext) - extRank(b.ext)
    if (er !== 0) return er
    // 3. Larger filesize (higher bitrate)
    return fileSize(b) - fileSize(a)
  }

  return [...downloadable].sort(byQuality)[0].id
}
