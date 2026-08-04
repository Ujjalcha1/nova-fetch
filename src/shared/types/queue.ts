export type QueueStatus = 'waiting' | 'downloading' | 'completed' | 'cancelled' | 'error' | 'paused'

export type QueueType = 'youtube' | 'file'

export interface QueueItem {
  id: string

  type: QueueType

  title: string

  url: string

  thumbnail?: string

  folder: string

  progress: number

  speed: string

  eta: string

  status: QueueStatus

  playlistId?: string
  playlistTitle?: string
  playlistIndex?: number
  playlistTotal?: number

  formatId?: string
  format?: 'mp3' | 'mp4'
  filename?: string
  filePath?: string
}
