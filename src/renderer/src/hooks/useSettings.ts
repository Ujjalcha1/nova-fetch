import { useEffect, useState } from 'react'
import type { AppSettings } from '../../../shared/types/settings'

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    window.api.settings.get().then(setSettings)
  }, [])

  const loadSettings = async () => {
    const data = await window.api.settings.get()
    setSettings(data)
  }

  const update = async (data: Partial<AppSettings>) => {
    const next = await window.api.settings.update(data)
    setSettings(next)
    return next
  }

  return {
    settings,
    update,
    reload: loadSettings
  }
}
