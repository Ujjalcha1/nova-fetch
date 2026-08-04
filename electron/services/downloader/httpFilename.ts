/**
 * Shared filename resolution for the Direct HTTP download pipeline.
 *
 * SINGLE SOURCE OF TRUTH: every consumer of the resolved filename (the
 * analyze/dialog flow, the download engine, progress events, notifications,
 * the completed list and the saved file) must derive the name through the
 * functions in this module so the same URL always yields the same filename.
 *
 * Resolution priority (per DIRECT_FILENAME_REPORT.md):
 *   1. Content-Disposition response header (filename / filename*)
 *   2. Final redirected URL pathname
 *   3. Original URL pathname
 *   4. "download.bin" as the last-resort fallback
 */

/** Last-resort filename used when no other source yields a name. */
export const FALLBACK_FILENAME = 'download.bin'

/**
 * Parse a Content-Disposition header value and return the filename it
 * declares, or null when absent/unparseable.
 *
 * Handles both RFC 6266 forms:
 *   - `filename*=`  (RFC 5987 / UTF-8'') — preferred, percent-decoded
 *   - `filename=`   (quoted or unquoted)
 *
 * The header may be a string, a string array, or undefined (Node's
 * IncomingMessage.headers typing). Quotes and path separators are stripped so
 * the result is a safe, bare filename.
 */
export function parseContentDispositionFilename(
  cd: string | string[] | undefined | null
): string | null {
  if (!cd) return null
  // Node may expose a duplicate header as a string array; parse each value
  // and take the first that yields a usable name.
  if (Array.isArray(cd)) {
    for (const part of cd) {
      const name = parseContentDispositionFilename(part)
      if (name) return name
    }
    return null
  }
  const header = cd

  // Split on ';' while respecting double-quoted values (a filename may
  // legally contain ';' when quoted).
  const params: Array<{ key: string; value: string }> = []
  let current = ''
  let inQuote = false
  for (let i = 0; i < header.length; i++) {
    const ch = header[i]
    if (ch === '"') {
      inQuote = !inQuote
      current += ch
      continue
    }
    if (ch === ';' && !inQuote) {
      const eq = current.indexOf('=')
      if (eq > 0) {
        params.push({
          key: current.slice(0, eq).trim().toLowerCase(),
          value: current.slice(eq + 1).trim()
        })
      }
      current = ''
      continue
    }
    current += ch
  }
  const eq = current.indexOf('=')
  if (eq > 0) {
    params.push({
      key: current.slice(0, eq).trim().toLowerCase(),
      value: current.slice(eq + 1).trim()
    })
  }

  // filename*= (RFC 5987) takes precedence over filename=.
  const star = params.find((p) => p.key === 'filename*')
  if (star) {
    const raw = star.value
    // Value shape: charset'lang'percent-encoded  e.g. UTF-8''file%20name.zip
    const quoteIdx = raw.startsWith('"') && raw.endsWith('"') ? 1 : 0
    const inner = quoteIdx ? raw.slice(1, -1) : raw
    const encMatch = /^[^']*'[^']*'(.*)$/.exec(inner)
    if (encMatch) {
      try {
        const decoded = decodeURIComponent(encMatch[1])
        const clean = sanitizeFilename(decoded)
        if (clean) return clean
      } catch {
        // malformed percent-encoding — fall through to filename=
      }
    }
  }

  const plain = params.find((p) => p.key === 'filename')
  if (plain) {
    const raw = plain.value
    const inner = raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw
    // Unescape backslash-escaped quotes and backslashes.
    const unescaped = inner.replace(/\\(["\\])/g, '$1')
    const clean = sanitizeFilename(unescaped)
    if (clean) return clean
  }

  return null
}

/**
 * Return the last pathname segment of a URL (percent-decoded) or null when
 * the URL is invalid or has no usable segment.
 */
export function filenameFromUrlPathname(url: string): string | null {
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split('/').filter(Boolean)
    if (segments.length === 0) return null
    const last = decodeURIComponent(segments[segments.length - 1])
    const clean = sanitizeFilename(last)
    return clean || null
  } catch {
    return null
  }
}

/**
 * Apply the filename priority chain and return the resolved name.
 *
 * @param cdFilename     Content-Disposition filename, if any
 * @param finalUrl       URL after redirects have been followed
 * @param originalUrl    URL the user originally provided
 */
export function resolveFilenamePriority(
  cdFilename: string | null,
  finalUrl: string,
  originalUrl: string
): string {
  const fromCd = cdFilename ? sanitizeFilename(cdFilename) : null
  if (fromCd) return fromCd

  const fromFinal = filenameFromUrlPathname(finalUrl)
  if (fromFinal) return fromFinal

  const fromOriginal = filenameFromUrlPathname(originalUrl)
  if (fromOriginal) return fromOriginal

  return FALLBACK_FILENAME
}

/**
 * Result of resolving a filename from a single HTTP response.
 */
export interface FilenameResolutionResult {
  /** The resolved filename for this response. */
  filename: string
  /** True when the name came from a Content-Disposition header. */
  fromContentDisposition: boolean
}

/**
 * Resolve the filename for a single response and report whether it came from
 * Content-Disposition. Callers use `fromContentDisposition` to decide whether
 * a GET probe is needed: CDNs that sign URLs (Googleusercontent, S3, R2) often
 * omit Content-Disposition on HEAD but include it on the actual GET — so a
 * HEAD-derived URL-token name must NOT be trusted as final without probing.
 */
export function resolveHeaderFilename(
  cd: string | string[] | undefined | null,
  finalUrl: string,
  originalUrl: string
): FilenameResolutionResult {
  const cdFilename = parseContentDispositionFilename(cd)
  return {
    filename: resolveFilenamePriority(cdFilename, finalUrl, originalUrl),
    fromContentDisposition: cdFilename !== null
  }
}

/**
 * Strip anything that would let a server-supplied value escape the target
 * directory or corrupt the file name: path separators, control characters,
 * surrounding whitespace, and Windows-reserved characters.
 */
export function sanitizeFilename(name: string): string | null {
  if (!name) return null
  const cleaned = name
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]/g, '_')
    .replace(/[<>:"|?*]/g, '_')
    .replace(/\.+$/g, '')
    .trim()
  return cleaned || null
}
