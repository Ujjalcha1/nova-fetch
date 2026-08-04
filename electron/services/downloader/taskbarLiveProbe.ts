import { appendFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { TaskbarProgress } from './taskbarProgress'

const LOG_PATH = path.resolve(process.cwd(), 'logs', 'taskbar-live.log')

function writeLine(line: string): void {
  try {
    mkdirSync(path.dirname(LOG_PATH), { recursive: true })
    appendFileSync(LOG_PATH, `${line}\n`)
  } catch (err) {
    console.error('[TASKBAR-PROBE] write failed', err)
  }
}

/**
 * Runtime-only instrumentation. Started only when NOVAFETCH_LIVE_TEST=1.
 * Samples the live TaskbarProgress state once per second and appends a
 * structured line to logs/taskbar-live.log:
 *
 *   [probe] <ts> downloads.size=N activeCount=K setProgressBar=V mode=M per=[...]
 *
 * Every second it reports (1) the raw number of tracked downloads,
 * (2) how many are currently active, (3) the exact value last passed to
 * BrowserWindow.setProgressBar(), and (4) each download's live status/bytes.
 */
export class TaskbarLiveProbe {
  private timer: NodeJS.Timeout | null = null

  constructor(private readonly taskbar: TaskbarProgress) {}

  start(): void {
    this.stop()
    writeLine(`[probe] ${new Date().toISOString()} sampler-started`)
    this.timer = setInterval(() => this.sample(), 1000)
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
      writeLine(`[probe] ${new Date().toISOString()} sampler-stopped`)
    }
  }

  markStart(id: string, url: string): void {
    writeLine(`[probe] ${new Date().toISOString()} download:start id=${id} url=${url}`)
  }

  private sample(): void {
    const s = this.taskbar.liveSnapshot()
    const per =
      s.entries.map((e) => `${e.id}:${e.status}:${e.downloaded}/${e.total}`).join(' | ') || '(none)'
    writeLine(
      `[probe] ${new Date().toISOString()} downloads.size=${s.downloadsSize} activeCount=${s.activeCount} setProgressBar=${s.lastSetProgress} mode=${s.lastSetMode} per=[${per}]`
    )
  }
}
