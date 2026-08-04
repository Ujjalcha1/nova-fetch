import { ipcMain } from 'electron'
import { analyzeYoutube } from '../services/youtube'

export function registerYoutubeIpc() {
  ipcMain.handle('youtube:analyze', async (_, url: string) => {
    return analyzeYoutube(url)
  })
}
