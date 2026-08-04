import { create } from 'zustand'
import type { AppSettings } from '../types/electron'
import { electron } from '../lib/electron'

interface SettingsState extends AppSettings {
  loaded: boolean
  loadSettings: () => Promise<void>
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
}

const defaults: AppSettings = {
  defaultDownloadFolder: '',
  concurrentDownloads: 3,
  maxRetries: 3,
  retryDelay: 30,
  theme: 'dark',
  autoUpdate: true,
  language: 'en',
  ffmpegPath: '',
  ytDlpPath: '',
  cookiesMode: 'auto',
  clipboardMonitor: false
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...defaults,
  loaded: false,

  loadSettings: async () => {
    const settings = await electron.getSettings()
    set({ ...settings, loaded: true })
  },

  updateSettings: async (partial) => {
    const updated = await electron.saveSettings(partial)
    set({ ...updated })
  }
}))
