import React, { useEffect, useRef, useState } from 'react'
import AppLayout from '../layout/AppLayout'
import DownloadsPage from '../pages/DownloadsPage'
import ScheduledPage from '../pages/ScheduledPage'
import CompletedPage from '../pages/CompletedPage'
import HistoryPage from '../pages/HistoryPage'
import { useDownloadStore } from '../store/download-store'
import { useSettingsStore } from '../store/settings-store'
import { useNavigationStore, type Page } from '../store/navigation-store'
import { electron } from '../lib/electron'
import type { DownloadStatus, DownloadItem } from '../types/download'
import { pushSpeedSample, shouldUpdateStore, getSmoothedSpeed, markStoreUpdated, shouldUpdateEta, markEtaUpdated, computeEta, clearSamples } from '../lib/speed-smoother'
import { formatErrorMessage } from '../lib/format'
import { useToastStore } from '../store/toast-store'
import { useKeyboardShortcuts } from '../lib/useKeyboardShortcuts'
import { useNotificationStore } from '../store/notification-store'
import { useClipboardMonitor } from '../lib/useClipboardMonitor'
import ClipboardNotification from '../components/common/ClipboardNotification'
import { useUpdate } from '../hooks/useUpdate'
import UpdateAvailableDialog from '../features/dialogs/UpdateAvailableDialog'
import RatingDialog from '../features/dialogs/RatingDialog'
import type { UpdateCheckResult } from '../types/electron'

function AboutPage(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
      <h2 className="text-xl font-bold text-violet-500">NovaFetch</h2>
      <p className="text-sm">Version 1.0.0</p>
      <p className="text-sm">Download Manager built with Electron & React</p>
    </div>
  )
}

const PAGES: Record<Page, React.FC> = {
  downloads: DownloadsPage,
  scheduled: ScheduledPage,
  completed: CompletedPage,
  history: HistoryPage,
  about: AboutPage
}

export default function App(): React.JSX.Element {
  const updateDownload = useDownloadStore((s) => s.updateDownload)
  const loadSettings = useSettingsStore((s) => s.loadSettings)
  const page = useNavigationStore((s) => s.page)
  const navigate = useNavigationStore((s) => s.navigate)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { checkForUpdates } = useUpdate()
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null)
  const [updateDownloading, setUpdateDownloading] = useState(false)
  const [updateProgress, setUpdateProgress] = useState<number | null>(null)
  const updateInFlightRef = useRef(false)
  const ratingSubmitInFlightRef = useRef(false)
  const [ratingDownloadId, setRatingDownloadId] = useState<string | null>(null)
  const [ratingError, setRatingError] = useState<string | null>(null)
  const [ratingSubmitting, setRatingSubmitting] = useState(false)

  useKeyboardShortcuts()
  const { detectedUrl, dismiss: dismissClipboard } = useClipboardMonitor()

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // One-time update check after the renderer starts. If an update is
  // available, surface the existing UpdateAvailableDialog; otherwise do
  // nothing. Check-only: no download, no install, no force-update gating.
  useEffect(() => {
    let cancelled = false
    checkForUpdates().then((result) => {
      if (cancelled) return
      if (result.updateAvailable) setUpdateResult(result)
    })
    return () => {
      cancelled = true
    }
  }, [checkForUpdates])

  // Restore persisted downloads on mount
  useEffect(() => {
    electron.loadDownloads().then((saved) => {
      const items = saved as DownloadItem[]
      if (items.length === 0) return

      useDownloadStore.setState({ downloads: items })

      for (const d of items) {
        if (['completed', 'failed', 'cancelled', 'paused'].includes(d.status)) continue

        updateDownload(d.id, {
          status: 'queued',
          speed: 0,
          eta: 0,
          retryAt: null
        })

        electron.start({ id: d.id, url: d.url, outputPath: d.savePath, format: '' })
      }
    })
  }, [updateDownload])

  // Persist downloads to disk whenever they change
  useEffect(() => {
    const unsub = useDownloadStore.subscribe(() => {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        const { downloads } = useDownloadStore.getState()
        const clean = downloads.map(({ connections, ...rest }) => {
          void connections
          return rest
        })
        electron.saveDownloads(clean)
      }, 500)
    })
    return () => unsub()
  }, [])

  // Reset the Windows taskbar progress indicator whenever the download list
  // becomes empty (delete all, completed cleanup, queue cleared, etc.) so a
  // stale progress bar never lingers on the taskbar.
  useEffect(() => {
    const unsub = useDownloadStore.subscribe((state) => {
      if (state.downloads.length === 0) {
        electron.resetTaskbar()
      }
    })
    return () => unsub()
  }, [])

  // Notification triggers based on download status changes
  useEffect(() => {
    const prev = new Map<string, DownloadStatus>()
    const initial = useDownloadStore.getState()
    for (const d of initial.downloads) prev.set(d.id, d.status)
    const activeSet: DownloadStatus[] = ['queued', 'connecting', 'downloading', 'retrying']
    let prevActiveCount = initial.downloads.filter((d) => activeSet.includes(d.status)).length

    const unsub = useDownloadStore.subscribe((state) => {
      const add = useNotificationStore.getState().addNotification

      for (const d of state.downloads) {
        const ps = prev.get(d.id)
        if (!ps) { prev.set(d.id, d.status); continue }
        if (ps === d.status) continue

        if (d.status === 'downloading' && ps !== 'paused') {
          add({ type: 'download-started', title: 'Download Started', message: d.title })
        } else if (d.status === 'downloading' && ps === 'paused') {
          add({ type: 'download-resumed', title: 'Download Resumed', message: d.title })
        } else if (d.status === 'paused') {
          add({ type: 'download-paused', title: 'Download Paused', message: d.title })
        } else if (d.status === 'completed') {
          add({ type: 'download-completed', title: 'Download Completed', message: d.title })
        } else if (d.status === 'failed') {
          add({ type: 'download-failed', title: 'Download Failed', message: d.title })
        } else if (d.status === 'retrying') {
          add({ type: 'retry-started', title: 'Retry Started', message: d.title })
        }

        prev.set(d.id, d.status)
      }

      const activeCount = state.downloads.filter((d) => activeSet.includes(d.status)).length
      if (prevActiveCount > 0 && activeCount === 0) {
        add({ type: 'queue-finished', title: 'Queue Finished', message: 'All downloads are done' })
      }
      prevActiveCount = activeCount
    })

    return () => unsub()
  }, [])

  useEffect(() => {
    const hash = window.location.hash.replace('#', '') as Page
    if (hash && hash in PAGES) navigate(hash)
  }, [navigate])

  useEffect(() => {
    const onHashChange = (): void => {
      const hash = window.location.hash.replace('#', '') as Page
      if (hash && hash in PAGES) navigate(hash)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [navigate])

  useEffect(() => {
    window.location.hash = page
  }, [page])

  useEffect(() => {
    const unsubProgress = electron.onProgress?.((progress) => {
      console.log('[EVENT]', {
        event: 'onProgress',
        id: progress.id,
        status: progress.status,
        paused: progress.status === 'paused',
        progress: progress.progress,
      })

      const current = useDownloadStore.getState().downloads.find(d => d.id === progress.id)
      if (!current) return
      const prevTotal = current.totalSize

      const downloadedBytes = progress.downloadedBytes ?? current.downloaded
      const totalBytes = (progress.totalBytes && progress.totalBytes > 0) ? progress.totalBytes : prevTotal
      // While merging, all bytes are on disk but the final file isn't renamed
      // yet — only the 'completed' event may finish the row.
      const done = progress.status !== 'merging' && totalBytes > 0 && downloadedBytes >= totalBytes

      if (progress.status === 'completed' || progress.progress >= 100 || done) {
        clearSamples(progress.id)
        updateDownload(progress.id, {
          status: 'completed',
          progress: 100,
          speed: 0,
          eta: 0,
          downloaded: downloadedBytes,
          totalSize: totalBytes,
          retryCount: 0
        })
        return
      }

      pushSpeedSample(progress.id, progress.speed)

      if (shouldUpdateEta(progress.id)) {
        const eta = computeEta(progress.id, downloadedBytes, totalBytes)
        updateDownload(progress.id, { eta })
        markEtaUpdated(progress.id)
      }

      if (!shouldUpdateStore(progress.id)) return

      const smoothedSpeed = getSmoothedSpeed(progress.id)
      const clampedProgress = Math.max(0, Math.min(100, progress.progress))
      const maxProgress = Math.max(clampedProgress, current.progress)

      const updates: Partial<DownloadItem> = {
        status: progress.status as DownloadStatus,
        progress: maxProgress,
        speed: smoothedSpeed,
        downloaded: downloadedBytes,
        totalSize: totalBytes
      }
      if (progress.connections) {
        updates.connections = progress.connections
      }
      updateDownload(progress.id, updates)

      markStoreUpdated(progress.id)

      if (progress.filename) {
        const name = progress.filename.split(/[/\\]/).pop() ?? progress.filename
        const current = useDownloadStore.getState().downloads.find(d => d.id === progress.id)
        if (current && !current.files.some(f => f.name === name)) {
          updateDownload(progress.id, {
            files: [...current.files, {
              id: crypto.randomUUID(),
              name,
              size: progress.totalBytes
            }]
          })
        }
      }
    })

    const unsubCompleted = electron.onCompleted?.((id) => {
      console.log('[EVENT]', {
        event: 'onCompleted',
        id,
        status: 'completed',
        paused: false,
        progress: 100,
      })

      clearSamples(id)
      const current = useDownloadStore.getState().downloads.find(d => d.id === id)
      if (!current) return

      const finalSize = current.totalSize
      updateDownload(id, {
        status: 'completed',
        progress: 100,
        speed: 0,
        eta: 0,
        downloaded: finalSize,
        totalSize: finalSize,
        retryCount: 0
      })

      useToastStore.getState().addToast({
        message: 'Download Completed',
        subtitle: current.title,
        type: 'success',
      })

      // Rating prompt: after a successful download, ask the main process
      // whether the dialog should be shown (a completed download exists and
      // this device has never rated). This handler only fires for real
      // completion events — never during startup, when saved downloads are
      // restored without emitting 'completed', and never for failures (those
      // go through onFailed).
      //
      // The normal persistence path is debounced by 500ms, so save immediately
      // first — otherwise main's shouldShowRating() would read a downloads.json
      // that still shows the download's previous status and the prompt would
      // never appear after the first completed download.
      const { downloads } = useDownloadStore.getState()
      const clean = downloads.map(({ connections, ...rest }) => {
        void connections
        return rest
      })
      electron
        .saveDownloads(clean)
        .then(() => window.electronAPI.rating.showRatingDialog())
        .then((show) => {
          if (show) {
            setRatingDownloadId(id)
            setRatingError(null)
          }
        })
        .catch(() => {
          // Best-effort: a persistence or IPC failure must never break the
          // completion flow.
        })

      const filenames = current.files.map((f) => f.name)
      if (filenames.length > 0) {
        electron.verifyFiles(current.savePath, filenames).then((results) => {
          const verified = results.filter((r) => r.exists)
          if (verified.length === 0) return

          const updatedFiles = current.files.map((f, i) => {
            const r = results[i]
            if (r && r.exists) return { ...f, size: r.size }
            return f
          })
          updateDownload(id, { files: updatedFiles })

          const videoPath = verified.find((r) => /\.(mp4|mkv|webm|avi|mov)$/i.test(r.path))?.path
          if (videoPath && !current.thumbnail) {
            // Only generate a preview frame when the UI needs one (no metadata
            // thumbnail URL was provided). The frame is extracted into the app
            // temp dir and returned as a data URL — never saved to the
            // download folder (THUMBNAIL_HANDLING_REPORT.md).
            electron.generateThumbnail(id, videoPath).then((thumb) => {
              if (thumb) updateDownload(id, { thumbnail: thumb })
            })
          }
        })
      }
    })

    const unsubFailed = electron.onFailed?.((data) => {
      console.log('[EVENT]', {
        event: 'onFailed',
        id: data.id,
        status: 'failed',
        paused: false,
        progress: 0,
      })

      clearSamples(data.id)
      const current = useDownloadStore.getState().downloads.find((d) => d.id === data.id)
      if (!current) return

      const maxRetries = current.maxRetries ?? 3
      const retryDelay = current.retryDelay ?? 30

      if (current.retryCount < maxRetries) {
        const retryAt = Date.now() + retryDelay * 1000
        updateDownload(data.id, {
          status: 'retrying',
          retryCount: current.retryCount + 1,
          retryAt,
          error: formatErrorMessage(data.error) || 'Download failed',
          failureDetails: data.failureDetails
        })

        setTimeout(() => {
          const d = useDownloadStore.getState().downloads.find((x) => x.id === data.id)
          if (!d || d.status !== 'retrying' || d.retryAt !== retryAt) return

          updateDownload(data.id, {
            status: 'queued',
            error: undefined,
            failureDetails: undefined,
            retryAt: null
          })
          electron.start({ id: data.id, url: d.url, outputPath: d.savePath, format: '' })
        }, retryDelay * 1000)
      } else {
        updateDownload(data.id, {
          status: 'failed',
          error: formatErrorMessage(data.error) || 'Download failed',
          failureDetails: data.failureDetails,
          retryAt: null
        })
      }
    })

    const unsubLog = electron.onLog?.((data) => {
      console.log('[EVENT]', {
        event: 'onLog',
        id: data.downloadId,
        status: 'log',
        paused: false,
        progress: 0,
        message: data.message,
      })

      const current = useDownloadStore.getState().downloads.find(d => d.id === data.downloadId)
      if (current) {
        updateDownload(data.downloadId, {
          logs: [...current.logs, {
            id: crypto.randomUUID(),
            message: data.message,
            timestamp: data.timestamp
          }]
        })
      }
    })

    return () => {
      unsubProgress?.()
      unsubCompleted?.()
      unsubFailed?.()
      unsubLog?.()
    }
  }, [updateDownload])

  async function handleUpdate(): Promise<void> {
    // Prevent multiple clicks / concurrent update runs.
    if (updateInFlightRef.current || !updateResult) return
    updateInFlightRef.current = true

    setUpdateDownloading(true)
    setUpdateProgress(0)

    const unsubProgress = window.electron.update.onDownloadProgress?.((data) => {
      setUpdateProgress(data.percent)
    })

    try {
      // 1. Download the update with electron-updater (main process, GitHub
      //    release). Never appears in the Downloads list.
      const download = await window.electron.update.download()
      if (!download.ok) {
        throw new Error(download.error || 'Failed to download the update')
      }

      // 2. Download complete — install silently and restart. electron-updater
      //    quits NovaFetch and runs the installer with /S, so no installer
      //    wizard appears. Fire-and-forget: the app quits right after.
      window.electron.update.install()
    } catch (err) {
      // Keep the app open and surface the failure.
      useToastStore.getState().addToast({
        message: 'Update failed',
        subtitle: formatErrorMessage(err),
        type: 'error'
      })
      updateInFlightRef.current = false
      setUpdateDownloading(false)
      setUpdateProgress(null)
    } finally {
      unsubProgress?.()
    }
  }

  return (
    <AppLayout>
      {React.createElement(PAGES[page])}
      {detectedUrl && (
        <ClipboardNotification url={detectedUrl} onDismiss={dismissClipboard} />
      )}

      {updateResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => {
            // Forced updates cannot be dismissed by clicking the backdrop;
            // the dialog stays visible until the update starts.
            if (!updateResult.forceUpdate) setUpdateResult(null)
          }}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <UpdateAvailableDialog
              result={updateResult}
              onClose={() => {
                // Block dismissal while the installer is downloading so the
                // in-flight download is never orphaned.
                if (!updateDownloading) setUpdateResult(null)
              }}
              onUpdate={handleUpdate}
              downloading={updateDownloading}
              progress={updateProgress}
            />
          </div>
        </div>
      )}
      {ratingDownloadId && (
        <RatingDialog
          onClose={() => {
            ratingSubmitInFlightRef.current = false
            setRatingDownloadId(null)
            setRatingError(null)
            setRatingSubmitting(false)
          }}
          error={ratingError}
          submitting={ratingSubmitting}
          onSubmit={(rating, comment) => {
            const downloadId = ratingDownloadId
            if (!downloadId || ratingSubmitInFlightRef.current) return

            // saveRating() uploads to Firestore in main; on success the device
            // is marked as rated there and the dialog closes. On failure the
            // dialog stays open with the error shown inline so the user can
            // retry — the dialog only closes on a successful save.
            ratingSubmitInFlightRef.current = true
            setRatingSubmitting(true)
            void window.electronAPI.rating
              .submitRating({ downloadId, rating: rating as 1 | 2 | 3 | 4 | 5, comment })
              .then((result) => {
                ratingSubmitInFlightRef.current = false
                setRatingSubmitting(false)
                if (result.success) {
                  setRatingDownloadId(null)
                  setRatingError(null)
                  useToastStore.getState().addToast({
                    message: 'Thanks for your feedback!',
                    type: 'success'
                  })
                } else {
                  setRatingError(result.error ?? 'Could not submit rating. Please try again.')
                }
              })
          }}
        />
      )}
    </AppLayout>
  )
}
