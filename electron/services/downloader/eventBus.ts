import { BrowserWindow } from 'electron'
import { DownloadProgress, DownloadFailure } from './types'

export class DownloadEventBus {
  constructor(
    public readonly window: BrowserWindow,
    private readonly onProgress?: (progress: DownloadProgress) => void,
    private readonly onCompleted?: (id: string) => void,
    private readonly onFailed?: (id: string, error: string) => void
  ) {}

  progress(progress: DownloadProgress) {
    this.onProgress?.(progress)
    this.window.webContents.send('download:progress', progress)
  }

  completed(id: string) {
    this.onCompleted?.(id)
    this.window.webContents.send('download:completed', id)
  }

  failed(id: string, error: string, details?: DownloadFailure) {
    this.onFailed?.(id, error)
    this.window.webContents.send('download:failed', {
      id,
      error,
      failureDetails: details
    })
  }

  log(downloadId: string, message: string) {
    this.window.webContents.send('download:log', {
      downloadId,
      message,
      timestamp: Date.now()
    })
  }
}
