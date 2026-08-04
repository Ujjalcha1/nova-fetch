import fs from 'node:fs'
import path from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { app, shell, type IpcMainInvokeEvent } from 'electron'
import { updateService, type UpdateCheckResult } from '../services/updateService'
import { UpdateConfigService, type UpdateConfig } from '../services/updateConfigService'
import { safeHandle } from './safeHandle'

// Installer handed to the OS by update:launch. The will-quit sweep must not
// delete it while the installer process is still running, so it is excluded.
let launchedInstallerPath: string | null = null

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
   * Download the update installer to the OS temp directory.
   *
   * Runs entirely in the main process and deliberately bypasses the download
   * manager: the file never appears in the Downloads list and is never written
   * to the user's download folder. Progress is streamed back to the renderer on
   * the `update:download-progress` channel. Any partial file is deleted on
   * failure so no temp artifacts are left behind.
   */
  safeHandle(
    'update:download',
    async (
      event: IpcMainInvokeEvent,
      url: string
    ): Promise<{ ok: boolean; path?: string; error?: string }> => {
      const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

      // Validate the URL before touching the network or filesystem.
      let parsed: URL
      try {
        parsed = new URL(url)
      } catch {
        return fail('Invalid download URL')
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return fail('Invalid download URL — only http(s) is supported')
      }

      const tempDir = path.join(app.getPath('temp'), 'novafetch-update')
      fs.mkdirSync(tempDir, { recursive: true })

      // Derive a filename from the URL, falling back to a stable default.
      let filename = 'NovaFetch-Update.exe'
      const last = parsed.pathname.split('/').filter(Boolean).pop()
      if (last && /\.(exe|msi|dmg|pkg|AppImage|deb|rpm)$/i.test(last)) {
        filename = last.replace(/[^a-zA-Z0-9._-]/g, '_')
      }
      const destPath = path.join(tempDir, filename)

      const sendProgress = (received: number, total: number): void => {
        if (event.sender.isDestroyed()) return
        // When the server sends no content-length (chunked), percent is null
        // so the UI can show an indeterminate state instead of a stuck 0%.
        event.sender.send('update:download-progress', {
          received,
          total,
          percent: total > 0 ? Math.min(100, (received / total) * 100) : null
        })
      }

      try {
        const response = await fetch(url, {
          redirect: 'follow',
          headers: { Accept: 'application/octet-stream' },
          signal: AbortSignal.timeout(30 * 60 * 1000)
        })
        if (!response.ok) {
          return fail(`Download failed — server responded with HTTP ${response.status}`)
        }
        if (!response.body) {
          return fail('Download failed — server returned no response body')
        }

        const total = Number(response.headers.get('content-length')) || 0
        let received = 0

        const counter = new Transform({
          transform(chunk: Buffer, _encoding, callback) {
            received += chunk.length
            sendProgress(received, total)
            callback(null, chunk)
          }
        })

        await pipeline(
          Readable.fromWeb(response.body as unknown as Parameters<typeof Readable.fromWeb>[0]),
          counter,
          fs.createWriteStream(destPath)
        )

        // Verify the installer actually exists on disk before handing it off.
        if (!fs.existsSync(destPath)) {
          return fail('Download failed — installer file was not created')
        }

        return { ok: true, path: destPath }
      } catch (err) {
        // Delete the partial installer so no temp files are left behind.
        try {
          fs.rmSync(destPath, { force: true })
        } catch {
          // best-effort cleanup
        }
        return fail(err instanceof Error ? err.message : String(err))
      }
    }
  )

  /**
   * Verify the installer exists, launch it with the OS default handler, and
   * gracefully quit NovaFetch so the installer can replace the running app.
   * If launching fails the app stays open and the error is returned to the
   * renderer instead of quitting.
   */
  safeHandle(
    'update:launch',
    async (_event, installerPath: string): Promise<{ ok: boolean; error?: string }> => {
      if (!installerPath || !fs.existsSync(installerPath)) {
        return { ok: false, error: 'Installer file not found' }
      }

      try {
        const launchError = await shell.openPath(installerPath)
        if (launchError) {
          return { ok: false, error: launchError }
        }

        // Remember what was handed to the OS so the exit sweep leaves it alone.
        launchedInstallerPath = installerPath

        // Graceful shutdown: give the renderer a moment to receive the
        // response, then quit so the installer can replace the running app.
        setTimeout(() => app.quit(), 500)
        return { ok: true }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    }
  )

  // Best-effort sweep of leftover update installer files when the app exits,
  // so the OS temp dir is never left with partial downloads behind. The file
  // just handed to the OS (launchedInstallerPath) is skipped — it is still in
  // use by the running installer process.
  app.on('will-quit', () => {
    try {
      const tempDir = path.join(app.getPath('temp'), 'novafetch-update')
      if (!fs.existsSync(tempDir)) return
      for (const entry of fs.readdirSync(tempDir)) {
        const full = path.join(tempDir, entry)
        if (full === launchedInstallerPath) continue
        fs.rmSync(full, { recursive: true, force: true })
      }
    } catch {
      // best-effort cleanup
    }
  })
}
