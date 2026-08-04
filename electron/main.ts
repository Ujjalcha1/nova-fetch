import { app, BrowserWindow, Menu } from 'electron'
import path from 'node:path'
import { registerIpc } from './ipc'
import { runStartupUpdateCheck } from './services/updateStartup'
import { installThumbnailFsTrace } from './services/downloader/thumbnailTracer'

// Last-resort safety nets. Every ipcMain.handle is already routed through
// safeHandle() (see electron/ipc/safeHandle.ts), so these should never fire —
// but if anything else in the main process leaks a rejection, log it instead of
// letting Node print UnhandledPromiseRejectionWarning.
process.on('unhandledRejection', (reason) => {
  console.error('[Main] Unhandled promise rejection:', reason)
})

process.on('uncaughtException', (error) => {
  console.error('[Main] Uncaught exception:', error)
})

// Runtime instrumentation: trace every fs write whose destination looks like a
// thumbnail/image to logs/thumbnail-runtime.log (log-only, see
// THUMBNAIL_RUNTIME_REPORT.md).
installThumbnailFsTrace()

const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const wins = BrowserWindow.getAllWindows()
    if (wins.length > 0) {
      const w = wins[0]
      if (w.isMinimized()) w.restore()
      w.focus()
    }
  })

  app.whenReady().then(async () => {
    // Set the Windows App User Model ID so notifications, taskbar,
    // and Action Center use "NovaFetch" instead of "electron.app.Electron"
    app.setAppUserModelId('NovaFetch')

    Menu.setApplicationMenu(null)
    createWindow()

    registerIpc()

    // One-time update check after startup, gated on the persisted Auto Update
    // setting (see electron/services/updateStartup.ts). Check-only: no dialogs,
    // no downloads, no installs. Fire-and-forget so it never blocks the window.
    void runStartupUpdateCheck()
  }).catch((err) => {
    console.error('[Main] Failed during app startup:', err)
  })
}

function createWindow(): void {
  // Development mode: the electron-vite dev server is running (ELECTRON_RENDERER_URL
  // is only set by `electron-vite dev`) AND the app is not packaged. This excludes
  // both packaged production builds and unpackaged runs of built output.
  const isDev = !app.isPackaged && Boolean(process.env['ELECTRON_RENDERER_URL'])
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(
      app.isPackaged ? process.resourcesPath : process.cwd(),
      'resources',
      'icon.ico'
    ),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      // DevTools are only enabled in development (dev server running, app
      // unpackaged). In production this window can never open DevTools
      // (see DEVTOOLS_FIX_REPORT.md).
      devTools: isDev
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // Only development mode may open DevTools.
  if (isDev) {
    mainWindow.webContents.openDevTools()
  }

  // Defense-in-depth: even if devTools: false were bypassed, swallow the
  // standard DevTools shortcuts in production. The application menu is already
  // removed via Menu.setApplicationMenu(null), so there is no menu item either.
  if (!isDev) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      const isDevToolsShortcut =
        input.key === 'F12' ||
        (input.control && input.shift && input.key.toLowerCase() === 'i') ||
        (input.meta && input.alt && input.key.toLowerCase() === 'i')

      if (isDevToolsShortcut) {
        event.preventDefault()
      }
    })
  }
}
