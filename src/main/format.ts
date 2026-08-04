export interface VideoFormat {
  id: string
  quality: string
  ext: string
  width: number | null
  height: number | null
  fps: number | null
  filesize: number | null
}

export function getVideoFormats(formats: any[]): VideoFormat[] {
  const map = new Map<string, VideoFormat>()

  for (const f of formats) {
    if (f.vcodec === 'none') continue

    if (f.ext !== 'mp4') continue

    if (!f.height) continue
    const key = `${f.height}p`
    if (!map.has(key)) {
      map.set(key, {
        id: f.format_id,
        quality: `${f.height}p`,
        ext: f.ext,
        width: f.width,
        height: f.height,
        fps: f.fps,
        filesize: f.filesize
      })
    }
  }

  return [...map.values()].sort((a, b) => (b.height ?? 0) - (a.height ?? 0))
}
