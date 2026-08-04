export interface DownloadFailure {
  exitCode?: number
  stderr?: string
  stdout?: string
  command?: string
}

export type DownloadPriority = 'very-low' | 'low' | 'normal' | 'high' | 'very-high'

export type DownloadStatus =
  | 'queued'
  | 'analyzing'
  | 'fetching-metadata'
  | 'connecting'
  | 'downloading'
  | 'paused'
  | 'retrying'
  | 'merging'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'

/** Type describing progress payload sent from main process via IPC */
export interface IpcDownloadProgress {
  id: string
  status: string
  progress: number
  speed: number
  eta: string
  downloadedBytes: number
  totalBytes: number
  filename?: string
  connections?: DownloadConnection[]
}

export interface DownloadLog {
  id: string
  message: string
  timestamp: number
}

export interface DownloadConnection {
  id: string
  host: string
  speed: number
  status: string
}

export interface DownloadFile {
  id: string
  name: string
  size: number
}

export interface DownloadItem {
  id: string

  title: string

  url: string

  thumbnail?: string

  savePath: string

  status: DownloadStatus

  progress: number

  speed: number

  eta: number

  downloaded: number

  totalSize: number

  priority: DownloadPriority

  retryCount: number

  maxRetries: number

  retryDelay: number

  retryAt: number | null

  addedAt: number

  error?: string

  failureDetails?: DownloadFailure

  logs: DownloadLog[]

  files: DownloadFile[]

  connections: DownloadConnection[]
}

export interface StartDownloadRequest {
  id: string
  url: string
  outputPath: string
  format: string
}
