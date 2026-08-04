import type { AnalyzeVideoResponse } from '../../../../shared/types/video'
import type { AnalyzeResponse } from '../../../../shared/types/analyze'
import type { AppSettings } from '../../../../shared/types/settings'

export {}

type DownloadPayload = {
  id: string
  url: string
  folder: string
  formatId: string
  format: 'mp4' | 'mp3'
  type: 'youtube' | 'file'
  filename?: string
  title?: string
  playlistId?: string
  playlistTitle?: string
  playlistIndex?: number
  playlistTotal?: number
}

declare global {
  interface Window {
    api: {
      setTaskbarProgress(progress: number): Promise<void>
      youtube: {
        analyze(url: string): Promise<AnalyzeVideoResponse>
      }
      dialog: {
        selectFolder(): Promise<string | null>
      }
      settings: {
        get(): Promise<AppSettings>
        update(settings: Partial<AppSettings>): Promise<AppSettings>
      }
      system: {
        openFolder(folder: string): Promise<{ success: boolean }>
        notify(title: string, body: string): Promise<void>
      }
      download: {
        analyze(url: string): Promise<AnalyzeResponse>
        start(payload: DownloadPayload): Promise<{ success: boolean; error?: string }>
        startPlaylist(payloads: DownloadPayload[]): Promise<{ success: boolean; error?: string }>
        cancel(id: string): Promise<{ success: boolean }>
        cancelPlaylist(ids: string[]): Promise<{ success: boolean }>
        pause(id: string): Promise<{ success: boolean }>
        pausePlaylist(ids: string[]): Promise<{ success: boolean }>
        resume(payload: DownloadPayload): Promise<{ success: boolean; error?: string }>
        resumePlaylist(payloads: DownloadPayload[]): Promise<{ success: boolean; error?: string }>
        delete(filePath: string): Promise<{ success: boolean; error?: string; message?: string }>
        openFile(filePath: string): Promise<{ success: boolean; error?: string }>
        openFolder(folderPath: string): Promise<{ success: boolean; error?: string }>
        onProgress(
          callback: (data: { id: string; progress: number; speed: string; eta: string }) => void
        ): () => void
        onCompleted(callback: (data: { id: string; filePath?: string }) => void): () => void
        onCancelled(callback: (data: { id: string }) => void): () => void
        onError(callback: (data: { id: string }) => void): () => void
        onPaused(callback: (data: { id: string }) => void): () => void
        onPlaylistProgress(
          callback: (data: {
            playlistId: string
            progress: number
            completed: number
            total: number
            speed: string
            eta: string
          }) => void
        ): () => void
        onPlaylistCompleted(callback: (data: { playlistId: string }) => void): () => void
      }
    }
  }
}
