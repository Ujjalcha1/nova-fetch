import { create } from 'zustand'

export type PlaylistDownloadStatus =
  'idle' | 'downloading' | 'paused' | 'completed' | 'cancelled' | 'error'

export interface PlaylistDownloadState {
  playlistId: string
  title: string

  progress: number
  completed: number
  failed: number
  cancelled: number
  paused: number
  waiting: number
  downloading: number
  remaining: number
  total: number

  speed: string
  eta: string

  status: PlaylistDownloadStatus
}

interface PlaylistDownloadStore {
  downloads: Record<string, PlaylistDownloadState>

  start: (playlistId: string, title: string, total: number) => void

  update: (playlistId: string, data: Partial<PlaylistDownloadState>) => void

  syncFromQueue: (state: {
    playlistId: string
    title?: string
    total: number
    completed: number
    failed: number
    cancelled: number
    paused: number
    waiting: number
    downloading: number
    remaining: number
    progress: number
  }) => void

  pause: (playlistId: string) => void

  resume: (playlistId: string) => void

  cancel: (playlistId: string) => void

  finish: (playlistId: string) => void

  remove: (playlistId: string) => void

  get: (playlistId: string) => PlaylistDownloadState | undefined
}

function sameState(item: PlaylistDownloadState, next: Partial<PlaylistDownloadState>) {
  return Object.entries(next).every(([key, value]) => (item as unknown as Record<string, unknown>)[key] === value)
}

export const usePlaylistDownloadStore = create<PlaylistDownloadStore>((set, get) => ({
  downloads: {},

  start: (playlistId, title, total) =>
    set((state) => {
      const current = state.downloads[playlistId]

      if (
        current &&
        current.title === title &&
        current.total === total &&
        current.status === 'downloading' &&
        current.progress === 0 &&
        current.completed === 0 &&
        current.failed === 0 &&
        current.cancelled === 0 &&
        current.waiting === total &&
        current.downloading === 0 &&
        current.remaining === total &&
        current.speed === '-' &&
        current.eta === '-'
      ) {
        return state
      }

      return {
        downloads: {
          ...state.downloads,
          [playlistId]: {
            playlistId,
            title,
            progress: 0,
            completed: 0,
            failed: 0,
            cancelled: 0,
            paused: 0,
            waiting: total,
            downloading: 0,
            remaining: total,
            total,
            speed: '-',
            eta: '-',
            status: 'downloading'
          }
        }
      }
    }),

  update: (playlistId, data) =>
    set((state) => {
      const item = state.downloads[playlistId]

      if (!item) {
        return state
      }

      if (
        (item.status === 'completed' || item.status === 'cancelled' || item.status === 'error') &&
        data.status === 'downloading'
      ) {
        return state
      }

      const nextItem = {
        ...item,
        ...data
      }

      if (sameState(item, nextItem)) {
        return state
      }

      return {
        downloads: {
          ...state.downloads,
          [playlistId]: nextItem
        }
      }
    }),

  syncFromQueue: (summary) =>
    set((state) => {
      const current = state.downloads[summary.playlistId]
      const nextStatus: PlaylistDownloadStatus =
        summary.total === 0
          ? 'idle'
          : summary.downloading > 0 || summary.waiting > 0
            ? 'downloading'
            : summary.paused > 0
              ? 'paused'
              : summary.cancelled === summary.total
                ? 'cancelled'
                : summary.failed === summary.total
                  ? 'error'
                  : 'completed'

      const nextItem: PlaylistDownloadState = {
        playlistId: summary.playlistId,
        title: summary.title ?? current?.title ?? '',
        progress: summary.progress,
        completed: summary.completed,
        failed: summary.failed,
        cancelled: summary.cancelled,
        paused: summary.paused,
        waiting: summary.waiting,
        downloading: summary.downloading,
        remaining: summary.remaining,
        total: summary.total,
        speed: current?.status === 'downloading' ? current.speed : summary.downloading > 0 ? current?.speed ?? '-' : '-',
        eta: current?.status === 'downloading' ? current.eta : summary.downloading > 0 ? current?.eta ?? '-' : '-',
        status: nextStatus
      }

      if (current && sameState(current, nextItem)) {
        return state
      }

      return {
        downloads: {
          ...state.downloads,
          [summary.playlistId]: nextItem
        }
      }
    }),

  pause: (playlistId) =>
    set((state) => {
      const item = state.downloads[playlistId]

      if (!item || item.status === 'paused' || item.status === 'completed' || item.status === 'cancelled') {
        return state
      }

      return {
        downloads: {
          ...state.downloads,
          [playlistId]: {
            ...item,
            status: 'paused',
            speed: '-',
            eta: '-'
          }
        }
      }
    }),

  resume: (playlistId) =>
    set((state) => {
      const item = state.downloads[playlistId]

      if (!item || item.status !== 'paused') {
        return state
      }

      return {
        downloads: {
          ...state.downloads,
          [playlistId]: {
            ...item,
            status: 'downloading'
          }
        }
      }
    }),

  cancel: (playlistId) =>
    set((state) => {
      const item = state.downloads[playlistId]

      if (!item || item.status === 'cancelled' || item.status === 'completed') {
        return state
      }

      return {
        downloads: {
          ...state.downloads,
          [playlistId]: {
            ...item,
            status: 'cancelled',
            speed: '-',
            eta: '-'
          }
        }
      }
    }),

  finish: (playlistId) =>
    set((state) => {
      const item = state.downloads[playlistId]

      if (!item || item.status === 'completed') {
        return state
      }

      return {
        downloads: {
          ...state.downloads,
          [playlistId]: {
            ...item,
            progress: 100,
            completed: item.total,
            failed: item.failed,
            cancelled: item.cancelled,
            paused: item.paused,
            waiting: 0,
            downloading: 0,
            remaining: 0,
            speed: '-',
            eta: '-',
            status: 'completed'
          }
        }
      }
    }),

  remove: (playlistId) =>
    set((state) => {
      if (!state.downloads[playlistId]) {
        return state
      }

      const downloads = {
        ...state.downloads
      }

      delete downloads[playlistId]

      return {
        downloads
      }
    }),

  get: (playlistId) => get().downloads[playlistId]
}))


