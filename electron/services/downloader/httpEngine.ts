import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { DownloadEngine } from './engine.types'
import { DownloadOptions, DownloadProgress, ConnectionInfo, DownloadStatus } from './types'
import { DownloadEventBus } from './eventBus'
import { filenameFromUrl } from './urlType'
import { getTempArtifactRegexes } from './tempArtifacts'
import { pipelineLog } from './pipelineLogger'

/**
 * Runtime build verification (BUILD_RUNTIME_REPORT.md): print the absolute
 * path of the physical file this module was loaded from. In the bundled app
 * this resolves to the compiled bundle under out/ (or app.asar in a packaged
 * build), proving which artifact the running process actually loaded.
 * `__filename` is the CJS bundle path; in ESM output we fall back to
 * `import.meta.url`.
 */
const httpEngineModulePath =
  typeof __filename !== 'undefined' ? __filename : import.meta.url
console.log(`[httpEngine] module loaded from: ${httpEngineModulePath}`)

const DEFAULT_NUM_CONNECTIONS = 4
const MIN_CHUNK_SIZE = 1024 * 1024
const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 1000
const PROGRESS_INTERVAL_MS = 250
const SPEED_SMOOTHING_ALPHA = 0.3

interface HeadResult {
  acceptRanges: boolean
  contentLength: number
  etag: string | null
  lastModified: string | null
  contentDisposition: string | null
  contentMD5: string | null
}

interface ChunkState {
  index: number
  start: number
  end: number
  position: number
  downloaded: number
  speed: number
  host: string
  status: 'idle' | 'downloading' | 'completed' | 'failed'
  tempFile: string
  retryCount: number
  lastError: string | null
}

interface PartInfo {
  url: string
  totalBytes: number
  etag: string | null
  lastModified: string | null
  chunks: Array<{
    index: number
    start: number
    end: number
    downloaded: number
  }>
}

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

export class HttpEngine implements DownloadEngine {
  private state: EngineState = EngineState.Idle
  private chunks: ChunkState[] = []
  private totalBytes = 0
  private downloadedBytes = 0
  private filename = ''
  private outputPath = ''
  private partInfoPath = ''
  private abortController = new AbortController()
  private ewmaSpeed = 0
  private lastProgressTime = 0
  private lastProgressBytes = 0
  private lastEmitTime = 0
  private lastProgress: DownloadProgress | null = null
  private headResult: HeadResult | null = null
  private cdFromGetResponse: string | null = null

  constructor(
    private readonly options: DownloadOptions,
    private readonly eventBus: DownloadEventBus,
    private readonly numConnections = DEFAULT_NUM_CONNECTIONS
  ) {}

  getOptions(): DownloadOptions {
    return this.options
  }

  /**
   * The staging file the merged/streamed body is written to before being
   * atomically renamed to the final filename. Keeping the write target
   * distinct guarantees the final name only ever appears as a complete,
   * verified file (IDM_COMPLETION_REPORT.md).
   */
  private get stagingPath(): string {
    return this.outputPath + '.part'
  }

  async start(): Promise<void> {
    if (this.state === EngineState.Starting || this.state === EngineState.Downloading) return

    pipelineLog('START_DOWNLOAD', `${this.options.id} url=${this.options.url}`)
    this.state = EngineState.Starting
    this.abortController = new AbortController()
    this.filename = filenameFromUrl(this.options.url)
    this.outputPath = path.join(this.options.outputPath, this.filename)
    this.partInfoPath = this.outputPath + '.partinfo'

    const dir = path.dirname(this.outputPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    try {
      pipelineLog('HEAD_REQUEST', this.options.url)
      this.headResult = await this.headRequest(this.options.url)

      // Derive filename from Content-Disposition first, then from the URL
      const cdFilename = this.headResult.contentDisposition
      if (cdFilename) {
        this.filename = cdFilename
        this.outputPath = path.join(this.options.outputPath, this.filename)
        this.partInfoPath = this.outputPath + '.partinfo'
      }

      if (!this.headResult.acceptRanges || this.headResult.contentLength < MIN_CHUNK_SIZE) {
        this.totalBytes = this.headResult.contentLength
        await this.singleStreamDownload()
        return
      }

      this.totalBytes = this.headResult.contentLength
      this.ensureDiskSpace()
      this.buildChunks()
      pipelineLog('BUILD_CHUNKS', `${this.chunks.length} chunks`)
      this.state = EngineState.Downloading
      this.lastProgressTime = Date.now()
      this.lastProgressBytes = 0
      this.lastEmitTime = 0

      this.eventBus.log(this.options.id, `Starting multi-part download (${this.numConnections} connections, ${this.formatBytes(this.totalBytes)})`)

      const promises = this.chunks.map((chunk) => this.downloadChunkWithRetry(chunk))

      await Promise.all(promises)

      const failedChunk = this.chunks.find((c) => c.status !== 'completed')
      pipelineLog('ALL_CHUNKS_COMPLETED', `${this.chunks.length} chunks`)
      if (failedChunk) {
        const errMsg = failedChunk.lastError || `Chunk ${failedChunk.index} failed after ${MAX_RETRIES} retries`
        // Keep the .partN / .partinfo files — resume is still possible on the
        // next attempt (CLEANUP_REPORT.md: temp files are only removed after a
        // fully verified merge). The user can discard them explicitly via the
        // delete-download flow.
        this.state = EngineState.Failed
        this.emitFailed(errMsg)
        throw new Error(errMsg)
      }

      // Use Content-Disposition from GET response to correct filename before merge
      if (this.cdFromGetResponse && this.cdFromGetResponse !== this.filename) {
        // The .partinfo and any pre-rename staging file were written under the
        // old path; remove them so the rename cannot orphan them next to the
        // completed file.
        try {
          const oldStaging = this.outputPath + '.part'
          if (fs.existsSync(oldStaging)) fs.unlinkSync(oldStaging)
        } catch {
          // best-effort removal
        }
        this.cleanupPartInfo()
        this.filename = this.cdFromGetResponse
        this.outputPath = path.join(this.options.outputPath, this.filename)
        this.partInfoPath = this.outputPath + '.partinfo'
      }

      await this.mergeChunks()

      // If the download was paused/cancelled while chunks were being merged the
      // merge is incomplete — never mark it as Completed.
      if (this.abortController.signal.aborted || this.state !== EngineState.Downloading) {
        return
      }

      // IDM-style finalization — verify, then rename atomically
      // (IDM_COMPLETION_REPORT.md):
      //  1. the merged staging file exists on disk,
      //  2. its checksum matches the server's (when available).
      // Only when both pass is the staging file atomically renamed to the
      // final filename — the final name never appears as a partial file. On
      // failure the .partN / .partinfo files are kept — resume is still
      // possible.
      const stagingPath = this.stagingPath
      const stagingExists = fs.existsSync(stagingPath)
      pipelineLog('VERIFY_CHECKSUM', `contentMD5=${this.headResult?.contentMD5 ?? 'none'}`)
      const checksumOk = await this.verifyChecksum(stagingPath)

      if (!stagingExists || !checksumOk) {
        const reason = !stagingExists ? 'final file is missing' : 'checksum mismatch'
        // Remove only the untrustworthy staged output; keep the part files.
        try {
          if (fs.existsSync(stagingPath)) fs.unlinkSync(stagingPath)
        } catch {
          // best-effort removal (Windows may briefly hold the handle)
        }
        throw new Error(`Download integrity check failed (${reason}) — part files kept for resume`)
      }

      // Atomic rename on the same volume: the final filename appears only as
      // a complete, verified file.
      pipelineLog('RENAME_START', `${stagingPath} -> ${this.outputPath}`)
      try {
        fs.renameSync(stagingPath, this.outputPath)
        pipelineLog('RENAME_SUCCESS', this.outputPath)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        try {
          if (fs.existsSync(stagingPath)) fs.unlinkSync(stagingPath)
        } catch {
          // best-effort removal
        }
        throw new Error(`Failed to finalize download (${message}) — part files kept for resume`)
      }

      // Merge + checksum + rename all succeeded — remove every temp artifact:
      // .partN chunks, .partinfo, and any .resume file.
      this.removeTempArtifacts()

      this.verifyIntegrity()
      this.state = EngineState.Completed
      this.emitCompleted()
    } catch (error) {
      const st: string = this.state
      if (st === EngineState.Cancelled || st === EngineState.Paused) return
      this.state = EngineState.Failed
      this.emitProgress()
      this.emitFailed(error instanceof Error ? error.message : String(error))
      throw error
    }
  }

  pause(): void {
    if (this.state !== EngineState.Downloading) return
    this.state = EngineState.Paused
    this.abortController.abort()
    this.savePartInfo()
    this.emitPaused()
  }

  resume(): void {
    if (this.state !== EngineState.Paused) return
    this.state = EngineState.Starting
    this.start().catch(() => {})
  }

  async cancel(): Promise<void> {
    if (
      this.state === EngineState.Completed ||
      this.state === EngineState.Cancelled ||
      this.state === EngineState.Failed
    ) return
    this.state = EngineState.Cancelled
    this.abortController.abort()
    // Explicit user discard — remove every temp artifact (.partN, .partinfo,
    // .resume). This is the one deliberate exception to the keep-for-resume
    // rule: the user has asked to abandon the download.
    this.removeTempArtifacts()
  }

  private async headRequest(url: string, redirectCount = 0): Promise<HeadResult> {
    const MAX_REDIRECTS = 10
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url)
      const httpModule = parsedUrl.protocol === 'https:' ? https : http

      const req = httpModule.request(
        url,
        { method: 'HEAD', signal: this.abortController.signal },
        (res) => {
          const statusCode = res.statusCode ?? 0

          // Follow redirects
          if ([301, 302, 303, 307, 308].includes(statusCode)) {
            const location = res.headers.location
            if (location && redirectCount < MAX_REDIRECTS) {
              res.resume()
              const nextUrl = new URL(location, url).toString()
              resolve(this.headRequest(nextUrl, redirectCount + 1))
              return
            }
          }

          const acceptRanges = res.headers['accept-ranges'] === 'bytes'
          const contentLength = parseInt(res.headers['content-length'] ?? '0', 10) || 0
          const etag = (res.headers['etag'] as string) ?? null
          const lastModified = (res.headers['last-modified'] as string) ?? null
          const contentMD5 = (res.headers['content-md5'] as string) ?? null
          let contentDisposition: string | null = null
          const cd = res.headers['content-disposition']
          if (cd) {
            const cdStr = Array.isArray(cd) ? cd.join('') : cd
            const fnMatch = cdStr.match(/filename\*?=(?:UTF-8'')?([^;\s"']+)/i)
            if (fnMatch) {
              contentDisposition = decodeURIComponent(fnMatch[1].trim())
            }
          }
          res.resume()
          resolve({ acceptRanges, contentLength, etag, lastModified, contentDisposition, contentMD5 })
        }
      )

      req.on('error', (err) => {
        if (this.abortController.signal.aborted) return
        reject(err)
      })
      req.setTimeout(15000, () => {
        req.destroy()
        reject(new Error('HEAD request timed out'))
      })
      req.end()
    })
  }

  private ensureDiskSpace(): void {
    try {
      const stats = fs.statfsSync(this.options.outputPath)
      const freeBytes = stats.bfree * stats.bsize
      if (freeBytes < this.totalBytes) {
        this.eventBus.log(this.options.id, `Warning: Low disk space (free: ${this.formatBytes(freeBytes)}, needed: ${this.formatBytes(this.totalBytes)})`)
      }
    } catch {}
  }

  private buildChunks(): void {
    const existing = this.loadPartInfo()
    const isResume = existing !== null && existing.url === this.options.url && existing.totalBytes === this.totalBytes

    this.chunks = []
    this.downloadedBytes = 0

    if (isResume && this.etagMatches(existing)) {
      this.eventBus.log(this.options.id, 'Resuming previous download')

      for (const saved of existing.chunks) {
        const chunk: ChunkState = {
          index: saved.index,
          start: saved.start,
          end: saved.end,
          position: saved.start + saved.downloaded,
          downloaded: saved.downloaded,
          speed: 0,
          host: '',
          status: 'idle',
          tempFile: this.outputPath + `.part${saved.index}`,
          retryCount: 0,
          lastError: null
        }

        const tempExists = fs.existsSync(chunk.tempFile)
        const tempSize = tempExists ? fs.statSync(chunk.tempFile).size : 0

        if (tempSize >= saved.downloaded) {
          chunk.downloaded = tempSize
          chunk.position = chunk.start + tempSize
        }

        if (chunk.position > chunk.end) {
          chunk.status = 'completed'
          chunk.downloaded = chunk.end - chunk.start + 1
        }

        this.downloadedBytes += chunk.downloaded
        this.chunks.push(chunk)
      }
    } else {
      if (existing) {
        // Resume state doesn't match (URL / size / ETag changed) — resume is
        // not possible, so sweep the stale artifacts for a fresh start.
        this.removeTempArtifacts()
      }

      const chunkSize = Math.ceil(this.totalBytes / this.numConnections)
      for (let i = 0; i < this.numConnections; i++) {
        const start = i * chunkSize
        const end = i === this.numConnections - 1 ? this.totalBytes - 1 : Math.min(start + chunkSize - 1, this.totalBytes - 1)
        if (start > end) break

        this.chunks.push({
          index: i,
          start,
          end,
          position: start,
          downloaded: 0,
          speed: 0,
          host: '',
          status: 'idle',
          tempFile: this.outputPath + `.part${i}`,
          retryCount: 0,
          lastError: null
        })
      }
    }
  }

  private etagMatches(info: PartInfo): boolean {
    if (!this.headResult) return false
    if (info.etag && this.headResult.etag && info.etag === this.headResult.etag) return true
    if (info.lastModified && this.headResult.lastModified && info.lastModified === this.headResult.lastModified) return true
    if (!info.etag && !info.lastModified) return true
    if (!info.etag && !this.headResult.etag) return true
    return false
  }

  private async downloadChunkWithRetry(chunk: ChunkState): Promise<void> {
    while (chunk.retryCount <= MAX_RETRIES) {
      if (this.abortController.signal.aborted) return
      if (chunk.status === 'completed') return

      try {
        pipelineLog('DOWNLOAD_CHUNK_START', `chunk=${chunk.index} range=${chunk.position}-${chunk.end}`)
        await this.downloadChunk(chunk)

        // Verify the chunk actually received its full byte range. A truncated
        // response must retry (and eventually fail) instead of being silently
        // merged into a corrupt final file.
        const expectedBytes = chunk.end - chunk.start + 1
        if (chunk.downloaded !== expectedBytes) {
          throw new Error(`Chunk ${chunk.index} size mismatch: expected ${expectedBytes} bytes, received ${chunk.downloaded}`)
        }

        chunk.status = 'completed'
        pipelineLog('DOWNLOAD_CHUNK_FINISH', `chunk=${chunk.index} bytes=${chunk.downloaded}`)
        this.savePartInfo()
        return
      } catch (err) {
        chunk.retryCount++
        const message = err instanceof Error ? err.message : String(err)
        chunk.lastError = message

        if (chunk.retryCount > MAX_RETRIES || this.abortController.signal.aborted) {
          chunk.status = 'failed'
          this.eventBus.log(this.options.id, `Chunk ${chunk.index} failed: ${message}`)
          return
        }

        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, chunk.retryCount - 1)
        this.eventBus.log(this.options.id, `Chunk ${chunk.index} failed (attempt ${chunk.retryCount}/${MAX_RETRIES}), retrying in ${delay}ms: ${message}`)

        await this.sleep(delay)

        const st: string = this.state
        if (st === EngineState.Cancelled || st === EngineState.Paused) return
      }
    }
  }

  private downloadChunk(chunk: ChunkState): Promise<void> {
    return new Promise((resolve, reject) => {
      chunk.status = 'downloading'

      // Hoisted so the error/timeout handlers can close it (releasing the file
      // handle — otherwise Windows refuses to unlink the .part file later).
      let writeStream: fs.WriteStream | null = null

      const parsedUrl = new URL(this.options.url)
      const httpModule = parsedUrl.protocol === 'https:' ? https : http

      const rangeEnd = chunk.end
      const rangeStart = chunk.position

      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: '*/*',
        ...this.options.headers
      }

      if (rangeStart <= rangeEnd) {
        headers['Range'] = `bytes=${rangeStart}-${rangeEnd}`
      }

      const req = httpModule.request(
        this.options.url,
        {
          method: 'GET',
          headers,
          signal: this.abortController.signal
        },
        (response) => {
          const statusCode = response.statusCode ?? 0

          if (statusCode === 416) {
            resolve()
            return
          }

          if (statusCode < 200 || statusCode >= 300) {
            const msg = statusCode >= 600
              ? `HTTP ${statusCode} — CDN returned an error (the download URL may have expired). Try resolving the download URL again.`
              : `HTTP ${statusCode}`
            // Consume the response stream to free the socket for reuse
            response.resume()
            reject(new Error(msg))
            return
          }

          chunk.host = `${response.connection?.remoteAddress ?? '?'}:${response.connection?.remotePort ?? '?'}`

          // Capture Content-Disposition from GET response (first chunk that has it)
          if (!this.cdFromGetResponse) {
            const cd = response.headers['content-disposition']
            if (cd) {
              const cdStr = Array.isArray(cd) ? cd.join('') : cd
              const fnMatch = cdStr.match(/filename\*?=(?:UTF-8'')?([^;\s"']+)/i)
              if (fnMatch) {
                this.cdFromGetResponse = decodeURIComponent(fnMatch[1].trim())
              }
            }
          }

          const writeFlags = chunk.downloaded > 0 ? 'a' : 'w'
          writeStream = fs.createWriteStream(chunk.tempFile, { flags: writeFlags })
          let chunkStartTime = Date.now()
          let chunkBytesAtStart = chunk.downloaded

          writeStream.on('finish', () => resolve())
          writeStream.on('error', (err) => reject(err))

          response.on('data', (data: Buffer) => {
            if (this.abortController.signal.aborted) {
              writeStream?.destroy()
              return
            }

            writeStream?.write(data)
            chunk.downloaded += data.length
            this.downloadedBytes += data.length

            const elapsed = (Date.now() - chunkStartTime) / 1000
            if (elapsed >= 0.5) {
              // Instant throughput over this measurement window, in bytes/sec.
              const instantSpeed = Math.round((chunk.downloaded - chunkBytesAtStart) / elapsed)
              // EWMA so a stalled connection decays instead of inflating the average.
              chunk.speed = chunk.speed === 0
                ? instantSpeed
                : Math.round(SPEED_SMOOTHING_ALPHA * instantSpeed + (1 - SPEED_SMOOTHING_ALPHA) * chunk.speed)
              chunkStartTime = Date.now()
              chunkBytesAtStart = chunk.downloaded
            }

            this.updateSpeed()
            this.emitProgressThrottled()
          })

          response.on('end', () => {
            writeStream?.end()
          })
        }
      )

      req.on('error', (err) => {
        if (this.abortController.signal.aborted) return
        // Close the chunk's write stream so its file handle is released;
        // otherwise Windows can't unlink the .part file during the merge.
        writeStream?.destroy()
        reject(err)
      })

      req.setTimeout(30000, () => {
        req.destroy()
        writeStream?.destroy()
        reject(new Error(`Chunk ${chunk.index} timed out`))
      })

      req.end()
    })
  }

  private async singleStreamDownload(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const parsedUrl = new URL(this.options.url)
      const httpModule = parsedUrl.protocol === 'https:' ? https : http

      this.state = EngineState.Downloading
      this.lastProgressTime = Date.now()
      this.lastProgressBytes = 0
      this.lastEmitTime = 0

      // Hoisted so the error/timeout handlers can release the file handle.
      let writeStream: fs.WriteStream | null = null

      // IDM-style: the body streams into a staging file (<final>.part) and is
      // atomically renamed to the final name once verified — the final file
      // never appears partially written (IDM_COMPLETION_REPORT.md).
      const writeFlags = fs.existsSync(this.stagingPath) ? 'a' : 'w'
      let existingBytes = 0
      if (writeFlags === 'a') {
        try { existingBytes = fs.statSync(this.stagingPath).size } catch {}
      }
      this.downloadedBytes = existingBytes
      this.lastProgressBytes = existingBytes

      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: '*/*',
        ...this.options.headers
      }

      if (existingBytes > 0 && this.totalBytes > 0) {
        headers['Range'] = `bytes=${existingBytes}-`
      }

      const req = httpModule.request(
        this.options.url,
        { method: 'GET', headers, signal: this.abortController.signal },
        (response) => {
          const statusCode = response.statusCode ?? 0
          if (statusCode < 200 || statusCode >= 300) {
            const msg = statusCode >= 600
              ? `HTTP ${statusCode} — CDN returned an error (the download URL may have expired). Try resolving the download URL again.`
              : `HTTP ${statusCode}`
            // Consume the response stream to free the socket for reuse
            response.resume()
            reject(new Error(msg))
            return
          }

          if (this.totalBytes === 0) {
            this.totalBytes = parseInt(response.headers['content-length'] ?? '0', 10) || 0
          }

          // Capture Content-Disposition from GET response and correct filename before writing
          if (!this.cdFromGetResponse) {
            const cd = response.headers['content-disposition']
            if (cd) {
              const cdStr = Array.isArray(cd) ? cd.join('') : cd
              const fnMatch = cdStr.match(/filename\*?=(?:UTF-8'')?([^;\s"']+)/i)
              if (fnMatch) {
                this.cdFromGetResponse = decodeURIComponent(fnMatch[1].trim())
              }
            }
          }
          if (this.cdFromGetResponse && this.cdFromGetResponse !== this.filename) {
            this.filename = this.cdFromGetResponse
            this.outputPath = path.join(this.options.outputPath, this.filename)
            this.partInfoPath = this.outputPath + '.partinfo'
          }

          writeStream = fs.createWriteStream(this.stagingPath, { flags: writeFlags })

          writeStream.on('finish', () => {
            void (async () => {
              try {
                // Verify the completed file (size + checksum when available).
                const finalSize = fs.statSync(this.stagingPath).size
                if (this.totalBytes > 0 && finalSize !== this.totalBytes) {
                  // Keep the .part file — a retry resumes it (Range append).
                  throw new Error(`Size mismatch: expected ${this.totalBytes} bytes, got ${finalSize}`)
                }
                const checksumOk = await this.verifyChecksum(this.stagingPath)
                if (!checksumOk) {
                  throw new Error('Checksum mismatch — file kept for resume')
                }
                // Atomic rename: the final filename appears only as a complete
                // file, then sweep any stale .partN / .partinfo left by an
                // earlier multipart attempt of the same file.
                fs.renameSync(this.stagingPath, this.outputPath)
                this.removeTempArtifacts()
                this.state = EngineState.Completed
                this.emitCompleted()
                resolve()
              } catch (err) {
                reject(err instanceof Error ? err : new Error(String(err)))
              }
            })()
          })

          writeStream.on('error', (err) => reject(err))

          response.on('data', (chunk: Buffer) => {
            if (this.abortController.signal.aborted) {
              writeStream?.destroy()
              return
            }

            writeStream?.write(chunk)
            this.downloadedBytes += chunk.length
            this.updateSpeed()
            this.emitProgressThrottled()
          })

          response.on('end', () => {
            writeStream?.end()
          })
        }
      )

      req.on('error', (err) => {
        if (this.abortController.signal.aborted) {
          resolve()
          return
        }
        writeStream?.destroy()
        reject(err)
      })

      req.setTimeout(30000, () => {
        req.destroy()
        writeStream?.destroy()
        reject(new Error('Download timed out'))
      })

      req.end()
    })
  }

  /**
   * Merge all chunk temp files into the staging file (<final>.part).
   *
   * Order of operations (see MERGE_FIX_REPORT.md / IDM_COMPLETION_REPORT.md):
   *  1. All chunk write streams are already closed — downloadChunk() only
   *     resolves after its stream emits 'finish' (fd flushed & closed) and
   *     start() awaits every chunk before calling this.
   *  2. Chunks are merged sequentially, in index order.
   *  3. The merge stream is flushed ('end' → 'finish') and fsync'd.
   *  4. The merged size must equal the expected size; on mismatch this throws.
   *  5. Renaming + temp-file removal do NOT happen here — start() renames the
   *     staging file to the final name atomically, then deletes the .partN /
   *     .partinfo / .resume files only after the checksum and staging-file
   *     existence gates pass (see CLEANUP_REPORT.md).
   *  6. On any failure the part files are KEPT so the download can be
   *     retried/resumed without re-downloading (only the partial staged
   *     output is removed). Interruption (pause/cancel) also keeps them.
   */
  private async mergeChunks(): Promise<void> {
    pipelineLog('MERGE_START', `${this.chunks.length} chunks`)
    this.eventBus.log(this.options.id, 'Merging chunks...')
    this.emitProgress('merging')

    const stagingPath = this.stagingPath
    const writeStream = fs.createWriteStream(stagingPath)

    const removePartialOutput = (): void => {
      try {
        if (fs.existsSync(stagingPath)) fs.unlinkSync(stagingPath)
      } catch {
        // best-effort removal (Windows may briefly hold the handle)
      }
    }

    try {
      await new Promise<void>((resolve, reject) => {
        writeStream.on('error', (err) => reject(err))

        // Merge sequentially, in chunk order.
        try {
          for (const chunk of this.chunks) {
            if (this.abortController.signal.aborted) break
            pipelineLog(`MERGE_CHUNK_${chunk.index}`, `${chunk.tempFile}`)
            const data = fs.readFileSync(chunk.tempFile)
            writeStream.write(data)
          }
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)))
          return
        }

        // Flush the stream buffer before verifying.
        writeStream.end(() => resolve())
      })
    } catch (err) {
      writeStream.destroy()
      // Merge failed — keep .partN + .partinfo for resume. Only the partial
      // merged output is removed so it can't be mistaken for a complete file.
      removePartialOutput()
      const message = err instanceof Error ? err.message : String(err)
      this.eventBus.log(this.options.id, `Merge failed: ${message} — part files kept for resume`)
      throw err
    }

    if (this.abortController.signal.aborted) {
      // Paused/cancelled mid-merge: keep the .partN files and .partinfo so the
      // download can resume. cancel() performs the explicit cleanup.
      writeStream.destroy()
      this.eventBus.log(this.options.id, 'Merge interrupted — part files kept for resume')
      return
    }

    // Durably flush to disk before verifying ('r+' so fsync works on Windows).
    try {
      const fd = fs.openSync(stagingPath, 'r+')
      try {
        fs.fsyncSync(fd)
      } finally {
        fs.closeSync(fd)
      }
    } catch {
      // best-effort — the size check below still runs against flushed data
    }

    // Verify the merged file size equals the expected size.
    let finalSize = -1
    try {
      finalSize = fs.statSync(stagingPath).size
    } catch {
      finalSize = -1
    }

    pipelineLog('VERIFY_SIZE', `expected=${this.totalBytes} actual=${finalSize}`)
    if (finalSize !== this.totalBytes) {
      const msg = `Merge size mismatch: expected ${this.totalBytes} bytes, got ${finalSize}`
      this.eventBus.log(this.options.id, `${msg} — part files kept for resume`)
      removePartialOutput()
      throw new Error(msg)
    }

    // Size-verified. The staging file is NOT renamed and the .partN /
    // .partinfo / .resume files are NOT removed here — start() performs the
    // atomic rename and cleanup only after the checksum and staging-existence
    // gates pass (see IDM_COMPLETION_REPORT.md).
    pipelineLog('MERGE_FINISH', `size=${finalSize}`)
    this.eventBus.log(this.options.id, 'Merge completed (size verified)')
  }

  private verifyIntegrity(): void {
    // The size check itself is enforced in mergeChunks() (it throws on
    // mismatch), so this only logs the final completion message.
    try {
      const finalSize = fs.statSync(this.outputPath).size
      this.eventBus.log(this.options.id, `Download complete: ${this.filename} (${this.formatBytes(finalSize)})`)
    } catch {}
  }

  private updateSpeed(): void {
    const now = Date.now()
    const elapsed = (now - this.lastProgressTime) / 1000

    if (elapsed < 0.3) return

    const bytesDelta = this.downloadedBytes - this.lastProgressBytes
    const instantSpeed = elapsed > 0 ? Math.round(bytesDelta / elapsed) : 0

    if (this.ewmaSpeed === 0) {
      this.ewmaSpeed = instantSpeed
    } else {
      this.ewmaSpeed = Math.round(SPEED_SMOOTHING_ALPHA * instantSpeed + (1 - SPEED_SMOOTHING_ALPHA) * this.ewmaSpeed)
    }

    this.lastProgressTime = now
    this.lastProgressBytes = this.downloadedBytes
  }

  private emitProgressThrottled(): void {
    const now = Date.now()
    if (now - this.lastEmitTime < PROGRESS_INTERVAL_MS) return
    this.lastEmitTime = now
    this.emitProgress()
  }

  private emitProgress(status: DownloadStatus = 'downloading'): void {
    const speed = this.ewmaSpeed

    let eta = ''
    if (speed > 0 && this.totalBytes > 0) {
      const remaining = this.totalBytes - this.downloadedBytes
      const etaSec = remaining / speed
      eta = formatEta(etaSec)
    }

    const progressPct = this.totalBytes > 0
      ? Math.min((this.downloadedBytes / this.totalBytes) * 100, 99.9)
      : 0

    const connections: ConnectionInfo[] = this.chunks.map((c) => ({
      id: `chunk-${c.index}`,
      host: c.host || 'connecting...',
      speed: c.speed,
      status: c.status === 'completed' ? 'completed' : c.status === 'downloading' ? 'active' : c.status === 'failed' ? 'error' : 'idle'
    }))

    const progress: DownloadProgress = {
      id: this.options.id,
      status,
      progress: progressPct,
      speed,
      eta,
      downloadedBytes: this.downloadedBytes,
      totalBytes: this.totalBytes,
      filename: this.filename,
      connections
    }

    this.lastProgress = { ...progress }
    this.eventBus.progress(progress)
  }

  private emitCompleted(): void {
    pipelineLog('EMIT_COMPLETED', `${this.options.id} ${this.filename}`)
    let finalSize = 0
    try {
      finalSize = fs.statSync(this.outputPath).size
    } catch {}

    this.eventBus.progress({
      id: this.options.id,
      status: 'completed',
      progress: 100,
      speed: 0,
      eta: '',
      downloadedBytes: finalSize,
      totalBytes: finalSize,
      filename: this.filename
    })

    this.eventBus.completed(this.options.id)
  }

  private emitPaused(): void {
    this.eventBus.progress(
      this.lastProgress
        ? { ...this.lastProgress, status: 'paused', speed: 0, eta: 'Paused' }
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

  private emitFailed(error: string): void {
    this.eventBus.failed(this.options.id, error)
  }

  private loadPartInfo(): PartInfo | null {
    try {
      if (fs.existsSync(this.partInfoPath)) {
        const raw = fs.readFileSync(this.partInfoPath, 'utf8')
        return JSON.parse(raw) as PartInfo
      }
    } catch {}
    return null
  }

  private savePartInfo(): void {
    try {
      const info: PartInfo = {
        url: this.options.url,
        totalBytes: this.totalBytes,
        etag: this.headResult?.etag ?? null,
        lastModified: this.headResult?.lastModified ?? null,
        chunks: this.chunks.map((c) => {
          // Clamp the recorded progress to the bytes actually flushed to the
          // .partN file. On pause/abort the chunk's write stream may be
          // destroyed before its buffer drains, so the in-memory counter can
          // exceed what is on disk — persisting the inflated value would make a
          // later resume compute wrong chunk offsets.
          let downloaded = c.downloaded
          try {
            const tempSize = fs.existsSync(c.tempFile) ? fs.statSync(c.tempFile).size : 0
            if (tempSize < downloaded) downloaded = tempSize
          } catch {
            // keep the in-memory value
          }
          return {
            index: c.index,
            start: c.start,
            end: c.end,
            downloaded
          }
        })
      }
      fs.writeFileSync(this.partInfoPath, JSON.stringify(info), 'utf8')
    } catch {}
  }

  private cleanupPartInfo(): void {
    try {
      if (fs.existsSync(this.partInfoPath)) fs.unlinkSync(this.partInfoPath)
    } catch {}
  }

  /**
   * Remove every temporary artifact for this download: .partN chunks, the
   * staging file (<final>.part), .partinfo, and .resume. Deletes both the
   * chunks tracked in memory (which also covers files written under a
   * pre-rename base name) and any matching files found in the directory
   * (catching orphans not tracked in memory).
   */
  private removeTempArtifacts(): void {
    // Never scan when the output path hasn't been assigned yet — with an empty
    // base the directory sweep would target the working directory.
    if (!this.outputPath) return

    const dir = path.dirname(this.outputPath)
    const patterns = getTempArtifactRegexes(path.basename(this.outputPath))

    // 1. Tracked chunk temp files.
    for (const chunk of this.chunks) {
      try {
        if (fs.existsSync(chunk.tempFile)) {
          fs.unlinkSync(chunk.tempFile)
          pipelineLog(`DELETE_PART_${chunk.index}`, `${chunk.tempFile}`)
        }
      } catch {
        // best-effort removal (Windows may briefly hold the handle)
      }
    }

    // 2. Any matching artifact in the directory (also handles orphans).
    try {
      for (const entry of fs.readdirSync(dir)) {
        if (!patterns.some((re) => re.test(entry))) continue
        try {
          fs.unlinkSync(path.join(dir, entry))
          if (/\.partinfo$/i.test(entry)) {
            pipelineLog('DELETE_PARTINFO', entry)
          } else if (/\.resume$/i.test(entry)) {
            pipelineLog('DELETE_RESUME', entry)
          } else {
            const m = /\.part(\d+)$/i.exec(entry)
            pipelineLog(m ? `DELETE_PART_${m[1]}` : 'DELETE_PART', entry)
          }
        } catch {
          // best-effort removal
        }
      }
    } catch {
      // directory unreadable — tracked chunks were handled above
    }

    // 3. The staging file (<final>.part). It is not matched by the patterns
    //    above (they require digits / suffixes), so delete it explicitly.
    try {
      const staging = this.outputPath + '.part'
      if (fs.existsSync(staging)) fs.unlinkSync(staging)
    } catch {
      // best-effort removal
    }

    this.chunks = []
  }

  /** Stream an MD5 hash of a file (hex digest). */
  private hashFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5')
      const stream = fs.createReadStream(filePath)
      stream.on('data', (chunk) => hash.update(chunk))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }

  /**
   * Verify the merged file against the server-provided checksum.
   *
   * Strict: a Content-MD5 header (RFC 1864, base64-encoded MD5) is an
   * authoritative checksum — a mismatch returns false and blocks completion.
   *
   * Advisory: an MD5-shaped ETag is a cache key and is NOT guaranteed to be
   * the object's MD5 (e.g. CDNs, S3-style hashes), so a mismatch only logs a
   * warning and still returns true.
   *
   * When no checksum is available this returns true — the size check performed
   * in mergeChunks() is the integrity gate.
   */
  private async verifyChecksum(filePath: string): Promise<boolean> {
    const contentMD5 = this.headResult?.contentMD5
    if (contentMD5 && contentMD5.trim() !== '') {
      this.eventBus.log(this.options.id, 'Verifying merged file against Content-MD5...')
      try {
        const actualHex = await this.hashFile(filePath)
        const expectedHex = Buffer.from(contentMD5.trim(), 'base64').toString('hex')
        const ok = actualHex.toLowerCase() === expectedHex.toLowerCase()
        if (!ok) {
          this.eventBus.log(this.options.id, 'Content-MD5 mismatch — integrity check failed')
        }
        return ok
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        this.eventBus.log(this.options.id, `Checksum verification error: ${message}`)
        return true
      }
    }

    let checkedEtag = false
    const etag = this.headResult?.etag
    if (etag) {
      const clean = etag.replace(/^W\//i, '').replace(/"/g, '').trim()
      if (/^[0-9a-f]{32}$/i.test(clean)) {
        checkedEtag = true
        this.eventBus.log(this.options.id, 'Verifying merged file against ETag (advisory)...')
        try {
          const actualHex = await this.hashFile(filePath)
          if (actualHex.toLowerCase() !== clean.toLowerCase()) {
            this.eventBus.log(this.options.id, 'ETag checksum mismatch (advisory) — continuing with size-verified file')
          } else {
            this.eventBus.log(this.options.id, 'ETag checksum verified')
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          this.eventBus.log(this.options.id, `Checksum verification error: ${message}`)
        }
      }
    }

    if (!checkedEtag) {
      this.eventBus.log(this.options.id, 'No authoritative checksum (Content-MD5) — size verification used')
    }
    return true
  }

  private formatBytes(bytes: number): string {
    if (bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

function formatEta(seconds: number): string {
  if (seconds <= 0 || !isFinite(seconds)) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}
