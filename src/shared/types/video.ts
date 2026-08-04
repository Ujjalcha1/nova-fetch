import type { PlaylistInfo } from './playlist'

export interface VideoFormat {
  id: string
  formatId: string
  quality: string
  height: number
  ext: string
  filesize?: number
  fps?: number
  codec?: string
}

export interface VideoInfo {
  id: string
  url: string
  title: string
  thumbnail: string
  duration: number
  uploader: string
  viewCount: number
  webpageUrl: string
  formats: VideoFormat[]
}

export interface AnalyzeVideoSuccess {
  success: true
  data: VideoInfo | PlaylistInfo
}

export interface AnalyzeVideoError {
  success: false
  message: string
}

export type AnalyzeVideoResponse = AnalyzeVideoSuccess | AnalyzeVideoError
