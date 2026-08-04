import { create } from 'zustand'

export type AppPage = 'download' | 'queue' | 'history' | 'settings' | 'about'

interface AppStore {
  page: AppPage
  setPage: (page: AppPage) => void
}

export const useAppStore = create<AppStore>((set) => ({
  page: 'download',

  setPage: (page) => set({ page })
}))
