import { SettingsService, type AppSettings } from '../services/settingsService'
import { safeHandle } from './safeHandle'

export function registerSettingsIpc() {
  safeHandle('settings:load', async (): Promise<AppSettings> => {
    return SettingsService.load()
  })

  safeHandle('settings:save', async (_event, partial: Partial<AppSettings>): Promise<AppSettings> => {
    return SettingsService.save(partial)
  })
}
