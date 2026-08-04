import { ipcMain } from 'electron'

import { getSettings, updateSettings } from '../services/settings'

export function registerSettingsIpc() {
  ipcMain.handle('settings:get', async () => {
    return getSettings()
  })

  ipcMain.handle('settings:update', async (_, settings) => {
    return updateSettings(settings)
  })
}