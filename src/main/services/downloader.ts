import { BrowserWindow } from 'electron'
import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

import { getFfmpegPath, getYtDlpPath } from '../utils/binaries'
import { parseProgress } from '../utils/progress'

type Format = 'mp4' | 'mp3'

type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'cancelled' | 'completed' | 'error'

interface DownloadPayload {
  id: string
  url: string
  folder: string
  formatId: string
  format: Format
  type?: 'youtube' | 'file'
  filename?: string
  title?: string
  playlistId?: string
  playlistTitle?: string
  playlistIndex?: number
  playlistTotal?: number
}

interface ActiveDownload {
  payload: DownloadPayload
  process: ChildProcessWithoutNullStreams
  startedAt: number
}

interface PlaylistProgressState {
  total: number
  completed: number
  failed: number
  cancelled: number
  progress: Map<string, number>
  speed: Map<string, string>
  eta: Map<string, string>
}

interface DownloadState {
  status: DownloadStatus
  payload?: DownloadPayload
}

interface ProgressSample {
  percent: number
  speed: string
  eta: string
  timestamp: number
}

export class Downloader {
  private queue: DownloadPayload[] = []
  private readonly active = new Map<string, ActiveDownload>()
  private readonly states = new Map<string, DownloadState>()
  private readonly playlistProgress = new Map<string, PlaylistProgressState>()
  private readonly lastProgress = new Map<string, ProgressSample>()
  private readonly maxConcurrent = 2

  private getOrCreatePlaylistState(payload: DownloadPayload): PlaylistProgressState | null {
    if (!payload.playlistId || !payload.playlistTotal) {
      return null
    }

    let state = this.playlistProgress.get(payload.playlistId)

    if (!state) {
      state = {
        total: payload.playlistTotal,
        completed: 0,
        failed: 0,
        cancelled: 0,
        progress: new Map(),
        speed: new Map(),
        eta: new Map()
      }

      this.playlistProgress.set(payload.playlistId, state)
    }

    return state
  }

  private emitPlaylistProgress(playlistId: string, state: PlaylistProgressState, speed = '-', eta = '-') {
    const finished = state.completed + state.failed + state.cancelled
    const total = Math.max(state.total, 1)
    const runningProgress = [...state.progress.values()].reduce((sum, value) => sum + value, 0)
    const overall = finished === state.total ? 100 : (finished * 100 + runningProgress) / total

    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('playlist:progress', {
        playlistId,
        progress: overall,
        completed: state.completed,
        total: state.total,
        speed,
        eta
      })

      if (finished === state.total) {
        window.webContents.send('playlist:completed', { playlistId })
      }
    })

    if (finished === state.total) {
      this.playlistProgress.delete(playlistId)
    }
  }

  private setState(id: string, status: DownloadStatus, payload?: DownloadPayload) {
    this.states.set(id, { status, payload })
  }

  private getState(id: string) {
    return this.states.get(id)
  }

  async start(payload: DownloadPayload) {
    const state = this.getState(payload.id)

    if (state?.status === 'queued' || state?.status === 'downloading' || state?.status === 'paused') {
      return { success: true }
    }

    if (state?.status === 'completed' || state?.status === 'cancelled' || state?.status === 'error') {
      this.states.delete(payload.id)
    }

    this.queue = this.queue.filter((item) => item.id !== payload.id)
    this.queue.push(payload)
    this.setState(payload.id, 'queued', payload)

    this.processQueue()

    return { success: true }
  }

  async resume(payload: DownloadPayload) {
    const state = this.getState(payload.id)

    if (state?.status !== 'paused') {
      return { success: true }
    }

    this.states.delete(payload.id)
    return this.start(payload)
  }

  private async killProcess(childProcess: ChildProcessWithoutNullStreams) {
    if (!childProcess.pid) {
      return
    }

    if (process.platform === 'win32') {
      await new Promise<void>((resolve) => {
        const killer = spawn('taskkill', ['/pid', childProcess.pid!.toString(), '/T', '/F'], {
          windowsHide: true
        })

        killer.once('error', () => resolve())
        killer.once('close', () => resolve())
      })
      return
    }

    childProcess.kill('SIGTERM')
  }

  private async cleanupPartialFiles(payload: DownloadPayload) {
    try {
      if (!payload.folder) {
        return
      }

      const files = await fs.readdir(payload.folder).catch(() => [])
      const safeTitle = payload.title ? payload.title.replace(/[^\w-]/g, '') : null

      await Promise.all(
        files.map(async (file) => {
          if (!file.endsWith('.part') && !file.endsWith('.ytdl')) {
            return
          }

          if ((safeTitle && file.includes(safeTitle)) || (payload.filename && file.includes(payload.filename))) {
            await fs.unlink(path.join(payload.folder, file)).catch(() => {})
          }
        })
      )
    } catch (error) {
      console.error('[DOWNLOAD] Cleanup failed:', error)
    }
  }

  private markPlaylistCancelled(payload?: DownloadPayload) {
    if (!payload?.playlistId) {
      return
    }

    const playlistState = this.getOrCreatePlaylistState(payload)

    if (!playlistState) {
      return
    }

    playlistState.cancelled += 1
    playlistState.progress.delete(payload.id)
    playlistState.speed.delete(payload.id)
    playlistState.eta.delete(payload.id)
    this.emitPlaylistProgress(payload.playlistId, playlistState, '-', '-')
  }

  async cancel(id: string) {
    const state = this.getState(id)

    if (state?.status === 'cancelled' || state?.status === 'completed') {
      return { success: true }
    }

    if (state?.status === 'error') {
      this.states.set(id, { status: 'cancelled', payload: state.payload })
      this.markPlaylistCancelled(state.payload)
      this.sendCancelled(id)
      return { success: true }
    }

    if (state?.status === 'paused') {
      this.states.set(id, { status: 'cancelled', payload: state.payload })
      this.queue = this.queue.filter((item) => item.id !== id)
      this.markPlaylistCancelled(state.payload)
      this.sendCancelled(id)
      return { success: true }
    }

    const running = this.active.get(id)

    if (!running) {
      this.queue = this.queue.filter((item) => item.id !== id)
      this.states.set(id, { status: 'cancelled', payload: state?.payload })
      this.markPlaylistCancelled(state?.payload)
      this.sendCancelled(id)
      return { success: true }
    }

    this.setState(id, 'cancelled', running.payload)
    this.queue = this.queue.filter((item) => item.id !== id)
    this.markPlaylistCancelled(running.payload)

    await this.killProcess(running.process)
    this.active.delete(id)
    this.sendCancelled(id)
    await this.cleanupPartialFiles(running.payload)
    this.processQueue()

    return { success: true }
  }

  async pause(id: string) {
    const state = this.getState(id)

    if (state?.status === 'paused' || state?.status === 'cancelled' || state?.status === 'completed') {
      return { success: true }
    }

    if (state?.status === 'error') {
      this.states.set(id, { status: 'paused', payload: state.payload })
      this.sendPaused(id)
      return { success: true }
    }

    const running = this.active.get(id)

    if (!running) {
      const queued = this.queue.find((item) => item.id === id)

      if (queued) {
        this.setState(id, 'paused', queued)
        this.queue = this.queue.filter((item) => item.id !== id)
        this.sendPaused(id)
      }

      return { success: true }
    }

    this.setState(id, 'paused', running.payload)
    this.queue = this.queue.filter((item) => item.id !== id)

    await this.killProcess(running.process)
    this.active.delete(id)
    this.sendPaused(id)
    this.processQueue()

    return { success: true }
  }

  private processQueue() {
    while (this.active.size < this.maxConcurrent && this.queue.length > 0) {
      const payload = this.queue.shift()

      if (!payload) {
        break
      }

      this.download(payload)
    }
  }

  private download(payload: DownloadPayload) {
    const isFile = payload.type === 'file'
    const output =
      isFile && payload.filename ? path.join(payload.folder, payload.filename) : path.join(payload.folder, '%(title)s.%(ext)s')

    const args = isFile
      ? [payload.url, '-o', output]
      : payload.format === 'mp3'
        ? [
            payload.url,
            '-f',
            'bestaudio',
            '--extract-audio',
            '--audio-format',
            'mp3',
            '--ffmpeg-location',
            getFfmpegPath(),
            '-o',
            output
          ]
        : [
            payload.url,
            '-f',
            `${payload.formatId}+bestaudio/best`,
            '--merge-output-format',
            'mp4',
            '--ffmpeg-location',
            getFfmpegPath(),
            '-o',
            output
          ]

    this.setState(payload.id, 'downloading', payload)

    const child = spawn(getYtDlpPath(), args, {
      windowsHide: true
    })

    this.active.set(payload.id, {
      payload,
      process: child,
      startedAt: Date.now()
    })

    let finalFilePath: string | undefined

    const handleOutput = (text: string) => {
      const destMatch = text.match(/Destination:\s*(.+)$/i) || text.match(/Merging formats into "(.+)"$/i)
      if (destMatch?.[1]) {
        finalFilePath = destMatch[1].trim()
      }

      const progress = parseProgress(text)

      if (!progress) {
        return
      }

      const state = this.getState(payload.id)
      if (state?.status !== 'downloading') {
        return
      }

      const last = this.lastProgress.get(payload.id)
      const now = Date.now()
      const isSameUpdate =
        last &&
        Math.abs(last.percent - progress.percent) < 0.1 &&
        last.speed === progress.speed &&
        last.eta === progress.eta &&
        now - last.timestamp < 250

      if (isSameUpdate) {
        return
      }

      this.lastProgress.set(payload.id, {
        ...progress,
        timestamp: now
      })

      this.sendProgress(payload.id, progress)
      this.updatePlaylistProgress(payload, progress)
    }

    child.stdout.on('data', (buffer) => {
      handleOutput(buffer.toString())
    })

    child.stderr.on('data', (buffer) => {
      handleOutput(buffer.toString())
    })

    child.on('error', (error) => {
      const state = this.getState(payload.id)

      if (state?.status === 'paused' || state?.status === 'cancelled') {
        return
      }

      console.error('[DOWNLOAD ERROR]', error)

      this.active.delete(payload.id)
      this.lastProgress.delete(payload.id)
      this.setState(payload.id, 'error', payload)
      this.sendError(payload.id)
      this.processQueue()
    })

    child.on('close', (code) => {
      const state = this.getState(payload.id)

      this.active.delete(payload.id)
      this.lastProgress.delete(payload.id)

      if (state?.status === 'paused' || state?.status === 'cancelled') {
        this.processQueue()
        return
      }

      if (code === 0) {
        this.setState(payload.id, 'completed', payload)

        const playlistState = this.getOrCreatePlaylistState(payload)
        if (playlistState && payload.playlistId) {
          playlistState.completed += 1
          playlistState.progress.delete(payload.id)
          playlistState.speed.delete(payload.id)
          playlistState.eta.delete(payload.id)
          this.emitPlaylistProgress(payload.playlistId, playlistState, '-', '-')
        }

        this.sendCompleted(payload.id, finalFilePath || output)
      } else {
        this.setState(payload.id, 'error', payload)

        const playlistState = this.getOrCreatePlaylistState(payload)
        if (playlistState && payload.playlistId) {
          playlistState.failed += 1
          playlistState.progress.delete(payload.id)
          playlistState.speed.delete(payload.id)
          playlistState.eta.delete(payload.id)
          this.emitPlaylistProgress(payload.playlistId, playlistState, '-', '-')
        }

        this.sendError(payload.id)
      }

      this.processQueue()
    })
  }

  private updatePlaylistProgress(
    payload: DownloadPayload,
    progress: {
      percent: number
      speed: string
      eta: string
    }
  ) {
    const state = this.getOrCreatePlaylistState(payload)

    if (!state || !payload.playlistId) {
      return
    }

    state.progress.set(payload.id, progress.percent)
    state.speed.set(payload.id, progress.speed)
    state.eta.set(payload.id, progress.eta)

    this.emitPlaylistProgress(payload.playlistId, state, progress.speed, progress.eta)
  }

  private sendProgress(id: string, progress: { percent: number; speed: string; eta: string }) {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('download:progress', {
        id,
        progress: progress.percent,
        speed: progress.speed,
        eta: progress.eta
      })
    })
  }

  private sendCompleted(id: string, filePath?: string) {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('download:completed', { id, filePath })
    })
  }

  private sendCancelled(id: string) {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('download:cancelled', { id })
    })
  }

  private sendPaused(id: string) {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('download:paused', { id })
    })
  }

  private sendError(id: string) {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('download:error', { id })
    })
  }
}
