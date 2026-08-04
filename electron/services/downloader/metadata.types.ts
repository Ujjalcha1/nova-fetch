export interface DownloadFormat {
  id: string

  ext: string

  resolution: string

  videoCodec?: string

  audioCodec?: string

  fps?: number

  filesize?: number

  filesize_approx?: number
}

export interface DownloadMetadata {
  id: string

  title: string

  webpageUrl: string

  uploader?: string

  duration?: number

  thumbnail?: string

  description?: string

  isPlaylist: boolean

  playlistCount?: number

  filesize?: number

  filesize_approx?: number

  formats: DownloadFormat[]
}

export interface PlaylistEntry {
  id?: string
  title: string
  url?: string
  thumbnail?: string
  duration?: number
  status: 'available' | 'unavailable'
  reason?: string
}

export interface PlaylistMetadata {
  id: string
  title: string
  url: string
  uploader?: string
  thumbnail?: string
  videoCount: number
  availableCount: number
  unavailableCount: number
  entries: PlaylistEntry[]
}
