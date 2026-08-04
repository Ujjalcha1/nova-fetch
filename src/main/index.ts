import { app, BrowserWindow, shell } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import path, { join } from 'node:path'
import { registerSettingsIpc } from './ipc/settings'
import icon from '../../resources/icon.png?asset'
import { registerWindowIpc } from './ipc/window'
import { registerYoutubeIpc } from './ipc/youtube'
import { registerDialogIpc } from './ipc/dialog'
import { registerSystemIpc } from './ipc/system'
import { registerDownloadIpc } from './ipc/download'

const iconPath = app.isPackaged
  ? path.join(process.resourcesPath, 'icon.ico')
  : path.join(process.cwd(), 'resources', 'icon.ico')

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    title: 'NovaFetch',
    icon: iconPath,

    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,

    show: false,
    autoHideMenuBar: true,

    ...(process.platform === 'linux' ? { icon } : {}),

    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)

    return {
      action: 'deny'
    }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.novafetch.desktop')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register IPC handlers
  registerYoutubeIpc()
  registerDialogIpc()
  registerSystemIpc()
  registerDownloadIpc()
  registerSettingsIpc()
  registerWindowIpc()
  // Create main window
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
