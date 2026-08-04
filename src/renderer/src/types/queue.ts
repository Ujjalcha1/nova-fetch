export type QueueStatus = 'waiting' | 'downloading' | 'completed' | 'error' | 'cancelled' | 'paused'
export type QueueType = 'youtube' | 'file'

export interface QueueItem {
  id: string
  type: QueueType
  title: string
  url: string
  thumbnail?: string
  folder: string
  formatId?: string
  format?: 'mp4' | 'mp3'
  filename?: string
  filePath?: string
  playlistId?: string
  playlistTitle?: string
  playlistIndex?: number
  playlistTotal?: number
  progress: number
  speed: string
  eta: string
  status: QueueStatus
}
