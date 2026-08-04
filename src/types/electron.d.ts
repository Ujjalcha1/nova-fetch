import { DownloadMetadata, PlaylistMetadata } from './download-metadata'
import { IpcDownloadProgress, DownloadFailure } from './download'

export interface AppSettings {
  defaultDownloadFolder: string
  concurrentDownloads: number
  maxRetries: number
  retryDelay: number
  theme: string
  autoUpdate: boolean
  language: string
  ffmpegPath: string
  ytDlpPath: string
  cookiesMode: string
  clipboardMonitor: boolean
}

export type UpdateChannel = 'stable' | 'beta' | 'nightly'

export interface UpdateConfig {
  autoUpdate: boolean
  updateChannel: UpdateChannel
}

export interface UpdateCheckResult {
  currentVersion: string
  latestVersion: string
  updateAvailable: boolean
  forceUpdate: boolean
  minimumSupportedVersion: string | null
  releaseNotes: string | null
  downloadUrl: string
  error: string | null
}

export {}

declare global {
  interface Window {
    electronAPI: {
      download: {
        start(options: { id: string; url: string; outputPath: string; format?: string; noPlaylist?: boolean }): Promise<boolean>

        pause(id: string): Promise<void>

        pauseMany(ids: string[]): Promise<string[]>

        resume(id: string): Promise<void>

        resumeMany(ids: string[]): Promise<string[]>

        cancel(id: string): Promise<void>

        getMetadata(url: string): Promise<DownloadMetadata>

        getPlaylistMetadata(url: string): Promise<PlaylistMetadata>

        headRequest(url: string): Promise<{
          ok: boolean
          status: number
          headers: Record<string, string>
          filename: string
          contentLength: number
          contentType: string
        }>

        magnetMetadata(magnetUri: string): Promise<{
          name: string
          infoHash: string
          fileCount: number
          totalSize: number
          trackers: string[]
        }>

        resolveMagnet(magnetUri: string): Promise<{
          name: string
          infoHash: string
          totalSize: number
          fileCount: number
          files: { path: string; name: string; length: number }[]
        }>

        getDiskSpace(dirPath: string): Promise<{ free: number; total: number }>

        getDefaultDownloadsPath(): Promise<string>

        selectFolder(): Promise<string | null>

        onProgress(callback: (data: IpcDownloadProgress) => void): () => void

        onCompleted(callback: (id: string) => void): () => void

        onFailed(callback: (data: { id: string; error: string; failureDetails?: DownloadFailure }) => void): () => void

        onLog(callback: (data: { downloadId: string; message: string; timestamp: number }) => void): () => void

        openFile(filePath: string): Promise<void>

        openFolder(filePath: string): Promise<void>

        deleteDownloadFile(params: { path: string }): Promise<{ success: boolean; error?: string }>

        deleteDownloadFiles(params: { id: string; savePath: string; filenames: string[] }): Promise<{ success: boolean; error?: string }>

        resetTaskbar(): Promise<void>

        deleteFiles(filePaths: string[]): Promise<{ deleted: string[]; notFound: string[]; failed: { path: string; error: string }[] }>

        verifyFiles(savePath: string, filenames: string[]): Promise<{ path: string; exists: boolean; size: number }[]>

        generateThumbnail(downloadId: string, videoPath: string): Promise<string | null>

        getSettings(): Promise<AppSettings>

        saveSettings(settings: Partial<AppSettings>): Promise<AppSettings>

        saveDownloads(downloads: unknown[]): Promise<void>

        loadDownloads(): Promise<unknown[]>
      }

      clipboard: {
        startMonitoring(): Promise<void>
        stopMonitoring(): Promise<void>
        onUrlDetected(callback: (url: string) => void): () => void
      }
    }

    electron: {
      update: {
        getCurrentVersion(): Promise<string>

        check(): Promise<UpdateCheckResult>

        getSettings(): Promise<UpdateConfig>

        setSettings(settings: Partial<UpdateConfig>): Promise<UpdateConfig>

        download(url: string): Promise<{ ok: boolean; path?: string; error?: string }>

        launch(installerPath: string): Promise<{ ok: boolean; error?: string }>

        onDownloadProgress(callback: (data: { received: number; total: number; percent: number | null }) => void): () => void
      }
    }
  }
}
