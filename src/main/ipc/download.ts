import { ipcMain, shell } from 'electron'
import fs from 'node:fs/promises'

import { analyze } from '../services/analyzer'
import { Downloader } from '../services/downloader'
import { downloadQueue } from '../services/queue'

const downloader = new Downloader()

async function enqueueDownload(task: () => Promise<unknown>) {
  downloadQueue.add(async () => {
    try {
      await task()
    } catch (error) {
      console.error(error)
    }
  })
}

export function registerDownloadIpc() {
  ipcMain.handle('download:analyze', async (_, url: string) => {
    try {
      const result = await analyze(url)

      return result
    } catch (error) {
      console.error('[IPC] Analyze failed:', error)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Analyze failed'
      }
    }
  })

  ipcMain.handle('download:start', async (_, payload) => {
    await enqueueDownload(() => downloader.start(payload))

    return {
      success: true
    }
  })

  ipcMain.handle('download:start-playlist', async (_, payloads) => {
    for (const payload of payloads) {
      await enqueueDownload(() => downloader.start(payload))
    }

    return {
      success: true
    }
  })

  ipcMain.handle('download:pause', async (_, id: string) => {
    await downloader.pause(id)

    return {
      success: true
    }
  })

  ipcMain.handle('download:resume', async (_, payload) => {
    await enqueueDownload(() => downloader.resume(payload))

    return {
      success: true
    }
  })

  ipcMain.handle('download:cancel', async (_, id: string) => {
    await downloader.cancel(id)

    return {
      success: true
    }
  })

  ipcMain.handle('download:pause-playlist', async (_, ids: string[]) => {
    await Promise.all(ids.map((id) => downloader.pause(id)))

    return {
      success: true
    }
  })

  ipcMain.handle('download:resume-playlist', async (_, payloads) => {
    for (const payload of payloads) {
      await enqueueDownload(() => downloader.resume(payload))
    }

    return {
      success: true
    }
  })

  ipcMain.handle('download:cancel-playlist', async (_, ids: string[]) => {
    await Promise.all(ids.map((id) => downloader.cancel(id)))

    return {
      success: true
    }
  })

  ipcMain.handle('download:delete', async (_, filePath: string) => {
    try {
      await fs.unlink(filePath)

      return {
        success: true
      }
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as NodeJS.ErrnoException).code === 'ENOENT'
      ) {
        return {
          success: true,
          message: 'File not found'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed'
      }
    }
  })

  ipcMain.handle('download:open-file', async (_, filePath: string) => {
    try {
      shell.showItemInFolder(filePath)

      return {
        success: true
      }
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Open file failed'
      }
    }
  })

  ipcMain.handle('download:open-folder', async (_, folder: string) => {
    try {
      await shell.openPath(folder)

      return {
        success: true
      }
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Open folder failed'
      }
    }
  })
}
