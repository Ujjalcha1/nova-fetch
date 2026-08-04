import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { HttpEngine } from '../httpEngine'
import type { DownloadEventBus } from '../eventBus'
import type { DownloadOptions } from '../types'

// The engine's event bus touches electron's BrowserWindow; the vitest node
// environment has none, so stub the module and pass a recording stub bus.
vi.mock('electron', () => ({ BrowserWindow: class BrowserWindow {} }))

const PORT = 18941
// 3 MiB > MIN_CHUNK_SIZE (1 MiB) so the multipart path is guaranteed.
const FILE_SIZE = 3 * 1024 * 1024
const PAYLOAD = Buffer.alloc(FILE_SIZE)
for (let i = 0; i < FILE_SIZE; i++) PAYLOAD[i] = (i * 31 + 7) % 251

let server: http.Server
let tmpDir: string

const LOG_PATH = path.join(process.cwd(), 'logs', 'download-pipeline.log')

beforeAll(() => {
  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
    if (url.pathname !== '/file.bin') {
      res.writeHead(404)
      res.end()
      return
    }

    // HEAD — used by the engine to discover ranges + size
    if (req.method === 'HEAD') {
      res.writeHead(200, {
        'Content-Length': String(FILE_SIZE),
        'Accept-Ranges': 'bytes',
        'Content-Type': 'application/octet-stream'
      })
      res.end()
      return
    }

    const range = req.headers.range
    if (range) {
      const m = /bytes=(\d+)-(\d+)?/.exec(range)
      const start = m ? parseInt(m[1], 10) : 0
      const end = m && m[2] ? parseInt(m[2], 10) : FILE_SIZE - 1
      const slice = PAYLOAD.subarray(start, end + 1)
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${FILE_SIZE}`,
        'Content-Length': String(slice.length),
        'Accept-Ranges': 'bytes',
        'Content-Type': 'application/octet-stream'
      })
      res.end(slice)
      return
    }

    res.writeHead(200, {
      'Content-Length': String(FILE_SIZE),
      'Accept-Ranges': 'bytes',
      'Content-Type': 'application/octet-stream'
    })
    res.end(PAYLOAD)
  })

  return new Promise<void>((resolve) => server.listen(PORT, resolve))
})

afterAll(() => {
  server?.close()
  if (tmpDir) {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      // best-effort cleanup
    }
  }
})

describe('multipart pipeline runtime instrumentation', () => {
  it('executes the full multipart pipeline and logs every stage to logs/download-pipeline.log', async () => {
    // Fresh log for this run — this is the runtime evidence.
    fs.rmSync(LOG_PATH, { force: true })
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipeline-runtime-'))

    const options: DownloadOptions = {
      id: 'runtime-evidence-1',
      url: `http://127.0.0.1:${PORT}/file.bin`,
      outputPath: tmpDir
    }

    const bus = {
      progress: () => {},
      completed: () => {},
      failed: () => {},
      log: () => {}
    } as unknown as DownloadEventBus

    const engine = new HttpEngine(options, bus)
    await engine.start()

    // The download itself must be real and complete.
    const finalPath = path.join(tmpDir, 'file.bin')
    expect(fs.existsSync(finalPath)).toBe(true)
    expect(fs.statSync(finalPath).size).toBe(FILE_SIZE)
    expect(fs.readFileSync(finalPath).equals(PAYLOAD)).toBe(true)

    // No temp artifacts may remain.
    const leftovers = fs.readdirSync(tmpDir).filter((f) => f.includes('.part'))
    expect(leftovers).toEqual([])

    // The runtime log must contain every stage, in pipeline order.
    const log = fs.readFileSync(LOG_PATH, 'utf8')
    const lines = log.split('\n').filter(Boolean)
    const stages = [...log.matchAll(/\[([A-Z0-9_]+)\]/g)].map((m) => m[1])

    const expected = [
      'START_DOWNLOAD',
      'HEAD_REQUEST',
      'BUILD_CHUNKS',
      'DOWNLOAD_CHUNK_START',
      'DOWNLOAD_CHUNK_FINISH',
      'ALL_CHUNKS_COMPLETED',
      'MERGE_START',
      'MERGE_CHUNK_0',
      'MERGE_CHUNK_1',
      'MERGE_CHUNK_2',
      'MERGE_CHUNK_3',
      'VERIFY_SIZE',
      'MERGE_FINISH',
      'VERIFY_CHECKSUM',
      'RENAME_START',
      'RENAME_SUCCESS',
      'DELETE_PART_0',
      'DELETE_PART_1',
      'DELETE_PART_2',
      'DELETE_PART_3',
      'DELETE_PARTINFO',
      'EMIT_COMPLETED'
    ]

    const positions = expected.map((s) => stages.indexOf(s))
    expect(positions).not.toContain(-1)

    // Strictly increasing order = the stages fired in pipeline sequence.
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1])
    }

    // Every line carries an ISO timestamp.
    for (const line of lines) {
      expect(line).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z \[/)
    }

    // Log the captured evidence for the report.
    console.log('\n=== PIPELINE LOG CAPTURE (logs/download-pipeline.log) ===\n' + log + '=======================================================')
  })
})
