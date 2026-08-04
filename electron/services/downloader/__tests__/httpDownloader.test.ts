import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { HttpDownloader } from '../httpDownloader'

const PORT = 18923
const PAYLOAD = Buffer.from('x'.repeat(256 * 1024)) // 256 KiB
let server: http.Server

beforeAll(() => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
    const pathname = url.pathname

    // Redirect target
    if (pathname === '/redirect') {
      res.writeHead(302, { Location: '/file.bin' })
      res.end()
      return
    }

    // Slow download (send in chunks with delays)
    if (pathname === '/slow') {
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(PAYLOAD.length),
      })
      let sent = 0
      const interval = setInterval(() => {
        const chunk = PAYLOAD.subarray(sent, sent + 64 * 1024)
        res.write(chunk)
        sent += chunk.length
        if (sent >= PAYLOAD.length) {
          clearInterval(interval)
          res.end()
        }
      }, 50)
      return
    }

    // Standard file
    if (pathname === '/file.bin' || pathname === '/') {
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(PAYLOAD.length),
      })
      res.end(PAYLOAD)
      return
    }

    // Chunked (no Content-Length)
    if (pathname === '/chunked') {
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Transfer-Encoding': 'chunked',
      })
      res.end(PAYLOAD)
      return
    }

    // 404
    res.writeHead(404)
    res.end('Not Found')
  })

  return new Promise<void>((resolve) => server.listen(PORT, resolve))
})

afterAll(() => {
  server?.close()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HttpDownloader', () => {
  const tmpDir = path.join(os.tmpdir(), 'http-downloader-tests')

  beforeAll(() => {
    fs.mkdirSync(tmpDir, { recursive: true })
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  const outputPath = (name: string) => path.join(tmpDir, name)

  it('downloads a file and reports final success', async () => {
    const dl = new HttpDownloader()
    const out = outputPath('basic.bin')
    const result = await dl.start(`http://localhost:${PORT}/file.bin`, out)
    expect(result).toEqual({ success: true, filePath: out })
    expect(fs.existsSync(out)).toBe(true)
    expect(fs.statSync(out).size).toBe(PAYLOAD.length)
  })

  it('reports progress with correct totalBytes and downloadedBytes', async () => {
    const dl = new HttpDownloader()
    const out = outputPath('progress.bin')
    const progresses: Array<{ downloadedBytes: number; totalBytes: number }> = []

    await dl.start(`http://localhost:${PORT}/slow`, out, (p) => {
      progresses.push({ downloadedBytes: p.downloadedBytes, totalBytes: p.totalBytes })
    })

    expect(progresses.length).toBeGreaterThan(1)
    const last = progresses[progresses.length - 1]
    expect(last.totalBytes).toBe(PAYLOAD.length)
    expect(last.downloadedBytes).toBe(PAYLOAD.length)
  })

  it('reports speed during download', async () => {
    const dl = new HttpDownloader()
    const out = outputPath('speed.bin')
    const speeds: number[] = []

    await dl.start(`http://localhost:${PORT}/slow`, out, (p) => {
      if (p.speed > 0) speeds.push(p.speed)
    })

    // At least some progress events should have positive speed
    expect(speeds.length).toBeGreaterThanOrEqual(1)
    // Speed should be in a reasonable range for 64 KiB chunks every 50 ms
    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length
    expect(avgSpeed).toBeGreaterThan(100_000) // ~1 MB/s theoretical
    expect(avgSpeed).toBeLessThan(10_000_000) // not ridiculous
  })

  it('cancels an in-flight download', async () => {
    const dl = new HttpDownloader()
    const out = outputPath('cancel.bin')
    const progresses: number[] = []

    const promise = dl.start(`http://localhost:${PORT}/slow`, out, (p) => {
      progresses.push(p.downloadedBytes)
      // Cancel after receiving some data
      if (p.downloadedBytes > 0) {
        dl.abort()
      }
    })

    const result = await promise
    expect(result).toEqual({ success: false, error: 'Cancelled' })

    // File should either be absent or have partial content
    const exists = fs.existsSync(out)
    if (exists) {
      expect(fs.statSync(out).size).toBeLessThan(PAYLOAD.length)
    }
  })

  it('start works after abort (fresh AbortController per call)', async () => {
    const dl = new HttpDownloader()
    // Cancel a first attempt, then start a fresh download on the same instance
    const out1 = outputPath('abort-then-start-1.bin')
    const p1 = dl.start(`http://localhost:${PORT}/slow`, out1, (p) => {
      if (p.downloadedBytes > 0) dl.abort()
    })
    const r1 = await p1
    expect(r1).toEqual({ success: false, error: 'Cancelled' })

    // Now start again — should succeed with a fresh controller
    const out2 = outputPath('abort-then-start-2.bin')
    const r2 = await dl.start(`http://localhost:${PORT}/file.bin`, out2)
    expect(r2).toEqual({ success: true, filePath: out2 })
    expect(fs.statSync(out2).size).toBe(PAYLOAD.length)
  })

  it('handles chunked transfer (no content-length)', async () => {
    const dl = new HttpDownloader()
    const out = outputPath('chunked.bin')
    const result = await dl.start(`http://localhost:${PORT}/chunked`, out)
    expect(result).toEqual({ success: true, filePath: out })
    expect(fs.statSync(out).size).toBe(PAYLOAD.length)
  })

  it('handles 404 errors', async () => {
    const dl = new HttpDownloader()
    const out = outputPath('notfound.bin')
    const result = await dl.start(`http://localhost:${PORT}/notfound`, out)
    expect(result).toEqual({ success: false, error: 'HTTP 404' })
  })

  it('follows HTTP redirects', async () => {
    const dl = new HttpDownloader()
    const out = outputPath('redirect.bin')
    const result = await dl.start(`http://localhost:${PORT}/redirect`, out)
    expect(result).toEqual({ success: true, filePath: out })
    expect(fs.statSync(out).size).toBe(PAYLOAD.length)
  })

  it('isAborted reflects abort state', async () => {
    const dl = new HttpDownloader()
    expect(dl.isAborted).toBe(false)
    dl.abort()
    expect(dl.isAborted).toBe(true)
  })

  it('handles invalid URL gracefully', async () => {
    const dl = new HttpDownloader()
    const out = outputPath('invalid-url.bin')
    const result = await dl.start('http://invalid-url-that-does-not-exist.example/file.bin', out)
    expect(result.success).toBe(false)
    expect((result as { success: false; error: string }).error).toBeTruthy()
  })
})
