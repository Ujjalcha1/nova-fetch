import { useState, useEffect, useCallback } from 'react'
import type { UpdateCheckResult, UpdateConfig } from '../types/electron'

/**
 * useUpdate — hidden renderer API over the update preload bridge.
 *
 * Exposes the update system's read state and actions without any UI:
 *
 *   currentVersion   — installed version string, or null until loaded
 *   checkForUpdates()— resolves to a structured UpdateCheckResult (never throws)
 *   settings         — persisted update config, or null until loaded
 *   saveSettings()   — persists a partial config and returns the updated config
 *
 * This hook renders nothing and wires nothing into app startup. Data is only
 * fetched when a component actually mounts the hook; checking for updates only
 * happens when checkForUpdates() is called explicitly.
 */
export interface UseUpdateResult {
  currentVersion: string | null
  checkForUpdates: () => Promise<UpdateCheckResult>
  settings: UpdateConfig | null
  saveSettings: (partial: Partial<UpdateConfig>) => Promise<UpdateConfig>
}

export function useUpdate(): UseUpdateResult {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null)
  const [settings, setSettings] = useState<UpdateConfig | null>(null)

  useEffect(() => {
    let cancelled = false

    window.electron.update.getCurrentVersion().then((version) => {
      if (!cancelled) setCurrentVersion(version)
    })
    window.electron.update.getSettings().then((config) => {
      if (!cancelled) setSettings(config)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const checkForUpdates = useCallback(async (): Promise<UpdateCheckResult> => {
    return window.electron.update.check()
  }, [])

  const saveSettings = useCallback(
    async (partial: Partial<UpdateConfig>): Promise<UpdateConfig> => {
      const updated = await window.electron.update.setSettings(partial)
      setSettings(updated)
      return updated
    },
    []
  )

  return { currentVersion, checkForUpdates, settings, saveSettings }
}
