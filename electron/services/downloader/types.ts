export type DownloadStatus =
  'queued' | 'starting' | 'downloading' | 'paused' | 'merging' | 'completed' | 'failed' | 'cancelled'

export interface DownloadOptions {
  id: string

  url: string

  outputPath: string

  format?: string

  audioOnly?: boolean

  noPlaylist?: boolean

  playlist?: boolean

  headers?: Record<string, string>

  cookiesFile?: string

  proxy?: string
}

export interface DownloadFailure {
  exitCode?: number
  stderr?: string
  stdout?: string
  command?: string
}

export interface ConnectionInfo {
  id: string
  host: string
  speed: number
  status: string
}

export interface DownloadProgress {
  id: string

  status: DownloadStatus

  progress: number

  speed: number

  eta: string

  downloadedBytes: number

  totalBytes: number

  filename?: string

  connections?: ConnectionInfo[]
}
