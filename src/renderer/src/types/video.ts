export interface VideoFormat {
  id: string

  formatId: string

  quality: string

  ext: string

  filesize: number

  fps?: number

  codec?: string
}

export interface VideoInfo {
  url: string

  title: string

  thumbnail: string

  uploader: string

  duration: number

  viewCount: number

  formats: VideoFormat[]
}
