import { BrowserWindow } from 'electron'

interface DownloadEntry {
  downloaded: number
  total: number
  status: string
  paused: boolean
  hasError: boolean
}

/**
 * Statuses that count as an active download (bytes contribute to the aggregate).
 *
 * Only these downloads move the taskbar indicator:
 *   - downloading  (HTTP + yt-dlp engines emit this while transferring)
 *   - merging      (HTTP engine emits this while merging chunks into the final file)
 *   - verifying    (reserved — post-download integrity check status)
 *
 * Everything else (completed, failed, cancelled, queued, scheduled, starting,
 * paused) is excluded from the combined progress.
 */
const ACTIVE_STATUSES = new Set(['downloading', 'merging', 'verifying'])

/** How long the taskbar shows 100% after the last active download completes. */
const COMPLETION_FLASH_MS = 1500

type TaskbarMode = 'normal' | 'paused' | 'error' | 'hidden'

/**
 * Aggregates progress from all active downloads and updates the Windows
 * taskbar progress indicator (green bar on the app icon).
 *
 * The taskbar ALWAYS represents the combined progress of every active download
 * — it never switches between individual downloads:
 *
 *   overallProgress =
 *     ( sum(downloadedBytes of active downloads) /
 *       sum(totalBytes of active downloads) ) * 100
 *
 * Normalised progress per the Electron docs:
 *   [0.0 – 1.0] = normal (green)
 *   -1          = hidden (no active downloads)
 */
export class TaskbarProgress {
  private readonly downloads = new Map<string, DownloadEntry>()
  private lastProgress: number | null = null
  private lastMode: TaskbarMode = 'hidden'
  private resetTimer: NodeJS.Timeout | null = null
  private pendingFlash = false
  private lastSetProgress: number | null = null
  private lastSetMode: TaskbarMode = 'hidden'

  constructor(private readonly win: BrowserWindow) {}

  /** Call on every progress tick from the download engine. */
  onProgress(
    id: string,
    downloaded: number,
    total: number,
    status: string
  ): void {
    if (status === 'completed') {
      // A download finished — if it turns out to be the last active one we
      // flash 100% on the taskbar before hiding it.
      this.pendingFlash = true
    }

    const entry = this.downloads.get(id) ?? {
      downloaded: 0,
      total: 0,
      status,
      paused: false,
      hasError: false
    }
    entry.downloaded = downloaded
    entry.total = total
    entry.status = status
    entry.paused = status === 'paused'
    entry.hasError = status === 'failed'
    this.downloads.set(id, entry)
    this.flush()
  }

  /** Call when a download completes successfully. */
  onCompleted(id: string): void {
    if (this.downloads.has(id)) {
      this.pendingFlash = true
    }
    this.downloads.delete(id)
    this.flush()
  }

  /** Call when a download fails. */
  onFailed(id: string): void {
    this.downloads.delete(id)
    this.flush()
  }

  /** Call when a download is cancelled or removed from the queue. */
  onRemoved(id: string): void {
    this.downloads.delete(id)
    this.flush()
  }

  /**
   * Force the taskbar indicator back to hidden, regardless of what state the
   * aggregate is in. Used when the download list becomes empty for any reason
   * (delete all, queue cleared, all entries removed) so a stale progress bar
   * can never linger on the Windows taskbar.
   */
  reset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer)
      this.resetTimer = null
    }
    this.pendingFlash = false
    this.downloads.clear()
    this.hide()
  }

  /**
   * Live snapshot used by runtime instrumentation (TaskbarLiveProbe).
   * Exposes the internal Map size, the active-download count, the exact
   * value last passed to BrowserWindow.setProgressBar(), and per-download
   * entries so the running app can be observed without breaking into state.
   */
  liveSnapshot(): {
    downloadsSize: number
    activeCount: number
    lastSetProgress: number | null
    lastSetMode: string
    entries: { id: string; status: string; downloaded: number; total: number }[]
  } {
    const entries = [...this.downloads.entries()].map(([id, d]) => ({
      id,
      status: d.status,
      downloaded: d.downloaded,
      total: d.total
    }))
    return {
      downloadsSize: this.downloads.size,
      activeCount: this.activeEntries().length,
      lastSetProgress: this.lastSetProgress,
      lastSetMode: this.lastSetMode,
      entries
    }
  }

  // ------------------------------------------------------------------
  // Internal
  // ------------------------------------------------------------------

  private activeEntries(): DownloadEntry[] {
    return [...this.downloads.values()].filter((d) =>
      ACTIVE_STATUSES.has(d.status.toLowerCase())
    )
  }

  private flush(): void {
    const active = this.activeEntries()

    if (active.length === 0) {
      if (this.pendingFlash) {
        // Last active download just completed — show 100% briefly,
        // then reset to a hidden taskbar bar.
        this.pendingFlash = false
        this.show(1, 'normal')
        if (this.resetTimer) clearTimeout(this.resetTimer)
        this.resetTimer = setTimeout(() => {
          this.resetTimer = null
          this.hide()
        }, COMPLETION_FLASH_MS)
      } else {
        this.hide()
      }
      return
    }

    // There are still active downloads — cancel any pending completion flash
    // and always show the combined progress of the currently active set.
    if (this.resetTimer) {
      clearTimeout(this.resetTimer)
      this.resetTimer = null
    }
    this.pendingFlash = false

    let sumDownloaded = 0
    let sumTotal = 0
    let anyPaused = false
    let anyError = false

    for (const d of active) {
      sumDownloaded += d.downloaded
      sumTotal += d.total
      if (d.paused) anyPaused = true
      if (d.hasError) anyError = true
    }

    // Combined progress = total bytes downloaded / total bytes across all
    // active downloads (byte-weighted, NOT a simple average).
    const progress = sumTotal > 0 ? Math.min(sumDownloaded / sumTotal, 1) : 0
    const mode = anyError ? 'error' : anyPaused ? 'paused' : 'normal'

    this.show(progress, mode)
  }

  private show(progress: number, mode: 'normal' | 'paused' | 'error'): void {
    // Skip redundant updates
    if (this.lastProgress === progress && this.lastMode === mode) return

    this.lastProgress = progress
    this.lastMode = mode
    this.lastSetProgress = progress
    this.lastSetMode = mode

    switch (mode) {
      case 'error':
        this.win.setProgressBar(progress, { mode: 'error' })
        break
      case 'paused':
        this.win.setProgressBar(progress, { mode: 'paused' })
        break
      default:
        this.win.setProgressBar(progress)
        break
    }
  }

  private hide(): void {
    if (this.lastMode !== 'hidden') {
      this.win.setProgressBar(-1)
      this.lastMode = 'hidden'
      this.lastProgress = null
      this.lastSetProgress = -1
      this.lastSetMode = 'hidden'
    }
  }
}
