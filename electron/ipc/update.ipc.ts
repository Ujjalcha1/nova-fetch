import type { IpcMainInvokeEvent } from 'electron'
import { updateService, type UpdateCheckResult } from '../services/updateService'
import { UpdateConfigService, type UpdateConfig } from '../services/updateConfigService'
import { safeHandle } from './safeHandle'

export function registerUpdateIpc(): void {
  safeHandle('update:get-current-version', async (): Promise<string> => {
    return updateService.getCurrentVersion()
  })

  safeHandle('update:check', async (): Promise<UpdateCheckResult> => {
    return updateService.checkForUpdates()
  })

  safeHandle('update:get-settings', async (): Promise<UpdateConfig> => {
    return UpdateConfigService.load()
  })

  safeHandle(
    'update:set-settings',
    async (_event, partial: Partial<UpdateConfig>): Promise<UpdateConfig> => {
      return UpdateConfigService.save(partial)
    }
  )

  /**
   * Download the pending update with electron-updater.
   *
   * Runs entirely in the main process: electron-updater fetches the installer
   * from the GitHub release, verifies it, and stages it for install. Progress
   * is streamed back to the renderer on the `update:download-progress` channel
   * and the promise resolves once the download is complete and verified.
   */
  safeHandle(
    'update:download',
    async (event: IpcMainInvokeEvent): Promise<{ ok: boolean; error?: string }> => {
      const unsubProgress = updateService.onDownloadProgress((progress) => {
        if (event.sender.isDestroyed()) return
        event.sender.send('update:download-progress', {
          received: progress.transferred,
          total: progress.total,
          percent: Math.min(100, progress.percent)
        })
      })
      try {
        await updateService.downloadUpdate()
        if (!event.sender.isDestroyed()) {
          event.sender.send('update:download-complete', { ok: true })
        }
        return { ok: true }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      } finally {
        unsubProgress()
      }
    }
  )

  /**
   * Install the downloaded update and quit NovaFetch.
   *
   * electron-updater launches the NSIS installer silently (/S) and relaunches
   * the app afterwards, so the installer wizard never appears. The renderer
   * calls this fire-and-forget: the app quits almost immediately after this
   * handler returns.
   */
  safeHandle('update:install', async (): Promise<{ ok: boolean }> => {
    updateService.quitAndInstall(true, true)
    return { ok: true }
  })
}
