import { BrowserWindow, ipcMain } from 'electron'

export function registerWindowIpc() {
  ipcMain.handle('window:set-progress', (_, progress: number) => {
    const win = BrowserWindow.getAllWindows()[0]

    if (!win) return

    win.setProgressBar(progress)
  })
}
