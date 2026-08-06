import { app } from 'electron'
import { compareVersions } from './versionCompare'
import { parseUpdateManifest, type UpdateManifestResult } from './updateManifest'

// Public API re-exports: these names were exported by this module before the
// integration and are preserved so existing imports keep working. The canonical
// implementations now live in versionCompare.ts and updateManifest.ts.
export { compareVersions } from './versionCompare'
export type { UpdateManifest } from './updateManifest'

/**
 * Update foundation service.
 *
 * This is intentionally a read-only foundation: it can report the currently
 * installed version and fetch an update manifest from a configurable URL, but
 * it never downloads, installs, prompts, or checks at startup. Everything the
 * app needs to later build on top of this (UI, auto-download, forced updates)
 * starts from the structured result returned by checkForUpdates().
 *
 * Version comparison is delegated to versionCompare.ts and manifest parsing to
 * updateManifest.ts — no duplicate logic lives here.
 */

/** Structured result returned by checkForUpdates(). Never throws. */
export interface UpdateCheckResult {
  currentVersion: string
  latestVersion: string
  updateAvailable: boolean
  forceUpdate: boolean
  minimumSupportedVersion: string | null
  releaseNotes: string | null
  /** Direct installer URL from the manifest, or '' when not published yet. */
  downloadUrl: string
  /** Non-null when the check failed (server unreachable, bad response, bad manifest). */
  error: string | null
}

export interface UpdateServiceOptions {
  /** URL of the update manifest JSON. Defaults to $NOVAFETCH_UPDATE_URL or a placeholder. */
  manifestUrl?: string
  /** Fetch implementation, injectable for tests. Defaults to globalThis.fetch. */
  fetchImpl?: typeof fetch
  /** Request timeout in milliseconds. Defaults to 10000. */
  timeoutMs?: number
}

// const DEFAULT_MANIFEST_URL = 'https://updates.novafetch.app/manifest.json'
// Manifest is served from the project repo (verified reachable). Override at
// runtime with the NOVAFETCH_UPDATE_URL environment variable.
const DEFAULT_MANIFEST_URL =
  'https://raw.githubusercontent.com/Ujjalcha1/nova-fetch/main/update.json'

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

export class UpdateService {
  private readonly manifestUrl: string
  private readonly fetchImpl: typeof fetch
  private readonly timeoutMs: number

  constructor(options: UpdateServiceOptions = {}) {
    this.manifestUrl =
      options.manifestUrl ?? process.env['NOVAFETCH_UPDATE_URL'] ?? DEFAULT_MANIFEST_URL
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch
    this.timeoutMs = options.timeoutMs ?? 10000
  }

  /** The version of the currently installed application, read from Electron. */
  getCurrentVersion(): string {
    console.log('Current Version:', app.getVersion())
    console.log('[Update] Current Version:', app.getVersion())
    return app.getVersion()
  }

  /**
   * Fetch the update manifest and return a structured result.
   *
   * Never throws: network failures, non-2xx responses, and malformed manifests
   * are reported through the `error` field of the result instead.
   */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    const currentVersion = this.getCurrentVersion()

    const failed = (error: string): UpdateCheckResult => ({
      currentVersion,
      latestVersion: '',
      updateAvailable: false,
      forceUpdate: false,
      minimumSupportedVersion: null,
      releaseNotes: null,
      downloadUrl: '',
      error
    })

    console.log(`[Update] Fetching manifest... ${this.manifestUrl}`)
    let response: Response
    try {
      response = await this.fetchImpl(this.manifestUrl, {
        signal: AbortSignal.timeout(this.timeoutMs),
        headers: { Accept: 'application/json' }
      })
    } catch (err) {
      console.warn(`[Update] Fetch failed: ${toMessage(err)}`)
      return failed(`Update server unreachable: ${toMessage(err)}`)
    }

    console.log(`[Update] HTTP ${response.status}`)
    if (!response.ok) {
      return failed(`Update server responded with HTTP ${response.status}`)
    }

    let parsed: UpdateManifestResult
    try {
      const rawText = await response.text()
      console.log('[Update] Raw response:', rawText)
      parsed = parseUpdateManifest(JSON.parse(rawText))
    } catch (err) {
      return failed(`Invalid update manifest: ${toMessage(err)}`)
    }

    if (!parsed.ok) {
      return failed(`Invalid update manifest: ${parsed.errors.map((e) => e.message).join('; ')}`)
    }

    console.log('[Update] Manifest loaded')
    const manifest = parsed.manifest
    const updateAvailable = compareVersions(manifest.latestVersion, currentVersion) > 0
    const forceUpdate = updateAvailable && manifest.forceUpdate

    console.log(`[Update] Latest Version: ${manifest.latestVersion}`)
    console.log(`[Update] Needs Update: ${updateAvailable}`)
    console.log(`[Update] Force Update: ${forceUpdate}`)

    return {
      currentVersion,
      latestVersion: manifest.latestVersion,
      updateAvailable,
      forceUpdate,
      minimumSupportedVersion: manifest.minimumSupportedVersion ?? null,
      releaseNotes: manifest.releaseNotes.length > 0 ? manifest.releaseNotes.join('\n') : null,
      downloadUrl: manifest.downloadUrl,
      error: null
    }
  }
}

/** Singleton instance for app-wide use. */
export const updateService = new UpdateService()
