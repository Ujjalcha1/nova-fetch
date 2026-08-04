import { useEffect, useState, useCallback } from 'react'
import { useSettingsStore } from '../store/settings-store'

export function useClipboardMonitor() {
  const [detectedUrl, setDetectedUrl] = useState<string | null>(null)
  const clipboardMonitor = useSettingsStore((s) => s.clipboardMonitor)

  useEffect(() => {
    if (!clipboardMonitor) {
      window.electronAPI.clipboard.stopMonitoring()
      return
    }

    window.electronAPI.clipboard.startMonitoring()

    const unsub = window.electronAPI.clipboard.onUrlDetected((url) => {
      setDetectedUrl(url)
    })

    return () => {
      unsub()
      window.electronAPI.clipboard.stopMonitoring()
    }
  }, [clipboardMonitor])

  const dismiss = useCallback(() => setDetectedUrl(null), [])

  return { detectedUrl, dismiss }
}
