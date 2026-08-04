// @ts-nocheck
export interface DownloadPayload {
  id: string
  url: string
  folder: string
  quality: string
  format: 'mp4' | 'mp3'
}

export async function startDownload(payload: DownloadPayload) {
  return window.api.download.start(payload)
}

export async function cancelDownload(id: string) {
  return window.api.download.cancel(id)
}

