/**
 * Update manifest loader.
 *
 * Parses and validates the JSON update manifest served at the manifest URL.
 * This module is pure: given already-parsed JSON it returns a typed result —
 * either a validated `UpdateManifest` or a list of validation errors. It never
 * throws. Fetching the JSON is the caller's responsibility (see
 * `UpdateService.checkForUpdates()`).
 *
 * Supported manifest shape:
 *
 *   {
 *     "latestVersion": "1.1.0",
 *     "minimumSupportedVersion": "1.0.0",
 *     "forceUpdate": false,
 *     "downloadUrl": "",
 *     "releaseNotes": []
 *   }
 *
 *   releaseNotes may be a single string or an array of strings; both are
 *   normalized to an array of strings.
 */

/** The validated update manifest. */
export interface UpdateManifest {
  /** Required. Dot-separated numeric version of the newest release. */
  latestVersion: string
  /** Optional. Oldest version the newest release still supports. */
  minimumSupportedVersion?: string
  /** Optional, defaults to false. True forces the update on this install. */
  forceUpdate: boolean
  /** Optional, defaults to ''. Direct download URL, or '' when not published yet. */
  downloadUrl: string
  /**
   * Optional, defaults to []. Human-readable release notes. The manifest may
   * provide a single string or an array of strings; both are normalized to an
   * array of strings.
   */
  releaseNotes: string[]
}

/** A single validation problem with the offending field and a human-readable message. */
export interface ManifestValidationError {
  field: string
  message: string
}

/** Typed result of parsing a manifest. Never throws. */
export type UpdateManifestResult =
  { ok: true; manifest: UpdateManifest } | { ok: false; errors: ManifestValidationError[] }

const VERSION_PATTERN = /^\d+(\.\d+)*$/

/** True when the string is a dot-separated numeric version (e.g. "1.1.0"). */
export function isValidVersion(value: string): boolean {
  return VERSION_PATTERN.test(value.trim())
}

/**
 * True when the string is an http(s) URL or an empty string. Empty means "no
 * direct download URL published yet", matching the sample manifest.
 */
export function isValidDownloadUrl(value: string): boolean {
  if (value.trim() === '') return true
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Parse and validate an update manifest. Returns `{ ok: true, manifest }` on
 * success or `{ ok: false, errors }` listing every problem found, so callers
 * get a complete picture of what is wrong instead of a single thrown error.
 */
export function parseUpdateManifest(json: unknown): UpdateManifestResult {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    return { ok: false, errors: [{ field: 'manifest', message: 'manifest must be a JSON object' }] }
  }

  const raw = json as Record<string, unknown>
  const errors: ManifestValidationError[] = []

  let latestVersion = ''
  const rawLatest = raw.latestVersion
  if (rawLatest === undefined || rawLatest === null) {
    errors.push({ field: 'latestVersion', message: 'missing field: latestVersion is required' })
  } else if (typeof rawLatest !== 'string' || rawLatest.trim() === '') {
    errors.push({ field: 'latestVersion', message: 'latestVersion must be a non-empty string' })
  } else if (!isValidVersion(rawLatest)) {
    errors.push({ field: 'latestVersion', message: `invalid version: "${rawLatest}"` })
  } else {
    latestVersion = rawLatest.trim()
  }

  let minimumSupportedVersion: string | undefined
  if (raw.minimumSupportedVersion !== undefined) {
    if (typeof raw.minimumSupportedVersion !== 'string') {
      errors.push({ field: 'minimumSupportedVersion', message: 'must be a string' })
    } else if (!isValidVersion(raw.minimumSupportedVersion)) {
      errors.push({
        field: 'minimumSupportedVersion',
        message: `invalid version: "${raw.minimumSupportedVersion}"`
      })
    } else {
      minimumSupportedVersion = raw.minimumSupportedVersion.trim()
    }
  }

  let forceUpdate = false
  if (raw.forceUpdate !== undefined) {
    if (typeof raw.forceUpdate !== 'boolean') {
      errors.push({ field: 'forceUpdate', message: 'must be a boolean' })
    } else {
      forceUpdate = raw.forceUpdate
    }
  }

  let downloadUrl = ''
  if (raw.downloadUrl !== undefined) {
    if (typeof raw.downloadUrl !== 'string') {
      errors.push({ field: 'downloadUrl', message: 'must be a string' })
    } else if (!isValidDownloadUrl(raw.downloadUrl)) {
      errors.push({ field: 'downloadUrl', message: `invalid URL: "${raw.downloadUrl}"` })
    } else {
      downloadUrl = raw.downloadUrl.trim()
    }
  }

  let releaseNotes: string[] = []
  if (raw.releaseNotes !== undefined) {
    if (typeof raw.releaseNotes === 'string') {
      releaseNotes = [raw.releaseNotes]
    } else if (
      Array.isArray(raw.releaseNotes) &&
      raw.releaseNotes.every((n) => typeof n === 'string')
    ) {
      releaseNotes = raw.releaseNotes
    } else {
      errors.push({ field: 'releaseNotes', message: 'must be a string or an array of strings' })
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    manifest: {
      latestVersion,
      ...(minimumSupportedVersion !== undefined ? { minimumSupportedVersion } : {}),
      forceUpdate,
      downloadUrl,
      releaseNotes
    }
  }
}
