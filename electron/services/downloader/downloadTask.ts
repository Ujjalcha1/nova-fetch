import { DownloadEngine } from './engine.types'
import { YtDlpEngine } from './ytDlpEngine'
import { HttpEngine } from './httpEngine'
import { DownloadEventBus } from './eventBus'
import { DownloadOptions } from './types'
import { detectUrlType, resolveDownloadUrl } from './urlType'

const DownloadState = {
  Idle: 'Idle',
  Starting: 'Starting',
  Downloading: 'Downloading',
  Paused: 'Paused',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  Failed: 'Failed'
} as const

type DownloadState = (typeof DownloadState)[keyof typeof DownloadState]

export class DownloadTask {
  private state: DownloadState = DownloadState.Idle
  private engine: DownloadEngine | null = null

  constructor(
    private readonly options: DownloadOptions,
    private readonly eventBus: DownloadEventBus
  ) {}

  get id(): string {
    return this.options.id
  }

  isPaused(): boolean {
    return this.state === DownloadState.Paused
  }

  isRunning(): boolean {
    return this.state === DownloadState.Downloading
  }

  async start(): Promise<void> {
    if (this.state === DownloadState.Starting || this.state === DownloadState.Downloading) return

    this.state = DownloadState.Starting

    const urlType = detectUrlType(this.options.url)

    // Resolve HTTP file URLs through redirect chains (GitHub CDN, etc.)
    // so the engine always gets a fresh signed URL and never persists the
    // temporary one. Original URL stays in DownloadOptions for persistence.
    let resolvedUrl = this.options.url
    if (urlType === 'http-file') {
      try {
        resolvedUrl = await resolveDownloadUrl(this.options.url)
      } catch {
        // Resolution failed — use the original URL; the engine's own
        // headRequest will also try to follow redirects
      }
    }

    const engineOptions = { ...this.options, url: resolvedUrl }

    switch (urlType) {
      case 'http-file':
        this.engine = new HttpEngine(engineOptions, this.eventBus)
        break
      default:
        this.engine = new YtDlpEngine(engineOptions, this.eventBus)
        break
    }

    try {
      this.state = DownloadState.Downloading
      await this.engine.start()
      if (this.state === DownloadState.Downloading) {
        this.state = DownloadState.Completed
      }
    } catch (error) {
      const st: string = this.state
      if (st === DownloadState.Cancelled || st === DownloadState.Paused) return
      this.state = DownloadState.Failed
      throw error
    }
  }

  async pause(): Promise<boolean> {
    if (this.state !== DownloadState.Downloading) return false

    this.state = DownloadState.Paused
    this.engine?.pause()

    return true
  }

  async resume(): Promise<void> {
    if (this.state === DownloadState.Starting || this.state === DownloadState.Downloading) return
    if (this.state !== DownloadState.Paused) return

    // Cancel the old engine and start fresh to re-resolve the URL
    // (CDN signed URLs expire, so we need a fresh URL on resume)
    await this.engine?.cancel()
    this.engine = null

    await this.start()
  }

  async cancel(): Promise<void> {
    if (
      this.state === DownloadState.Completed ||
      this.state === DownloadState.Cancelled ||
      this.state === DownloadState.Failed
    ) return

    this.state = DownloadState.Cancelled
    await this.engine?.cancel()
    this.engine = null
  }
}
