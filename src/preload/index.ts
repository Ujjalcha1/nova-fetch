import { electronAPI } from '@electron-toolkit/preload'
import { contextBridge, ipcRenderer } from 'electron'

const api = {
  youtube: {
    analyze: (url: string) => ipcRenderer.invoke('youtube:analyze', url)
  },

  dialog: {
    selectFolder: () => ipcRenderer.invoke('dialog:select-folder')
  },

  settings: {
    get: () => ipcRenderer.invoke('settings:get'),

    update: (settings: unknown) => ipcRenderer.invoke('settings:update', settings)
  },

  system: {
    openFolder: (folder: string) => ipcRenderer.invoke('system:openFolder', folder),

    notify: (title: string, body: string) =>
      ipcRenderer.invoke('system:notify', {
        title,
        body
      })
  },

  download: {
    analyze: (url: string) => ipcRenderer.invoke('download:analyze', url),

    start: (payload: {
      id: string
      url: string
      folder: string
      formatId: string
      format: 'mp4' | 'mp3'
      type: 'youtube' | 'file'
      filename?: string
      title?: string

      playlistId?: string
      playlistTitle?: string
      playlistIndex?: number
      playlistTotal?: number
    }) => ipcRenderer.invoke('download:start', payload),

    startPlaylist: (payloads: any[]) => ipcRenderer.invoke('download:start-playlist', payloads),

    cancel: (id: string) => ipcRenderer.invoke('download:cancel', id),

    cancelPlaylist: (ids: string[]) => ipcRenderer.invoke('download:cancel-playlist', ids),

    pause: (id: string) => ipcRenderer.invoke('download:pause', id),

    pausePlaylist: (ids: string[]) => ipcRenderer.invoke('download:pause-playlist', ids),

    resume: (payload: any) => ipcRenderer.invoke('download:resume', payload),

    resumePlaylist: (payloads: any[]) => ipcRenderer.invoke('download:resume-playlist', payloads),

    delete: (filePath: string) => ipcRenderer.invoke('download:delete', filePath),
    openFile: (filePath: string) => ipcRenderer.invoke('download:open-file', filePath),
    openFolder: (folderPath: string) => ipcRenderer.invoke('download:open-folder', folderPath),

    onProgress: (
      callback: (data: { id: string; progress: number; speed: string; eta: string }) => void
    ) => {
      const listener = (
        _: Electron.IpcRendererEvent,
        data: {
          id: string
          progress: number
          speed: string
          eta: string
        }
      ) => callback(data)

      ipcRenderer.on('download:progress', listener)

      return () => {
        ipcRenderer.removeListener('download:progress', listener)
      }
    },

    onCompleted: (callback: (data: { id: string; filePath?: string }) => void) => {
      const listener = (
        _: Electron.IpcRendererEvent,
        data: {
          id: string
          filePath?: string
        }
      ) => callback(data)

      ipcRenderer.on('download:completed', listener)

      return () => {
        ipcRenderer.removeListener('download:completed', listener)
      }
    },

    onCancelled: (callback: (data: { id: string }) => void) => {
      const listener = (
        _: Electron.IpcRendererEvent,
        data: {
          id: string
        }
      ) => callback(data)

      ipcRenderer.on('download:cancelled', listener)

      return () => {
        ipcRenderer.removeListener('download:cancelled', listener)
      }
    },

    onError: (callback: (data: { id: string }) => void) => {
      const listener = (
        _: Electron.IpcRendererEvent,
        data: {
          id: string
        }
      ) => callback(data)

      ipcRenderer.on('download:error', listener)

      return () => {
        ipcRenderer.removeListener('download:error', listener)
      }
    },

    onPaused: (callback: (data: { id: string }) => void) => {
      const listener = (
        _: Electron.IpcRendererEvent,
        data: {
          id: string
        }
      ) => callback(data)

      ipcRenderer.on('download:paused', listener)

      return () => {
        ipcRenderer.removeListener('download:paused', listener)
      }
    },

    onPlaylistProgress: (
      callback: (data: {
        playlistId: string

        progress: number

        completed: number

        total: number

        speed: string

        eta: string
      }) => void
    ) => {
      const listener = (
        _: Electron.IpcRendererEvent,
        data: {
          playlistId: string

          progress: number

          completed: number

          total: number

          speed: string

          eta: string
        }
      ) => callback(data)

      ipcRenderer.on('playlist:progress', listener)

      return () => ipcRenderer.removeListener('playlist:progress', listener)
    },

    onPlaylistCompleted: (callback: (data: { playlistId: string }) => void) => {
      const listener = (
        _: Electron.IpcRendererEvent,
        data: {
          playlistId: string
        }
      ) => callback(data)

      ipcRenderer.on('playlist:completed', listener)

      return () => ipcRenderer.removeListener('playlist:completed', listener)
    }
  },

  setTaskbarProgress: (progress: number) => ipcRenderer.invoke('window:set-progress', progress)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)

    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI

  // @ts-ignore
  window.api = api
}
