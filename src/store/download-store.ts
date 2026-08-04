import { create } from 'zustand'
import { DownloadItem, DownloadPriority } from '../types/download'

type DownloadStore = {
  downloads: DownloadItem[]

  activeId: string | null

  addDownload: (download: DownloadItem) => void

  removeDownload: (id: string) => void

  updateDownload: (id: string, data: Partial<DownloadItem>) => void

  setPriority: (id: string, priority: DownloadPriority) => void

  selectDownload: (id: string) => void
}

export const useDownloadStore = create<DownloadStore>((set) => ({
  downloads: [],

  activeId: null,

  addDownload: (download) =>
    set((state) => ({
      downloads: [...state.downloads, download]
    })),

  removeDownload: (id) =>
    set((state) => {
      console.log('[Store] removing download', id)
      const remaining = state.downloads.filter((x) => x.id !== id)
      console.log('[Store] remaining downloads', remaining.length)
      return { downloads: remaining }
    }),

  updateDownload: (id, data) =>
    set((state) => ({
      downloads: state.downloads.map((d) => (d.id === id ? { ...d, ...data } : d))
    })),

  setPriority: (id, priority) =>
    set((state) => ({
      downloads: state.downloads.map((d) => (d.id === id ? { ...d, priority } : d))
    })),

  selectDownload: (id) =>
    set({
      activeId: id
    })
}))
