import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

import { DownloadMetadata, DownloadFormat, PlaylistMetadata, PlaylistEntry } from './metadata.types'
import { SettingsService } from '../settingsService'
import {
  normalizeCookiesMode,
  runYtDlpWithCookies,
  type YtDlpRunResult
} from './browserCookies'

const METADATA_TIMEOUT = 30_000

const isDev = !app.isPackaged

function logDebug(...args: unknown[]) {
  if (isDev) console.log('[MetadataService]', ...args)
}

function getResource(file: string) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'resources', file)
  }

  return path.join(process.cwd(), 'resources', file)
}

function mapYtDlpError(stderr: string): string {
  if (/private video/i.test(stderr)) return 'This video is private and cannot be accessed'
  if (/Video unavailable/i.test(stderr)) return 'This video has been removed or is unavailable'
  if (/age.restrict|sign in.*age/i.test(stderr)) return 'This video is age-restricted and requires sign-in'
  if (/not available|region|geo.restrict/i.test(stderr)) return 'This video is not available in your region'
  if (/copyright|takedown/i.test(stderr)) return 'This video has been removed due to a copyright claim'
  if (/members.only|member.only/i.test(stderr)) return 'This video is for channel members only'
  if (/playlist/i.test(stderr)) return 'Invalid playlist URL or playlist is empty'
  if (/unavailable/i.test(stderr)) return 'This content is unavailable'
  return 'Failed to fetch video metadata. Check the URL and try again.'
}

function extractDebugInfo(result: YtDlpRunResult, url: string): string {
  const lines: string[] = [`URL: ${url}`]
  if (result.code != null) lines.push(`Exit code: ${result.code}`)
  if (result.stdout) lines.push(`Stdout (first 500 chars): ${result.stdout.slice(0, 500)}`)
  if (result.stderr) lines.push(`Stderr: ${result.stderr}`)
  return lines.join('\n')
}

function handleExecError(result: YtDlpRunResult, url: string): never {
  const e = result

  logDebug('[MetadataService] exec failed:', {
    code: e.code,
    killed: e.killed,
    message: e.message,
    stdout: String(e.stdout ?? '').slice(0, 500),
    stderr: String(e.stderr ?? '').slice(0, 2000)
  })

  // Timeout (killed by execFile timeout)
  if (e.killed || (typeof e.message === 'string' && e.message.includes('timeout'))) {
    console.error(`[MetadataService] Timeout for URL: ${url}`)
    throw new Error('Metadata request timed out. Check your network or URL.')
  }

  // Missing executable
  if (e.code === 'ENOENT') {
    console.error(`[MetadataService] yt-dlp.exe not found at: ${getResource('yt-dlp.exe')}`)
    throw new Error('yt-dlp executable not found')
  }

  // Network errors
  if (e.code === 'ENOTFOUND' || e.code === 'EAI_AGAIN') {
    console.error(`[MetadataService] DNS lookup failed for URL: ${url}`)
    throw new Error('Network unavailable. Check your internet connection.')
  }
  if (e.code === 'ECONNREFUSED') {
    console.error(`[MetadataService] Connection refused for URL: ${url}`)
    throw new Error('Connection refused. The site may be blocking access.')
  }
  if (e.code === 'ETIMEDOUT' || e.code === 'ECONNABORTED') {
    console.error(`[MetadataService] Connection timed out for URL: ${url}`)
    throw new Error('Connection timed out. Check your network.')
  }

  // yt-dlp process error (non-zero exit)
  const stderr = String(e.stderr ?? '')
  const userMessage = mapYtDlpError(stderr)
  const debugInfo = extractDebugInfo(result, url)

  console.error(`[MetadataService] yt-dlp failed:\n${debugInfo}`)
  throw new Error(userMessage)
}

async function runMetadataCommand(url: string, baseArgs: string[]): Promise<YtDlpRunResult> {
  const settings = SettingsService.load()
  const mode = normalizeCookiesMode(settings.cookiesMode)

  const { result, cookieSource } = await runYtDlpWithCookies(mode, url, baseArgs, METADATA_TIMEOUT)
  logDebug(`[MetadataService] cookies mode: ${mode} -> source: ${cookieSource ?? 'none'}`)
  return result
}

export class MetadataService {
  static async fetch(url: string): Promise<DownloadMetadata> {
    const ytDlp = getResource('yt-dlp.exe')

    logDebug(`[MetadataService] yt-dlp path: ${ytDlp}`)

    if (!fs.existsSync(ytDlp)) {
      console.error('[MetadataService] yt-dlp.exe not found at', ytDlp)
      throw new Error('yt-dlp executable not found')
    }

    const args = ['--dump-single-json', '--no-warnings']
    logDebug(`[MetadataService] command: ${ytDlp} ${args.join(' ')}`)

    const start = Date.now()
    logDebug('[MetadataService] executing...')
    const result = await runMetadataCommand(url, args)
    logDebug(`[MetadataService] completed in ${Date.now() - start}ms`)
    if (!result.ok) handleExecError(result, url)

    let json: Record<string, unknown>
    try {
      json = JSON.parse(result.stdout)
    } catch {
      console.error('[MetadataService] Failed to parse yt-dlp output as JSON:', result.stdout.slice(0, 500))
      throw new Error('Received an unexpected response from the server')
    }

    const formats: DownloadFormat[] = (json.formats as any[] ?? []).map((f: any) => ({
      id: f.format_id,

      ext: f.ext,

      resolution: f.resolution ?? `${f.width ?? ''}x${f.height ?? ''}`,

      videoCodec: f.vcodec,

      audioCodec: f.acodec,

      fps: f.fps,

      filesize: f.filesize,

        filesize_approx: f.filesize_approx
    }))

    return {
      id: json.id as string,

      title: json.title as string,

      webpageUrl: json.webpage_url as string,

      uploader: json.uploader as string | undefined,

      duration: json.duration as number | undefined,

      thumbnail: json.thumbnail as string | undefined,

      description: json.description as string | undefined,

      isPlaylist: (json._type as string) === 'playlist',

      playlistCount: json.playlist_count as number | undefined,

      filesize: json.filesize as number | undefined,

      filesize_approx: json.filesize_approx as number | undefined,

      formats
    }
  }

  static async fetchPlaylist(url: string): Promise<PlaylistMetadata> {
    const ytDlp = getResource('yt-dlp.exe')

    logDebug(`[MetadataService] yt-dlp path: ${ytDlp}`)

    if (!fs.existsSync(ytDlp)) {
      console.error('[MetadataService] yt-dlp.exe not found at', ytDlp)
      throw new Error('yt-dlp executable not found')
    }

    const args = ['--dump-single-json', '--no-warnings', '--flat-playlist']
    logDebug(`[MetadataService] playlist command: ${ytDlp} ${args.join(' ')}`)

    const start = Date.now()
    logDebug('[MetadataService] playlist executing...')
    const result = await runMetadataCommand(url, args)
    logDebug(`[MetadataService] playlist completed in ${Date.now() - start}ms`)
    if (!result.ok) handleExecError(result, url)

    let json: Record<string, unknown>
    try {
      json = JSON.parse(result.stdout)
    } catch {
      console.error('[MetadataService] Failed to parse yt-dlp playlist output as JSON:', result.stdout.slice(0, 500))
      throw new Error('Received an unexpected response from the server')
    }

    const rawEntries = (json.entries as any[]) ?? []
    const entries: PlaylistEntry[] = rawEntries.map((e: any) => ({
      id: e.id,
      title: e.title ?? 'Unknown',
      url: e.url ?? e.webpage_url ?? `https://www.youtube.com/watch?v=${e.id}`,
      thumbnail: e.thumbnail ?? e.thumbnails?.[0]?.url,
      duration: e.duration,
      status: 'available'
    }))

    const availableCount = entries.length

    return {
      id: json.id as string,
      title: (json.title as string) ?? 'Untitled Playlist',
      url: (json.webpage_url as string) ?? url,
      uploader: (json.uploader as string) ?? (json.channel as string),
      thumbnail: json.thumbnail as string | undefined,
      videoCount: (json.playlist_count as number) ?? entries.length,
      availableCount,
      unavailableCount: 0,
      entries
    }
  }
}
