export interface DownloadProgress {
  percent: number
  speed: string
  eta: string
  status: 'idle' | 'downloading' | 'completed' | 'error'
}
