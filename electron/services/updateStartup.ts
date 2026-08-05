import { UpdateConfigService } from './updateConfigService'
import { updateService } from './updateService'

/**
 * One-time automatic update check performed after the application starts.
 *
 * - Runs exactly once, invoked from the main process startup path.
 * - Does nothing when the persisted Auto Update setting is disabled.
 * - When enabled, performs a check only: no dialogs, no downloads, no installs.
 * - Never throws: UpdateConfigService.load() and updateService.checkForUpdates()
 *   both return structured results on failure.
 */
export async function runStartupUpdateCheck(): Promise<void> {
  const config = UpdateConfigService.load()
  if (!config.autoUpdate) {
    console.log('[Update] Auto update disabled — skipping startup check')
    return
  }

  const result = await updateService.checkForUpdates()
  if (result.error) {
    console.warn(`[Update] Startup check failed: ${result.error}`)
    return
  }

  if (result.updateAvailable) {
    console.log(`[Update] Update available: ${result.currentVersion} -> ${result.latestVersion}`)
  } else {
    console.log(`[Update] Up to date (${result.currentVersion})`)
  }

  console.log('[Update] Startup check complete')
}
