import { create } from 'zustand'

export type Page = 'downloads' | 'scheduled' | 'completed' | 'history' | 'about'

type NavigationStore = {
  page: Page
  navigate: (page: Page) => void
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  page: 'downloads',
  navigate: (page) => set({ page })
}))
