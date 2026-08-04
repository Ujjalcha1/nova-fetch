import { create } from 'zustand'

type DialogStore = {
  showNewDownload: boolean
  initialUrl: string
  openNewDownload: (url?: string) => void
  closeNewDownload: () => void
  showSettings: boolean
  openSettings: () => void
  closeSettings: () => void
}

export const useDialogStore = create<DialogStore>((set) => ({
  showNewDownload: false,
  initialUrl: '',
  openNewDownload: (url) => set({ showNewDownload: true, initialUrl: typeof url === 'string' ? url : '' }),
  closeNewDownload: () => set({ showNewDownload: false, initialUrl: '' }),
  showSettings: false,
  openSettings: () => set({ showSettings: true }),
  closeSettings: () => set({ showSettings: false })
}))
