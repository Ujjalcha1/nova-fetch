import { DownloadTask } from './downloadTask'
import { DownloadOptions } from './types'
import { DownloadEventBus } from './eventBus'

export class DownloadManager {
  private readonly tasks = new Map<string, DownloadTask>()

  constructor(private readonly eventBus: DownloadEventBus) {}

  async start(options: DownloadOptions) {
    const task = new DownloadTask(options, this.eventBus)

    this.tasks.set(options.id, task)

    return task.start()
  }

  async pause(id: string): Promise<boolean> {
    const task = this.tasks.get(id)

    if (!task) {
      return false
    }

    return task.pause()
  }

  async resume(id: string) {
    const task = this.tasks.get(id)

    if (!task) {
      return
    }

    await task.resume()
  }

  async cancel(id: string) {
    const task = this.tasks.get(id)

    if (!task) {
      return
    }

    await task.cancel()

    this.tasks.delete(id)
  }

  getTask(id: string) {
    return this.tasks.get(id)
  }

  getTasks() {
    return [...this.tasks.values()]
  }
}
