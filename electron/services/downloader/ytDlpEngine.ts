import { ChildProcessWithoutNullStreams } from 'node:child_process'

import { DownloadEngine } from './engine.types'
import { DownloadOptions, DownloadProgress } from './types'
import { DownloadEventBus } from './eventBus'
import { YtDlpService } from './ytDlpService'

const EngineState = {
  Idle: 'Idle',
  Starting: 'Starting',
  Downloading: 'Downloading',
  Paused: 'Paused',
  Completed: 'Completed',
  Cancelled: 'Cancelled',
  Failed: 'Failed'
} as const

type EngineState = (typeof EngineState)[keyof typeof EngineState]

export class YtDlpEngine implements DownloadEngine {
  private state: EngineState = EngineState.Idle
  private process: ChildProcessWithoutNullStreams | undefined
  private lastProgress: DownloadProgress | null = null

  constructor(
    private readonly options: DownloadOptions,
    private readonly eventBus: DownloadEventBus
  ) {}

  getOptions(): DownloadOptions {
    return this.options
  }

  async start(): Promise<void> {
    if (this.state === EngineState.Starting || this.state === EngineState.Downloading) return

    this.state = EngineState.Starting
    this.lastProgress = null

    const bus = this.createFreshBus()

    try {
      this.state = EngineState.Downloading
      this.process = await YtDlpService.download(
        this.options,
        bus,
        () => this.state === EngineState.Downloading
      )

      if (this.state !== EngineState.Downloading) {
        this.cleanupProcess()
        return
      }
    } catch (error) {
      this.state = EngineState.Failed
      this.process = undefined
      throw error
    }

    return new Promise<void>((resolve, reject) => {
      const proc = this.process!

      const onClose = (code: number | null) => {
        if (this.process !== proc) return
        this.process = undefined

        if (this.state === EngineState.Cancelled || this.state === EngineState.Paused) {
          resolve()
          return
        }

        if (code === 0) {
          this.state = EngineState.Completed
          resolve()
        } else {
          const stderr = (proc as any).stderrLog || ''
          const details = stderr ? `\n${stderr}` : ''
          this.state = EngineState.Failed
          reject(new Error(`yt-dlp exited with code ${code}${details}`))
        }
      }

      const onError = (error: Error) => {
        if (this.process !== proc) return
        this.process = undefined

        if (this.state === EngineState.Cancelled || this.state === EngineState.Paused) return

        this.state = EngineState.Failed
        reject(error)
      }

      proc.once('close', onClose)
      proc.once('error', onError)
    })
  }

  pause(): void {
    if (this.state !== EngineState.Downloading) return

    const snapshot = this.lastProgress ? { ...this.lastProgress } : null
    this.state = EngineState.Paused

    this.cleanupProcess()
    this.emitPaused(snapshot)
  }

  resume(): void {
    if (this.state === EngineState.Starting || this.state === EngineState.Downloading) return
    if (this.state !== EngineState.Paused) return

    const proc = this.process
    if (this.process) {
      this.cleanupProcess()
      if (proc && proc.exitCode === null && proc.signalCode === null) {
        proc.once('close', () => {
          this.start().catch(() => {})
        })
        return
      }
    }

    this.start().catch(() => {})
  }

  async cancel(): Promise<void> {
    if (
      this.state === EngineState.Completed ||
      this.state === EngineState.Cancelled ||
      this.state === EngineState.Failed
    ) return

    this.state = EngineState.Cancelled
    this.cleanupProcess()
  }

  private createFreshBus(): DownloadEventBus {
    const self = this
    return Object.create(this.eventBus, {
      progress: {
        value(progress: DownloadProgress) {
          if (self.state !== EngineState.Downloading) return
          self.lastProgress = { ...progress }
          self.eventBus.progress(progress)
        },
        writable: false,
        configurable: false
      }
    })
  }

  private emitPaused(snapshot: DownloadProgress | null): void {
    this.eventBus.progress(
      snapshot
        ? { ...snapshot, status: 'paused', speed: 0, eta: 'Paused' }
        : {
            id: this.options.id,
            status: 'paused',
            progress: 0,
            speed: 0,
            eta: 'Paused',
            downloadedBytes: 0,
            totalBytes: 0
          }
    )
  }

  private cleanupProcess(): void {
    const proc = this.process
    if (proc) {
      proc.stdout?.removeAllListeners('data')
      proc.stderr?.removeAllListeners('data')
      proc.removeAllListeners('close')
      proc.removeAllListeners('error')
      proc.stdout?.destroy()
      proc.stderr?.destroy()
      if (!proc.killed) {
        proc.kill('SIGTERM')
      }
      this.process = undefined
    }
  }
}
