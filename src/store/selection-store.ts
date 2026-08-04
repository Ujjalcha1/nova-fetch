import { create } from 'zustand'

type SelectionStore = {
  selected: string[]

  toggle: (id: string) => void

  selectMany: (ids: string[]) => void

  clear: () => void
}

export const useSelectionStore = create<SelectionStore>((set) => ({
  selected: [],

  toggle: (id) =>
    set((state) => {
      if (state.selected.includes(id)) {
        return {
          selected: state.selected.filter((x) => x !== id)
        }
      }

      return {
        selected: [...state.selected, id]
      }
    }),

  selectMany: (ids) =>
    set({
      selected: ids
    }),

  clear: () =>
    set({
      selected: []
    })
}))
