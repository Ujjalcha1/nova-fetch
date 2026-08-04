import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'

export interface HttpDownloadProgress {
  /** Bytes received so far */
  downloadedBytes: number
  /** Total bytes expected (0 if unknown / chunked) */
  totalBytes: number
  /** Download speed in bytes/sec (smoothed over a 3 s window) */
  speed: number
}

export type HttpDownloadResult =
  | { success: true; filePath: string }
  | { success: false; error: string }

/**
 * Download a file over HTTP(S) using raw Node.js streams.
 *
 * ```ts
 * const dl = new HttpDownloader()
 * dl.start('https://example.com/file.zip', './out/file.zip', (p) => {
 *   console.log(`${p.downloadedBytes} / ${p.totalBytes} @ ${p.speed} B/s`)
 * })
 * // later …
 * dl.abort()
 * ```
 */
export class HttpDownloader {
  private controller = new AbortController()
  private downloadedBytes = 0
  private totalBytes = 0
  private speedSamples: Array<{ time: number; bytes: number }> = []
  private cleanupFns: Array<() => void> = []

  /** True once {@link abort} has been called. */
  get isAborted(): boolean {
    return this.controller.signal.aborted
  }

  /**
   * Begin downloading `url` to `outputPath`.
   *
   * @param url       – Remote file URL (http / https).
   * @param outputPath – Local filesystem path to write to.
   * @param onProgress – Called with progress updates during the download.
   * @param headers    – Optional extra HTTP headers.
   */
  start(
    url: string,
    outputPath: string,
    onProgress?: (progress: HttpDownloadProgress) => void,
    headers?: Record<string, string>,
  ): Promise<HttpDownloadResult> {
    // Create a fresh AbortController so previous cancellations don't carry over
    this.controller = new AbortController()
    this.downloadedBytes = 0
    this.totalBytes = 0
    this.speedSamples = []
    this.cleanupFns = []

    return this.doStart(url, outputPath, onProgress, headers)
  }

  /** Cancel an in-flight download.  Idempotent. */
  abort(): void {
    this.controller.abort()
    this.runCleanup()
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private runCleanup(): void {
    for (const fn of this.cleanupFns) {
      try {
        fn()
      } catch {
        // best-effort cleanup
      }
    }
    this.cleanupFns = []
  }

  private registerCleanup(fn: () => void): void {
    this.cleanupFns.push(fn)
  }

  private now(): number {
    return Date.now()
  }

  private computeSpeed(): number {
    // average over a sliding 3s window
    const cutoff = this.now() - 3000
    this.speedSamples = this.speedSamples.filter((s) => s.time >= cutoff)
    if (this.speedSamples.length < 2) return 0
    const oldest = this.speedSamples[0]
    const newest = this.speedSamples[this.speedSamples.length - 1]
    const elapsedSec = (newest.time - oldest.time) / 1000
    if (elapsedSec <= 0) return 0
    return Math.round((newest.bytes - oldest.bytes) / elapsedSec)
  }

  private doStart(
    url: string,
    outputPath: string,
    onProgress?: (progress: HttpDownloadProgress) => void,
    headers?: Record<string, string>,
  ): Promise<HttpDownloadResult> {
    // Ensure parent directory exists
    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return Promise.resolve({ success: false, error: `Cannot create output directory: ${msg}` })
      }
    }

    const parsedUrl = new URL(url)
    const httpModule = parsedUrl.protocol === 'https:' ? https : http

    return new Promise<HttpDownloadResult>((resolve) => {
      const req = httpModule.request(
        url,
        {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Accept: '*/*',
            ...headers,
          },
          signal: this.controller.signal,
        },
        (response) => {
          const statusCode = response.statusCode ?? 0

          // --- Follow redirects --------------------------------------------------
          if ([301, 302, 303, 307, 308].includes(statusCode)) {
            const location = response.headers.location
            if (location) {
              // Prevent accumulating stale cleanup
              this.runCleanup()
              resolve(
                this.doStart(
                  new URL(location, url).toString(),
                  outputPath,
                  onProgress,
                  headers,
                ),
              )
              return
            }
          }

          // --- Non-success status -------------------------------------------------
          if (statusCode < 200 || statusCode >= 300) {
            resolve({ success: false, error: `HTTP ${statusCode}` })
            return
          }

          this.totalBytes = parseInt(response.headers['content-length'] ?? '0', 10) || 0

          const writeStream = fs.createWriteStream(outputPath)
          this.registerCleanup(() => {
            writeStream.destroy()
            // remove the partial file
            fs.unlink(outputPath, () => { /* ignore */ })
          })

          writeStream.on('error', (err: NodeJS.ErrnoException) => {
            resolve({ success: false, error: `Write error: ${err.message}` })
          })

          writeStream.on('finish', () => {
            resolve({ success: true, filePath: outputPath })
          })

          response.on('data', (chunk: Buffer) => {
            if (this.controller.signal.aborted) return
            this.downloadedBytes += chunk.length
            this.speedSamples.push({ time: this.now(), bytes: this.downloadedBytes })

            onProgress?.({
              downloadedBytes: this.downloadedBytes,
              totalBytes: this.totalBytes,
              speed: this.computeSpeed(),
            })
          })

          response.pipe(writeStream)
        },
      )

      req.on('error', (err: Error) => {
        if (this.controller.signal.aborted) {
          resolve({ success: false, error: 'Cancelled' })
        } else {
          resolve({ success: false, error: err.message })
        }
      })

      // Abort the request on cancellation
      this.controller.signal.addEventListener(
        'abort',
        () => {
          req.destroy()
        },
        { once: true },
      )

      req.end()
    })
  }
}
