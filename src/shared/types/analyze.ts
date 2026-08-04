import type { FileInfo } from './file'
import type { PlaylistInfo } from './playlist'
import type { VideoInfo } from './video'

export type AnalyzeType = 'youtube' | 'file'

export interface AnalyzeSuccess {
  success: true
  type: AnalyzeType
  data: VideoInfo | PlaylistInfo | FileInfo
}

export interface AnalyzeError {
  success: false
  error: string
}

export type AnalyzeResponse = AnalyzeSuccess | AnalyzeError
