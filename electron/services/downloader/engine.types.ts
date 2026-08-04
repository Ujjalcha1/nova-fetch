import { DownloadOptions } from './types'

export interface DownloadEngine {
  start(): Promise<void>
  pause(): void
  resume(): void
  cancel(): Promise<void>
  getOptions(): DownloadOptions
}
