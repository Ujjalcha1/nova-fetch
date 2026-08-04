import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { BrowserCookieResolver, normalizeCookiesMode } from './downloader/browserCookies'

export interface AppSettings {
  defaultDownloadFolder: string
  concurrentDownloads: number
  theme: string
  autoUpdate: boolean
  language: string
  ffmpegPath: string
  ytDlpPath: string
  cookiesMode: string
  clipboardMonitor: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultDownloadFolder: '',
  concurrentDownloads: 3,
  theme: 'dark',
  autoUpdate: true,
  language: 'en',
  ffmpegPath: '',
  ytDlpPath: '',
  cookiesMode: 'auto',
  clipboardMonitor: false
}

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

export class SettingsService {
  static load(): AppSettings {
    try {
      const p = settingsPath()
      if (!fs.existsSync(p)) return { ...DEFAULT_SETTINGS }
      const raw = fs.readFileSync(p, 'utf8')
      const saved = JSON.parse(raw)
      const merged = { ...DEFAULT_SETTINGS, ...saved }

      // Migrate the legacy `cookiesBrowser` setting (a bare browser name) to the
      // new `cookiesMode` enum. Only applies when the new field was never saved.
      if (!('cookiesMode' in saved)) {
        const legacy = (saved as { cookiesBrowser?: unknown }).cookiesBrowser
        merged.cookiesMode = normalizeCookiesMode(legacy)
      }

      return merged
    } catch {
      return { ...DEFAULT_SETTINGS }
    }
  }

  static save(partial: Partial<AppSettings>): AppSettings {
    const current = this.load()
    const updated = { ...current, ...partial }
    const p = settingsPath()
    const dir = path.dirname(p)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(p, JSON.stringify(updated, null, 2), 'utf8')

    // A settings change may alter the cookie mode — drop cached browser results
    // so the next yt-dlp operation re-resolves the source.
    BrowserCookieResolver.instance.reset()

    return updated
  }
}
