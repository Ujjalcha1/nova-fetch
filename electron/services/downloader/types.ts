export type DownloadStatus =
  'queued' | 'starting' | 'downloading' | 'paused' | 'merging' | 'completed' | 'failed' | 'cancelled'

export interface DownloadOptions {
  id: string

  url: string

  /**
   * The URL the user originally provided, before redirect resolution.
   * Used by the direct-HTTP engine's filename priority chain (fallback #3).
   */
  originalUrl?: string

  /**
   * Filename already resolved by the analyze flow. When present, the direct-
   * HTTP engine starts from this name (so the Analyze dialog, queue, progress,
   * notifications and completed list all show the same name) instead of
   * re-deriving it from URLs. Content-Disposition from the actual download
   * response still overrides it (priority 1).
   */
  filename?: string

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
