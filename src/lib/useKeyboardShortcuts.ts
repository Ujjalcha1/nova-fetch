import { useEffect } from 'react'
import { useDownloadStore } from '../store/download-store'
import { useSelectionStore } from '../store/selection-store'
import { useDialogStore } from '../store/dialog-store'
import { electron } from './electron'

export function useKeyboardShortcuts() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return

      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        useDialogStore.getState().openNewDownload()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !isInput) {
        e.preventDefault()
        useDialogStore.getState().openNewDownload()
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        const input = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]')
        input?.focus()
        return
      }

      if (isInput) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { downloads } = useDownloadStore.getState()
        const selected = useSelectionStore.getState().selected
        const toRemove = selected.filter((id) => {
          const d = downloads.find((x) => x.id === id)
          return d && !['downloading', 'paused', 'queued'].includes(d.status)
        })
        if (toRemove.length > 0) {
          for (const id of toRemove) {
            useDownloadStore.getState().removeDownload(id)
          }
          useSelectionStore.getState().clear()
        }
        return
      }

      if (e.key === ' ') {
        e.preventDefault()
        const { downloads } = useDownloadStore.getState()
        const selected = useSelectionStore.getState().selected
        for (const id of selected) {
          const d = downloads.find((x) => x.id === id)
          if (!d) continue
          if (d.status === 'downloading') {
            electron.pause(id)
            useDownloadStore.getState().updateDownload(id, { status: 'paused', speed: 0, eta: 0 })
          } else if (d.status === 'paused') {
            electron.resume(id)
            useDownloadStore.getState().updateDownload(id, { status: 'downloading' })
          }
        }
        return
      }

      if (e.key === 'F5') {
        e.preventDefault()
        window.location.reload()
        return
      }

      if (e.key === 'Escape') {
        useDialogStore.getState().closeNewDownload()
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
}
