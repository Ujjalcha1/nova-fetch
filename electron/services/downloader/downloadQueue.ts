import { DownloadManager } from './downloadManager'
import { DownloadOptions } from './types'

export class DownloadQueue {
  private readonly queue: DownloadOptions[] = []

  private readonly running = new Set<string>()

  private readonly maxConcurrent: number

  constructor(
    private readonly manager: DownloadManager,
    maxConcurrent = 3
  ) {
    this.maxConcurrent = maxConcurrent
  }

  async enqueue(options: DownloadOptions) {
    this.queue.push(options)

    this.processQueue().catch((err) => {
      console.error('[DownloadQueue] processQueue error:', err)
    })
  }

  private async processQueue() {
    while (this.running.size < this.maxConcurrent && this.queue.length) {
      const options = this.queue.shift()!

      if (this.running.has(options.id)) {
        continue
      }

      this.running.add(options.id)

      const task = this.manager.start(options)

      task
        .catch(() => {
          /* task errors are handled via EventBus */
        })
        .finally(() => {
          this.running.delete(options.id)

          const task = this.manager.getTask(options.id)

          const isPaused = task?.isPaused() ?? false
          const isRunning = task?.isRunning() ?? false

          if (!isPaused && !isRunning) {
            this.processQueue().catch((err) => {
              console.error('[DownloadQueue] processQueue from finally failed:', err)
            })
          }
        })
    }
  }

  async pause(id: string) {
    await this.manager.pause(id)
  }

  async resume(id: string) {
    await this.manager.resume(id)
  }

  async cancel(id: string) {
    await this.manager.cancel(id)

    this.running.delete(id)

    // Remove from waiting queue if download hasn't started yet
    const idx = this.queue.findIndex((o) => o.id === id)
    if (idx !== -1) {
      this.queue.splice(idx, 1)
    }
  }

  async pauseMany(ids: string[]): Promise<string[]> {
    const processed: string[] = []

    for (const id of ids) {
      const task = this.manager.getTask(id)

      if (!task) {
        continue
      }

      const paused = await this.manager.pause(id)

      if (paused) {
        processed.push(id)
      }
    }

    return processed
  }

  async resumeMany(ids: string[]): Promise<string[]> {
    const processed: string[] = []

    for (const id of ids) {
      const task = this.manager.getTask(id)

      if (!task) {
        continue
      }

      if (!task.isPaused()) {
        continue
      }

      await this.manager.resume(id)
      processed.push(id)
    }

    return processed
  }

  async pauseAll() {
    const promises = [...this.running].map((id) => this.manager.pause(id))
    await Promise.all(promises)
  }

  async resumeAll() {
    const promises = [...this.running].map((id) => this.manager.resume(id))
    await Promise.all(promises)
  }

  clearWaitingQueue() {
    this.queue.length = 0
  }

  getWaitingCount() {
    return this.queue.length
  }

  getRunningCount() {
    return this.running.size
  }
}
