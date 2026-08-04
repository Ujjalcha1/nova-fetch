import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

import { ProgressParser } from './progressParser'
import { DownloadOptions, DownloadFailure } from './types'
import { DownloadEventBus } from './eventBus'
import { traceCommand } from './thumbnailTracer'
import { SettingsService } from '../settingsService'
import {
  normalizeCookiesMode,
  isAuthRequiredError,
  AUTH_REQUIRED_MESSAGE,
  BrowserCookieResolver
} from './browserCookies'

function getResource(file: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'resources', file)
  }

  return path.join(process.cwd(), 'resources', file)
}

function mapYtDlpError(errorText: string, exitCode?: number): string {
  const lower = errorText.toLowerCase()

  // YouTube demands sign-in (bot-check / age gate) even after cookies.
  if (isAuthRequiredError(errorText)) {
    return AUTH_REQUIRED_MESSAGE
  }

  if (lower.includes('private video') || lower.includes('this video is private')) {
    return 'Private video'
  }
  if (
    (lower.includes('age') && lower.includes('restrict')) ||
    lower.includes('age verification') ||
    (lower.includes('age') && lower.includes('sign in'))
  ) {
    return 'Age-restricted video'
  }
  if (lower.includes('removed by the uploader')) {
    return 'Video removed by uploader'
  }
  if (lower.includes('removed for violating')) {
    return 'Video removed (ToS violation)'
  }
  if (
    lower.includes('not available in your country') ||
    lower.includes('blocked it in your country') ||
    lower.includes('not made this video available')
  ) {
    return 'Region blocked'
  }
  if (lower.includes('no space left on device')) {
    return 'Disk full'
  }
  if (lower.includes('permission denied')) {
    return 'Permission denied'
  }
  if (lower.includes('ffmpeg') || lower.includes('ffprobe')) {
    return 'FFmpeg not found'
  }
  if (lower.includes('unavailable') || lower.includes('this video is not available')) {
    return 'Video unavailable'
  }
  if (lower.includes('sign in') && lower.includes('confirm your age')) {
    return 'Age verification required'
  }
  if (lower.includes('sign in') || lower.includes('login required')) {
    return 'Login required'
  }
  if (lower.includes('copyright') || lower.includes('takedown')) {
    return 'Video blocked (copyright claim)'
  }
  if (lower.includes('members-only') || lower.includes('member only')) {
    return 'Members-only video'
  }
  if (lower.includes('enotfound')) {
    return 'Network error: DNS resolution failed'
  }
  if (lower.includes('econnrefused')) {
    return 'Network error: connection refused'
  }
  if (lower.includes('etimedout') || lower.includes('timeout')) {
    return 'Network error: connection timed out'
  }
  if (lower.includes('econnreset')) {
    return 'Network error: connection reset'
  }
  if (lower.includes('enetunreach')) {
    return 'Network error: network unreachable'
  }
  if (lower.includes('econnaborted')) {
    return 'Network error: connection aborted'
  }
  if (lower.includes('enoent')) {
    return 'File not found'
  }

  return `Unknown yt-dlp error (exit code ${exitCode ?? 'N/A'})`
}

export class YtDlpService {
  static async download(
    options: DownloadOptions,
    eventBus: DownloadEventBus,
    isActive?: () => boolean,
  ): Promise<ChildProcessWithoutNullStreams> {

    const ytDlp = getResource('yt-dlp.exe')
    const ffmpeg = getResource('ffmpeg.exe')

    if (!fs.existsSync(ytDlp)) {
      throw new Error(`yt-dlp.exe not found: ${ytDlp}`)
    }

    if (!fs.existsSync(ffmpeg)) {
      throw new Error(`ffmpeg.exe not found: ${ffmpeg}`)
    }

    const args: string[] = [
      '--newline',
      '--progress',

      '--continue',

      '--ffmpeg-location',
      ffmpeg,

      '-o',
      path.join(options.outputPath, '%(title)s.%(ext)s'),

      options.url,
    ]

    if (options.format) {
      args.unshift('--format', options.format)
    }

    if (options.noPlaylist) {
      args.unshift('--no-playlist')
    }

    const settings = SettingsService.load()
    const cookiesMode = normalizeCookiesMode(settings.cookiesMode)
    const cookieSource = await BrowserCookieResolver.instance.resolve(cookiesMode, options.url)
    if (cookieSource) {
      args.unshift('--cookies-from-browser', cookieSource)
      eventBus.log(options.id, `Using browser cookies: ${cookieSource}`)
    }

    const commandStr = `"${ytDlp}" ${args.join(' ')}`

    // Runtime proof: log the exact yt-dlp command and output template so we
    // can see whether yt-dlp is ever asked to write a thumbnail.
    traceCommand('yt-dlp', commandStr, 'outputTemplate=' + path.join(options.outputPath, '%(title)s.%(ext)s'))

    let exitCode: number | undefined

    const child = spawn(ytDlp, args, {
      windowsHide: true,
    })

    let stdoutAcc = ''
    let stderrAcc = ''
    Object.defineProperty(child, 'stderrLog', {
      get: () => stderrAcc,
      enumerable: false,
      configurable: true,
    })
    let maxTotalBytes = 0
    let lastFilename = ''
    let hasMerged = false
    let failedEmitted = false
    let errorFromStderr: string | undefined

    eventBus.log(options.id, 'Download started')

    // -----------------------------------------------------------------------
    // stdout handler — parses progress lines and emits via the event bus
    // -----------------------------------------------------------------------

    child.stdout.on('data', (chunk: Buffer) => {
      // ---- GUARD: task state -------------------------------------------------
      // If the owning DownloadTask has left the Downloading state (paused,
      // cancelled, etc.), silently drop ALL buffered data.  This is the
      // primary defence against stale progress events reaching the renderer.
      if (isActive && !isActive()) {
        // Clear the accumulator so buffered data from this chunk is
        // discarded instead of processed when/if the task resumes.
        stdoutAcc = ''
        return
      }

      // ---- GUARD: process state ----------------------------------------------
      // Even if the task thinks it's Downloading, the child process may
      // have been killed or exited before this data event was delivered.
      if (child.killed || child.exitCode !== null || child.signalCode !== null) {
        stdoutAcc = ''
        return
      }

      stdoutAcc += chunk.toString('utf8')

      const lines = stdoutAcc.split(/\r?\n/)

      stdoutAcc = lines.pop() ?? ''

      for (const line of lines) {
        const text = line.trim()

        if (!text) continue

        if (ProgressParser.isDestination(text)) {
          const fn = ProgressParser.extractDestinationFilename(text)
          if (fn) lastFilename = fn
          continue
        }

        if (ProgressParser.isMerging(text)) {
          hasMerged = true
          const mergedFn = ProgressParser.extractMergedFilename(text)
          if (mergedFn) lastFilename = mergedFn
          eventBus.log(options.id, 'Merging formats...')
          continue
        }

        if (ProgressParser.isCompleted(text)) {
          if (hasMerged) eventBus.log(options.id, 'Merge completed')

          eventBus.log(options.id, 'Download completed')
          continue
        }

        const progress = ProgressParser.parse(text)

        if (!progress) continue

        if (progress.totalBytes > maxTotalBytes) {
          maxTotalBytes = progress.totalBytes
        }

        const cappedProgress = Math.min(progress.progress, 99.9)

        eventBus.progress({
          id: options.id,
          status: 'downloading',
          progress: cappedProgress,
          speed: progress.speedBytes,
          eta: progress.eta,
          downloadedBytes: progress.downloadedBytes,
          totalBytes: maxTotalBytes,
          filename: lastFilename || undefined,
        })
      }
    })

    // -----------------------------------------------------------------------
    // stderr handler — only captures error messages, never emits progress
    // -----------------------------------------------------------------------

    child.stderr.on('data', (chunk: Buffer) => {
      // Guard: don't process stderr if the owning task is no longer active.
      if (isActive && !isActive()) return
      if (child.killed || child.exitCode !== null || child.signalCode !== null) return

      const text = chunk.toString('utf8')
      stderrAcc += text

      const trimmed = text.trim()
      if (!trimmed) return

      if (trimmed.includes('ERROR:') && !errorFromStderr) {
        errorFromStderr = trimmed
        eventBus.log(options.id, trimmed)
      }
    })

    // -----------------------------------------------------------------------
    // Process lifecycle handlers
    // -----------------------------------------------------------------------

    function buildFailure(): DownloadFailure {
      return {
        exitCode,
        stderr: stderrAcc || undefined,
        stdout: stdoutAcc || undefined,
        command: commandStr,
      }
    }

    child.on('error', (error) => {
      // Guard: if the owning task has already left the Downloading state
      // (pause / cancel), suppress error events from a killed process.
      if (isActive && !isActive()) return
      if (child.killed) return

      failedEmitted = true
      const raw = error.message
      const friendly = mapYtDlpError(raw + '\n' + stderrAcc)
      eventBus.log(options.id, raw)
      eventBus.failed(options.id, friendly, buildFailure())
    })

    child.on('close', (code) => {
      exitCode = code ?? undefined

      // Intentional kill (pause/cancel) — lifecycle managed by DownloadTask,
      // don't emit terminal event.
      if (child.killed) return

      if (code === 0) {
        let finalSize = maxTotalBytes

        if (lastFilename) {
          try {
            const filePath = path.join(options.outputPath, lastFilename)
            const stat = fs.statSync(filePath)
            if (stat.size > 0) finalSize = stat.size
          } catch {
            // file not found or inaccessible — use maxTotalBytes
          }
        }

        if (finalSize > 0) {
          maxTotalBytes = finalSize
        }

        eventBus.progress({
          id: options.id,
          status: 'completed',
          progress: 100,
          speed: 0,
          eta: '',
          downloadedBytes: maxTotalBytes,
          totalBytes: maxTotalBytes,
          filename: lastFilename || undefined,
        })

        eventBus.completed(options.id)
        return
      }

      if (failedEmitted) return

      failedEmitted = true

      const raw =
        errorFromStderr || stderrAcc.trim() || `yt-dlp exited with code ${code}`
      const friendly = mapYtDlpError(raw, code ?? undefined)
      eventBus.failed(options.id, friendly, buildFailure())
    })

    return child
  }
}
