import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { QueueItem } from '../types/queue'

interface PlaylistSummary {
  playlistId: string
  title?: string
  total: number
  completed: number
  failed: number
  cancelled: number
  paused: number
  downloading: number
  waiting: number
  remaining: number
  progress: number
}

interface QueueStore {
  queue: QueueItem[]

  add: (item: QueueItem) => void
  addMany: (items: QueueItem[]) => void

  update: (id: string, data: Partial<QueueItem>) => void
  updatePlaylist: (playlistId: string, data: Partial<QueueItem>) => void

  remove: (id: string) => void
  removePlaylist: (playlistId: string) => void

  pausePlaylist: (playlistId: string) => void
  resumePlaylist: (playlistId: string) => void
  cancelPlaylist: (playlistId: string) => void

  clearCompleted: () => void

  getPlaylistSummary: (playlistId: string) => PlaylistSummary
  getPlaylistProgress: (playlistId: string) => {
    total: number
    completed: number
    progress: number
  }
}

function isTerminal(status: QueueItem['status']) {
  return status === 'completed' || status === 'cancelled' || status === 'error'
}

function shouldReplaceExisting(existing: QueueItem, incoming: QueueItem) {
  return isTerminal(existing.status) && incoming.status === 'waiting'
}

function sameQueueItem(item: QueueItem, next: Partial<QueueItem>) {
  return Object.entries(next).every(
    ([key, value]) => (item as unknown as Record<string, unknown>)[key] === value
  )
}

function buildPlaylistSummary(playlistId: string, items: QueueItem[]): PlaylistSummary {
  const total = items.length
  const completed = items.filter((item) => item.status === 'completed').length
  const failed = items.filter((item) => item.status === 'error').length
  const cancelled = items.filter((item) => item.status === 'cancelled').length
  const paused = items.filter((item) => item.status === 'paused').length
  const downloading = items.filter((item) => item.status === 'downloading').length
  const waiting = items.filter((item) => item.status === 'waiting').length
  const remaining = Math.max(total - completed - failed - cancelled, 0)
  const progress = total === 0 ? 0 : items.reduce((sum, item) => sum + item.progress, 0) / total
  const title = items[0]?.playlistTitle ?? items[0]?.title

  return {
    playlistId,
    title,
    total,
    completed,
    failed,
    cancelled,
    paused,
    downloading,
    waiting,
    remaining,
    progress
  }
}

export const useQueueStore = create<QueueStore>()(
  persist(
    (set, get) => ({
      queue: [],

      add: (item) =>
        set((state) => {
          const existingIndex = state.queue.findIndex((queueItem) => queueItem.id === item.id)

          if (existingIndex !== -1) {
            const existing = state.queue[existingIndex]

            if (!shouldReplaceExisting(existing, item)) {
              return state
            }

            const nextQueue = [...state.queue]
            nextQueue[existingIndex] = item

            return { queue: nextQueue }
          }

          return {
            queue: [...state.queue, item]
          }
        }),

      addMany: (items) =>
        set((state) => {
          let nextQueue = state.queue
          let changed = false

          for (const item of items) {
            const existingIndex = nextQueue.findIndex((queueItem) => queueItem.id === item.id)

            if (existingIndex !== -1) {
              const existing = nextQueue[existingIndex]

              if (!shouldReplaceExisting(existing, item)) {
                continue
              }

              if (!changed) {
                nextQueue = [...nextQueue]
                changed = true
              }

              nextQueue[existingIndex] = item
              continue
            }

            if (!changed) {
              nextQueue = [...nextQueue]
              changed = true
            }

            nextQueue.push(item)
          }

          if (!changed) {
            return state
          }

          return {
            queue: nextQueue
          }
        }),

      update: (id, data) =>
        set((state) => {
          let changed = false

          const nextQueue = state.queue.map((item) => {
            if (item.id !== id) {
              return item
            }

            if ((isTerminal(item.status) || item.status === 'paused') && data.status === 'downloading') {
              return item
            }

            const nextItem: QueueItem = {
              ...item,
              ...data
            }

            if (sameQueueItem(item, nextItem)) {
              return item
            }

            changed = true
            return nextItem
          })

          return changed ? { queue: nextQueue } : state
        }),

      updatePlaylist: (playlistId, data) =>
        set((state) => {
          let changed = false

          const nextQueue = state.queue.map((item) => {
            if (item.playlistId !== playlistId) {
              return item
            }

            const nextItem: QueueItem = {
              ...item,
              ...data
            }

            if (sameQueueItem(item, nextItem)) {
              return item
            }

            changed = true
            return nextItem
          })

          return changed ? { queue: nextQueue } : state
        }),

      remove: (id) =>
        set((state) => {
          if (!state.queue.some((item) => item.id === id)) {
            return state
          }

          return {
            queue: state.queue.filter((item) => item.id !== id)
          }
        }),

      removePlaylist: (playlistId) =>
        set((state) => {
          if (!state.queue.some((item) => item.playlistId === playlistId)) {
            return state
          }

          return {
            queue: state.queue.filter((item) => item.playlistId !== playlistId)
          }
        }),

      pausePlaylist: (playlistId) =>
        set((state) => {
          let changed = false

          const nextQueue = state.queue.map((item) => {
            if (item.playlistId !== playlistId || item.status !== 'downloading') {
              return item
            }

            changed = true
            return {
              ...item,
              status: 'paused' as const
            }
          })

          return changed ? { queue: nextQueue } : state
        }),

      resumePlaylist: (playlistId) =>
        set((state) => {
          let changed = false

          const nextQueue = state.queue.map((item) => {
            if (item.playlistId !== playlistId || item.status !== 'paused') {
              return item
            }

            changed = true
            return {
              ...item,
              status: 'waiting' as const
            }
          })

          return changed ? { queue: nextQueue } : state
        }),

      cancelPlaylist: (playlistId) =>
        set((state) => {
          let changed = false

          const nextQueue = state.queue.map((item) => {
            if (item.playlistId !== playlistId) {
              return item
            }

            if (item.status === 'completed' || item.status === 'error' || item.status === 'cancelled') {
              return item
            }

            changed = true
            return {
              ...item,
              status: 'cancelled' as const
            }
          })

          return changed ? { queue: nextQueue } : state
        }),

      clearCompleted: () =>
        set((state) => {
          const nextQueue = state.queue.filter(
            (item) => item.status !== 'completed' && item.status !== 'cancelled' && item.status !== 'error'
          )

          return nextQueue.length === state.queue.length ? state : { queue: nextQueue }
        }),

      getPlaylistSummary: (playlistId) => buildPlaylistSummary(playlistId, get().queue.filter((item) => item.playlistId === playlistId)),

      getPlaylistProgress: (playlistId) => {
        const summary = buildPlaylistSummary(playlistId, get().queue.filter((item) => item.playlistId === playlistId))

        return {
          total: summary.total,
          completed: summary.completed,
          progress: summary.progress
        }
      }
    }),
    {
      name: 'queue-storage',
      storage: createJSONStorage(() => localStorage)
    }
  )
)

