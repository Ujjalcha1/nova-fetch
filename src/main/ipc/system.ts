import { ipcMain, Notification, shell } from 'electron'

export function registerSystemIpc() {
  ipcMain.handle('system:openFolder', async (_, folder: string) => {
    await shell.openPath(folder)

    return {
      success: true
    }
  })

  ipcMain.handle(
    'system:notify',
    async (
      _,
      payload: {
        title: string
        body: string
      }
    ) => {
      new Notification({
        title: payload.title,
        body: payload.body
      }).show()

      return {
        success: true
      }
    }
  )
}
