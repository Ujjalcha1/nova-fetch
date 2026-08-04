import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import { app, dialog, shell, BrowserWindow } from 'electron'

import { safeHandle } from './safeHandle'

import { DownloadEventBus } from '../services/downloader/eventBus'
import { DownloadManager } from '../services/downloader/downloadManager'
import { DownloadQueue } from '../services/downloader/downloadQueue'
import type { DownloadOptions } from '../services/downloader/types'
import { MetadataService } from '../services/downloader/metadataService'
import { PlaylistMetadataService } from '../services/downloader/playlistMetadataService'
import { cacheFilename, showNativeNotification } from '../services/downloader/nativeNotificationService'
import { TaskbarProgress } from '../services/downloader/taskbarProgress'
import { TaskbarLiveProbe } from '../services/downloader/taskbarLiveProbe'

import { getDiskFreeSpace } from '../services/downloader/diskSpace'
import { pipelineLog } from '../services/downloader/pipelineLogger'
import { cleanupThumbnail, cleanupAllThumbnails, generateThumbnail } from '../services/downloader/thumbnailManager'
import { SettingsService } from '../services/settingsService'
import { DownloadStoreService } from '../services/downloader/downloadStoreService'
import {
  FALLBACK_FILENAME,
  resolveHeaderFilename
} from '../services/downloader/httpFilename'

export function registerDownloadIpc(): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]

  const taskbar = win ? new TaskbarProgress(win) : undefined

  const liveProbe =
    process.env.NOVAFETCH_LIVE_TEST === '1' && taskbar
      ? new TaskbarLiveProbe(taskbar)
      : undefined
  if (liveProbe) {
    liveProbe.start()
    app.on('before-quit', () => liveProbe.stop())
  }

  const eventBus = win && taskbar
    ? new DownloadEventBus(
        win,
        (progress) => {
          // Cache filename from progress events for native notifications
          if (progress.filename) {
            cacheFilename(progress.id, progress.filename)
          }
          // Update Windows taskbar progress
          taskbar.onProgress(progress.id, progress.downloadedBytes, progress.totalBytes, progress.status)
        },
        (id) => {
          showNativeNotification(win, 'completed', id, 'Download Complete')
          taskbar.onCompleted(id)
          // Temp thumbnail no longer needed once the download finished.
          cleanupThumbnail(id)
        },
        (id) => {
          showNativeNotification(win, 'failed', id, 'Download Failed')
          taskbar.onFailed(id)
        }
      )
    : undefined
  const manager = eventBus ? new DownloadManager(eventBus) : undefined
  const settings = SettingsService.load()
  const queue = manager ? new DownloadQueue(manager, settings.concurrentDownloads) : undefined

  safeHandle('download:select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  /**
   * Extract response metadata from HTTP headers into the return shape.
   */
  function parseResponseMetadata(
    res: http.IncomingMessage,
    finalUrl: string,
    originalUrl: string
  ): {
    ok: boolean
    status: number
    headers: Record<string, string>
    filename: string
    filenameFromContentDisposition: boolean
    contentLength: number
    contentType: string
  } {
    const statusCode = res.statusCode ?? 0

    // Flatten headers to Record<string, string>
    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(res.headers)) {
      headers[key] = Array.isArray(value) ? value.join(', ') : value ?? ''
    }

    const contentLength = parseInt(res.headers['content-length'] ?? '0', 10) || 0
    const contentType = res.headers['content-type'] || 'application/octet-stream'

    // Priority chain (httpFilename.ts): Content-Disposition → final URL
    // pathname → original URL pathname → 'download.bin'. The flag tells the
    // caller whether the name really came from Content-Disposition — if not,
    // a GET probe is needed because CDNs often send the header only on GET.
    const { filename, fromContentDisposition } = resolveHeaderFilename(
      res.headers['content-disposition'],
      finalUrl,
      originalUrl
    )

    return {
      ok: statusCode >= 200 && statusCode < 300,
      status: statusCode,
      headers,
      filename,
      filenameFromContentDisposition: fromContentDisposition,
      contentLength,
      contentType,
    }
  }

  /**
   * Perform an HTTP request that aborts after receiving headers.
   * Tries HEAD first; if the server rejects HEAD (403/404/405/5xx)
   * or returns no usable metadata, falls back to a GET that
   * reads headers only and then aborts the body.
   */
  safeHandle('download:head-request', async (_event, url: string) => {
    const MAX_REDIRECTS = 10

    const emptyFail = {
      ok: false,
      status: 0,
      headers: {} as Record<string, string>,
      filename: '',
      filenameFromContentDisposition: false,
      contentLength: 0,
      contentType: '',
    }

    async function doRequest(
      method: 'HEAD' | 'GET',
      currentUrl: string,
      redirectCount = 0,
      originalUrl = currentUrl,
    ): Promise<{
      ok: boolean
      status: number
      headers: Record<string, string>
      filename: string
      filenameFromContentDisposition: boolean
      contentLength: number
      contentType: string
    }> {
      try {
        const parsedUrl = new URL(currentUrl)
        const httpModule = parsedUrl.protocol === 'https:' ? https : http

        return await new Promise((resolve) => {
          const req = httpModule.request(
            currentUrl,
            { method },
            (res) => {
              const statusCode = res.statusCode ?? 0

              // Follow redirects
              if (
                [301, 302, 303, 307, 308].includes(statusCode) &&
                redirectCount < MAX_REDIRECTS
              ) {
                const location = res.headers.location
                if (location) {
                  res.resume() // drain the response
                  const nextUrl = new URL(location, currentUrl).toString()
                  resolve(doRequest(method, nextUrl, redirectCount + 1, originalUrl))
                  return
                }
              }

              const result = parseResponseMetadata(res, currentUrl, originalUrl)

              // Fall back to GET when HEAD failed or yielded no
              // Content-Disposition name — the GET response is where CDNs
              // usually send the real filename (Googleusercontent, S3, R2),
              // so a HEAD-derived URL-token name is never trusted as final.
              if (
                method === 'HEAD' &&
                (result.status === 0 ||
                 result.status === 403 ||
                 result.status === 404 ||
                 result.status === 405 ||
                 (result.status >= 500 && result.status < 600) ||
                 !result.filename ||
                 result.filename === FALLBACK_FILENAME ||
                 !result.filenameFromContentDisposition)
              ) {
                res.resume()
                doRequest('GET', currentUrl, redirectCount, originalUrl).then(resolve)
                return
              }

              // GET fallback — abort body immediately, we only needed headers
              if (method === 'GET') {
                req.destroy()
              } else {
                res.resume()
              }

              resolve(result)
            },
          )

          req.on('error', () => {
            // If HEAD fails with a network error, try GET as fallback
            if (method === 'HEAD') {
              doRequest('GET', currentUrl, redirectCount, originalUrl).then(resolve)
              return
            }
            resolve(emptyFail)
          })
          req.on('timeout', () => {
            req.destroy()
            // If HEAD times out, try GET as fallback
            if (method === 'HEAD') {
              doRequest('GET', currentUrl, redirectCount, originalUrl).then(resolve)
              return
            }
            resolve(emptyFail)
          })
          req.setTimeout(10000)

          req.end()
        })
      } catch {
        if (method === 'HEAD') {
          return doRequest('GET', currentUrl, redirectCount, originalUrl)
        }
        return emptyFail
      }
    }

    return doRequest('HEAD', url)
  })

  safeHandle('download:get-default-downloads-path', () => {
    return app.getPath('downloads')
  })

  safeHandle('download:start', async (_event, options: DownloadOptions) => {
    liveProbe?.markStart(options.id, options.url)
    await queue?.enqueue(options)

    return true
  })

  safeHandle('download:get-disk-space', async (_event, dirPath: string) => {
    return getDiskFreeSpace(dirPath)
  })

  const pendingGetMetadata = new Map<string, Promise<unknown>>()

  safeHandle('download:get-metadata', async (_event, url: string) => {
    const existing = pendingGetMetadata.get(url)
    if (existing) return existing

    const start = Date.now()
    console.log(`[IPC] download:get-metadata invoked for URL: ${url}`)

    const promise = (async () => {
      try {
        const result = await MetadataService.fetch(url)
        console.log(`[IPC] download:get-metadata completed in ${Date.now() - start}ms`)
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[IPC] download:get-metadata failed after ${Date.now() - start}ms: ${message}`)
        throw new Error(message)
      }
    })()

    pendingGetMetadata.set(url, promise)
    // Await cleanup on both branches so the derived promise can never reject
    // unhandled (a bare `.finally()` here would leave a floating rejection).
    promise.then(
      () => pendingGetMetadata.delete(url),
      () => pendingGetMetadata.delete(url)
    )

    return promise
  })

  const pendingGetPlaylistMetadata = new Map<string, Promise<unknown>>()

  safeHandle('download:get-playlist-metadata', async (_event, url: string) => {
    const existing = pendingGetPlaylistMetadata.get(url)
    if (existing) return existing

    const start = Date.now()
    console.log(`[IPC] download:get-playlist-metadata invoked for URL: ${url}`)

    const promise = (async () => {
      try {
        const result = await PlaylistMetadataService.fetch(url)
        console.log(`[IPC] download:get-playlist-metadata completed in ${Date.now() - start}ms ` +
          `(available: ${result.availableCount}, unavailable: ${result.unavailableCount})`)
        return result
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[IPC] download:get-playlist-metadata failed after ${Date.now() - start}ms: ${message}`)
        throw new Error(message)
      }
    })()

    pendingGetPlaylistMetadata.set(url, promise)
    // Await cleanup on both branches so the derived promise can never reject
    // unhandled (a bare `.finally()` here would leave a floating rejection).
    promise.then(
      () => pendingGetPlaylistMetadata.delete(url),
      () => pendingGetPlaylistMetadata.delete(url)
    )

    return promise
  })

  safeHandle('download:pause', async (_event, id: string) => {
    await queue?.pause(id)
  })

  safeHandle('download:pause-many', async (_event, ids: string[]) => {
    return queue?.pauseMany(ids) ?? []
  })

  safeHandle('download:resume', async (_event, id: string) => {
    await queue?.resume(id)
  })

  safeHandle('download:resume-many', async (_event, ids: string[]) => {
    return queue?.resumeMany(ids) ?? []
  })

  safeHandle('download:cancel', async (_event, id: string) => {
    await queue?.cancel(id)
    taskbar?.onRemoved(id)
    cleanupThumbnail(id)
  })

  safeHandle('download:remove', async (_event, id: string) => {
    await queue?.cancel(id)
    taskbar?.onRemoved(id)
    cleanupThumbnail(id)
  })

  /**
   * Reset the taskbar progress indicator to hidden. Called by the renderer
   * whenever the download list becomes empty for any reason (delete all,
   * completed cleanup, queue cleared) so a stale progress bar never lingers
   * on the Windows taskbar.
   */
  safeHandle('download:reset-taskbar', async () => {
    taskbar?.reset()
  })

  /**
   * Delete all files associated with a download: final file(s), .part chunks,
   * .partinfo metadata, and any other temp files the engine may have created.
   * Cancels the download first if it's still running so file handles are released.
   */
  safeHandle(
    'download:delete-download-files',
    async (
      _event,
      params: {
        id: string
        savePath: string
        filenames: string[]
      },
    ): Promise<{ success: boolean; error?: string }> => {
      const { id, savePath, filenames } = params
      console.log('[Main] delete-download-files', { id, savePath, filenames })

      // 1. Cancel the download first (releases file handles)
      try {
        await queue?.cancel(id)
      } catch {
        // Cancel may fail if the task doesn't exist — that's fine, proceed
      }

      // 2. Forget this download in the taskbar aggregate so a deleted download
      //    never leaves a stale progress bar behind.
      taskbar?.onRemoved(id)

      // 3. Remove the cached thumbnail (temp dir) for this download.
      cleanupThumbnail(id)

      // 4. Build all possible file paths for every known filename
      const allPaths: string[] = []

      for (const fn of filenames) {
        const finalPath = path.join(savePath, fn)
        const partInfoPath = finalPath + '.partinfo'

        allPaths.push(finalPath)
        allPaths.push(partInfoPath)

        // IDM-style staging file (<final>.part) — see IDM_COMPLETION_REPORT.md
        allPaths.push(finalPath + '.part')

        // Add .part0 through .part15 (generous upper bound for concurrent chunks)
        for (let i = 0; i < 16; i++) {
          allPaths.push(finalPath + `.part${i}`)
        }
      }

      // 5. Delete each file — missing files are not an error
      const deleted: string[] = []
      const failed: { path: string; error: string }[] = []

      for (const fp of allPaths) {
        try {
          if (fs.existsSync(fp)) {
            fs.unlinkSync(fp)
            deleted.push(fp)
            console.log('[Main] deleted file', fp)
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error('[Main] failed to delete', { path: fp, error: msg })
          failed.push({ path: fp, error: msg })
        }
      }

      if (failed.length > 0) {
        const summary = failed.map((f) => `${f.path}: ${f.error}`).join('; ')
        console.error('[Main] delete-download-files had errors', summary)
        return { success: false, error: `Failed to delete some files: ${summary}` }
      }

      console.log('[Main] delete-download-files complete', { deleted, count: deleted.length })
      return { success: true }
    },
  )

  safeHandle('download:delete-download-file', async (_event, params: { path: string }): Promise<{
    success: boolean
    error?: string
  }> => {
    console.log('[Main] delete file request', params)
    try {
      if (!fs.existsSync(params.path)) {
        console.log('[Main] file missing', params.path)
        return { success: false, error: 'File not found' }
      }
      console.log('[Main] file exists', params.path)
      console.log('[Main] deleting file', params.path)
      await fs.promises.unlink(params.path)
      console.log('[Main] delete success', params.path)
      return { success: true }
    } catch (err) {
      console.error('[Main] delete failed', err instanceof Error ? err.message : String(err))
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  safeHandle('download:open-file', async (_event, filePath: string) => {
    pipelineLog('OPEN_FILE', filePath)
    await shell.openPath(filePath)
  })

  safeHandle('download:open-folder', async (_event, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  safeHandle('download:delete-files', async (_event, filePaths: string[]): Promise<{
    deleted: string[]
    notFound: string[]
    failed: { path: string; error: string }[]
  }> => {
    console.log('[Main] delete files request', { count: filePaths.length, paths: filePaths })
    const deleted: string[] = []
    const notFound: string[] = []
    const failed: { path: string; error: string }[] = []

    for (const fp of filePaths) {
      try {
        if (fs.existsSync(fp)) {
          console.log('[Main] file exists', fp)
          console.log('[Main] deleting file', fp)
          fs.unlinkSync(fp)
          console.log('[Main] delete success', fp)
          deleted.push(fp)
        } else {
          console.log('[Main] file missing', fp)
          notFound.push(fp)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[Main] delete failed', { path: fp, error: msg })
        failed.push({ path: fp, error: msg })
      }
    }

    return { deleted, notFound, failed }
  })

  safeHandle('download:verify-files', async (_event, savePath: string, filenames: string[]) => {
    return filenames.map((name) => {
      const p = path.join(savePath, name)
      try {
        const stat = fs.statSync(p)
        return { path: p, exists: true, size: stat.size }
      } catch {
        return { path: p, exists: false, size: 0 }
      }
    })
  })

  safeHandle('downloads:save', async (_event, downloads: unknown[]) => {
    DownloadStoreService.save(downloads)
  })

  safeHandle('downloads:load', async () => {
    return DownloadStoreService.load()
  })

  safeHandle('download:generate-thumbnail', async (_event, downloadId: string, videoPath: string) => {
    // Thumbnail goes to the app temp dir (never the user's download folder)
    // and is returned as a self-contained data URL; see thumbnailManager.
    return generateThumbnail(downloadId, videoPath)
  })

  // Wipe the whole thumbnail temp directory when the app exits.
  app.on('will-quit', () => {
    cleanupAllThumbnails()
  })
}
