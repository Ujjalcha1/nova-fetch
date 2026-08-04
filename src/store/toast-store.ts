import { create } from 'zustand'

export type ToastType = 'success' | 'info' | 'error'

export type Toast = {
  id: string
  message: string
  subtitle?: string
  type: ToastType
}

type AddToastOptions = {
  message: string
  subtitle?: string
  type?: ToastType
}

type ToastStore = {
  toasts: Toast[]
  addToast: (options: string | AddToastOptions) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (options) => {
    const id = crypto.randomUUID()
    const opts: AddToastOptions =
      typeof options === 'string' ? { message: options } : options
    const toast: Toast = {
      id,
      message: opts.message,
      subtitle: opts.subtitle,
      type: opts.type ?? 'success',
    }
    set((state) => ({ toasts: [...state.toasts, toast] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 5000)
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
}))

