import { Notification, BrowserWindow } from 'electron'

/**
 * Tracks recently-notified download IDs to prevent duplicate notifications
 * within a 30-second window (e.g. from multiple event sources).
 */
const recentlyNotified = new Set<string>()

/**
 * Tracks the last known filename per download ID so we can include it
 * in the notification body. Populated by progress events.
 */
const filenameCache = new Map<string, string>()

const DEDUP_WINDOW_MS = 30_000

function cleanRecentlyNotified(id: string) {
  setTimeout(() => recentlyNotified.delete(id), DEDUP_WINDOW_MS)
}

/**
 * Remember the filename for a download (called on every progress event).
 */
export function cacheFilename(id: string, filename: string): void {
  if (filename) {
    filenameCache.set(id, filename)
  }
}

/**
 * Show a native OS notification for a download lifecycle event.
 *
 * Supported on Windows 8.1+ (Action Center / Toast).
 * Falls back silently on platforms where `Notification.isSupported()` is false.
 *
 * @param win   – The BrowserWindow to focus when the notification is clicked.
 * @param type  – The kind of event.
 * @param id    – The download ID (used for deduplication).
 * @param title – The notification title (e.g. "Download Complete").
 * @param body  – Optional body text (e.g. "file.exe has finished downloading.").
 *               If omitted, a generic body is built from the cached filename.
 */
export function showNativeNotification(
  win: BrowserWindow,
  type: 'completed' | 'failed' | 'cancelled',
  id: string,
  title: string,
  body?: string
): void {
  // ── Guard: Notification API not available (Linux, older Windows, etc.) ──
  if (!Notification.isSupported()) return

  // ── Deduplicate ──
  if (recentlyNotified.has(id)) return
  recentlyNotified.add(id)
  cleanRecentlyNotified(id)

  // ── Build body if not provided ──
  if (!body) {
    const filename = filenameCache.get(id)
    switch (type) {
      case 'completed':
        body = filename
          ? `${filename} has finished downloading.`
          : 'Download has finished.'
        break
      case 'failed':
        body = filename
          ? `${filename} failed to download.`
          : 'Download failed.'
        break
      case 'cancelled':
        body = filename
          ? `${filename} was cancelled.`
          : 'Download was cancelled.'
        break
    }
  }

  // ── Clean up cached filename ──
  if (type === 'completed' || type === 'failed' || type === 'cancelled') {
    filenameCache.delete(id)
  }

  // ── Create & show notification ──
  const notification = new Notification({ title, body })

  notification.on('click', () => {
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  notification.show()
}
