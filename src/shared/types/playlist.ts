import type { VideoFormat } from './video'
export interface PlaylistDownloadState {
  playlistId: string

  progress: number

  completed: number

  total: number

  speed: string

  eta: string

  status: 'idle' | 'downloading' | 'paused' | 'completed' | 'cancelled'
}

export interface PlaylistVideo {
  id: string
  url: string
  webpageUrl: string
  title: string
  thumbnail: string
  duration: number
  uploader: string
  viewCount: number
}

export interface PlaylistInfo {
  id: string
  title: string
  thumbnail: string
  uploader: string
  videoCount: number

  // Playlist-level common formats
  formats: VideoFormat[]

  videos: PlaylistVideo[]
}
