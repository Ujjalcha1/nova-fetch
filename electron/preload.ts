import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  download: {
    start: (options) => ipcRenderer.invoke('download:start', options),

    pause: (id: string) => ipcRenderer.invoke('download:pause', id),

    pauseMany: (ids: string[]) => ipcRenderer.invoke('download:pause-many', ids),

    resume: (id: string) => ipcRenderer.invoke('download:resume', id),

    resumeMany: (ids: string[]) => ipcRenderer.invoke('download:resume-many', ids),

    cancel: (id: string) => {
      console.log('[IPC] cancel', { id })
      return ipcRenderer.invoke('download:cancel', id)
    },

    getMetadata: (url: string) => ipcRenderer.invoke('download:get-metadata', url),

    getPlaylistMetadata: (url: string) => ipcRenderer.invoke('download:get-playlist-metadata', url),

    headRequest: (url: string) => ipcRenderer.invoke('download:head-request', url),

    getDiskSpace: (dirPath: string) => ipcRenderer.invoke('download:get-disk-space', dirPath),

    getDefaultDownloadsPath: () => ipcRenderer.invoke('download:get-default-downloads-path'),

    selectFolder: () => ipcRenderer.invoke('download:select-folder'),

    onProgress: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('download:progress', handler)
      return () => ipcRenderer.removeListener('download:progress', handler)
    },

    onCompleted: (callback) => {
      const handler = (_event, id) => callback(id)
      ipcRenderer.on('download:completed', handler)
      return () => ipcRenderer.removeListener('download:completed', handler)
    },

    onFailed: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('download:failed', handler)
      return () => ipcRenderer.removeListener('download:failed', handler)
    },

    onLog: (callback) => {
      const handler = (_event, data) => callback(data)
      ipcRenderer.on('download:log', handler)
      return () => ipcRenderer.removeListener('download:log', handler)
    },

    openFile: (filePath: string) => ipcRenderer.invoke('download:open-file', filePath),

    openFolder: (filePath: string) => ipcRenderer.invoke('download:open-folder', filePath),

    deleteDownloadFile: (params: { path: string }) => {
      console.log('[IPC] deleteDownloadFile', params)
      return ipcRenderer.invoke('download:delete-download-file', params)
    },

    deleteFiles: (filePaths: string[]) => {
      console.log('[IPC] deleteFiles', filePaths)
      return ipcRenderer.invoke('download:delete-files', filePaths)
    },

    verifyFiles: (savePath: string, filenames: string[]) => ipcRenderer.invoke('download:verify-files', savePath, filenames),

    generateThumbnail: (downloadId: string, videoPath: string) => ipcRenderer.invoke('download:generate-thumbnail', downloadId, videoPath),

    getSettings: () => ipcRenderer.invoke('settings:load'),

    saveSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke('settings:save', settings),

    saveDownloads: (downloads: unknown[]) => ipcRenderer.invoke('downloads:save', downloads),

    loadDownloads: () => ipcRenderer.invoke('downloads:load'),

    deleteDownloadFiles: (params: { id: string; savePath: string; filenames: string[] }) =>
      ipcRenderer.invoke('download:delete-download-files', params),

    resetTaskbar: () => ipcRenderer.invoke('download:reset-taskbar')
  },

  clipboard: {
    startMonitoring: () => ipcRenderer.invoke('clipboard:start-monitoring'),

    stopMonitoring: () => ipcRenderer.invoke('clipboard:stop-monitoring'),

    onUrlDetected: (callback: (url: string) => void) => {
      const handler = (_event: unknown, url: string) => callback(url)
      ipcRenderer.on('clipboard:url-detected', handler)
      return () => ipcRenderer.removeListener('clipboard:url-detected', handler)
    }
  },

  rating: {
    showRatingDialog: () => ipcRenderer.invoke('rating:should-show'),

    submitRating: (payload: { downloadId: string; rating: number; comment?: string }) =>
      ipcRenderer.invoke('rating:submit', payload)
  }
})

contextBridge.exposeInMainWorld('electron', {
  update: {
    getCurrentVersion: () => ipcRenderer.invoke('update:get-current-version'),

    check: () => ipcRenderer.invoke('update:check'),

    getSettings: () => ipcRenderer.invoke('update:get-settings'),

    setSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke('update:set-settings', settings),

    download: (url: string) => ipcRenderer.invoke('update:download', url),

    launch: (installerPath: string) => ipcRenderer.invoke('update:launch', installerPath),

    onDownloadProgress: (callback: (data: { received: number; total: number; percent: number | null }) => void) => {
      const handler = (_event: unknown, data: { received: number; total: number; percent: number | null }) => callback(data)
      ipcRenderer.on('update:download-progress', handler)
      return () => ipcRenderer.removeListener('update:download-progress', handler)
    }
  }
})
