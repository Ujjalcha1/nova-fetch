type QueueTask = () => Promise<void>

class DownloadQueue {
  private queue: QueueTask[] = []

  private running = false

  add(task: QueueTask) {
    this.queue.push(task)

    void this.run()
  }

  private async run() {
    if (this.running) {
      return
    }

    this.running = true

    while (this.queue.length) {
      const task = this.queue.shift()

      if (!task) {
        continue
      }

      try {
        await task()
      } catch (error) {
        console.error('Queue task failed:', error)
      }
    }

    this.running = false
  }

  size() {
    return this.queue.length
  }

  clear() {
    this.queue = []
  }
}

export const downloadQueue = new DownloadQueue()
