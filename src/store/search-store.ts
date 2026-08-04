import { create } from 'zustand'

/**
 * search-store — shared search query for the global toolbar search input.
 *
 * The Toolbar writes `rawQuery` (live value) and `query` (debounced).
 * DownloadList on the Downloads page reads `query`.
 */
type SearchStore = {
  /** Live input value — bound to the toolbar <input> */
  rawQuery: string
  /** Debounced query — passed to DownloadList filter */
  query: string
  setRaw: (v: string) => void
  setQuery: (v: string) => void
  clear: () => void
}

export const useSearchStore = create<SearchStore>((set) => ({
  rawQuery: '',
  query: '',
  setRaw: (v) => set({ rawQuery: v }),
  setQuery: (v) => set({ query: v }),
  clear: () => set({ rawQuery: '', query: '' }),
}))
