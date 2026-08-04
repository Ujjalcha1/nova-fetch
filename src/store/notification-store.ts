import { create } from 'zustand'

export type NotificationType =
  | 'download-started'
  | 'download-paused'
  | 'download-resumed'
  | 'download-completed'
  | 'download-failed'
  | 'retry-started'
  | 'queue-finished'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message?: string
  timestamp: number
  read: boolean
}

type NotificationStore = {
  notifications: AppNotification[]
  addNotification: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void
  markAllRead: () => void
  clearAll: () => void
  unreadCount: () => number
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],

  addNotification: (notif) => {
    const id = crypto.randomUUID()
    set((state) => ({
      notifications: [
        { ...notif, id, timestamp: Date.now(), read: false },
        ...state.notifications
      ]
    }))
  },

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true }))
    })),

  clearAll: () => set({ notifications: [] }),

  unreadCount: () => get().notifications.filter((n) => !n.read).length
}))
