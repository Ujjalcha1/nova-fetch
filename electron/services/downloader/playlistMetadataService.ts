import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

import { PlaylistMetadata, PlaylistEntry } from './metadata.types'
import {
  normalizeCookiesMode,
  runYtDlpWithCookies
} from './browserCookies'
import { SettingsService } from '../settingsService'

const PLAYLIST_TIMEOUT = 60_000

function getResource(file: string) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'resources', file)
  }

  return path.join(process.cwd(), 'resources', file)
}

function classifyEntry(entry: Record<string, unknown>): PlaylistEntry {
  const id = entry.id as string | null | undefined
  const title = (entry.title as string | undefined) ?? ''

  if (!id) {
    const reason = detectUnavailableReason(title)
    return { title: title || 'Unknown', status: 'unavailable', reason }
  }

  return {
    id,
    title,
    url: (entry.url as string) ?? (entry.webpage_url as string) ?? `https://www.youtube.com/watch?v=${id}`,
    thumbnail: (entry.thumbnail as string) ?? (entry.thumbnails as any[])?.[0]?.url,
    duration: entry.duration as number | undefined,
    status: 'available'
  }
}

function detectUnavailableReason(title: string): string {
  if (/private/i.test(title)) return 'private'
  if (/deleted|removed/i.test(title)) return 'removed'
  if (/unavailable/i.test(title)) return 'unavailable'
  if (/region|geo/i.test(title)) return 'region blocked'
  return 'unknown'
}

export class PlaylistMetadataService {
  static async fetch(url: string): Promise<PlaylistMetadata> {
    const ytDlp = getResource('yt-dlp.exe')

    if (!fs.existsSync(ytDlp)) {
      console.error('[PlaylistMetadataService] yt-dlp.exe not found at', ytDlp)
      throw new Error('yt-dlp executable not found')
    }

    const args = [
      '--dump-single-json',
      '--no-warnings',
      '--flat-playlist',
      '--ignore-errors'
    ]

    console.log(`[PlaylistMetadataService] Starting extraction for URL: ${url}`)

    const settings = SettingsService.load()
    const mode = normalizeCookiesMode(settings.cookiesMode)

    const start = Date.now()
    const run = await runYtDlpWithCookies(mode, url, args, PLAYLIST_TIMEOUT)
    const result = run.result
    console.log(
      `[PlaylistMetadataService] Completed in ${Date.now() - start}ms ` +
        `(cookies: ${run.cookieSource ?? 'none'})`
    )

    if (!result.ok) {
      if (result.killed || (typeof result.message === 'string' && result.message.includes('timeout'))) {
        throw new Error('Playlist request timed out. Check your network or URL.')
      }
      if (result.code === 'ENOENT') {
        throw new Error('yt-dlp executable not found')
      }
      console.error('[PlaylistMetadataService] yt-dlp failed:', result.stderr ?? result.message)
      throw new Error('Failed to fetch playlist metadata. Check the URL and try again.')
    }

    let json: Record<string, unknown>
    try {
      json = JSON.parse(result.stdout)
    } catch {
      console.error('[PlaylistMetadataService] Failed to parse yt-dlp output as JSON:', result.stdout.slice(0, 500))
      throw new Error('Received unexpected response from YouTube')
    }

    const rawEntries = (json.entries as any[]) ?? []
    const entries: PlaylistEntry[] = rawEntries.map(classifyEntry)
    const availableCount = entries.filter((e) => e.status === 'available').length
    const unavailableCount = entries.filter((e) => e.status === 'unavailable').length

    return {
      id: json.id as string,
      title: (json.title as string) ?? 'Untitled Playlist',
      url: (json.webpage_url as string) ?? url,
      uploader: (json.uploader as string) ?? (json.channel as string),
      thumbnail: json.thumbnail as string | undefined,
      videoCount: (json.playlist_count as number) ?? entries.length,
      availableCount,
      unavailableCount,
      entries
    }
  }
}
