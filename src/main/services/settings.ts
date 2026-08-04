import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'

export interface AppSettings {
  downloadFolder: string
  concurrentDownloads: number
  theme: 'light' | 'dark' | 'system'
  autoUpdateYtDlp: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  downloadFolder: '',
  concurrentDownloads: 2,
  theme: 'system',
  autoUpdateYtDlp: true
}

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json')

async function ensureSettingsFile() {
  const dir = path.dirname(SETTINGS_PATH)

  await fs.mkdir(dir, { recursive: true })

  try {
    await fs.access(SETTINGS_PATH)
  } catch {
    await fs.writeFile(SETTINGS_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf8')
  }
}

export async function getSettings(): Promise<AppSettings> {
  await ensureSettingsFile()

  try {
    const text = await fs.readFile(SETTINGS_PATH, 'utf8')

    return {
      ...DEFAULT_SETTINGS,
      ...JSON.parse(text)
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export async function updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings()

  const next = {
    ...current,
    ...settings
  }

  await fs.writeFile(SETTINGS_PATH, JSON.stringify(next, null, 2), 'utf8')

  return next
}