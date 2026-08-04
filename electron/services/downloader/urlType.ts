import http from 'node:http'
import https from 'node:https'

/**
 * Lightweight URL-type detection for the main process.
 *
 * Mirrors the renderer-side `detectUrlType` (src/lib/url-parser.ts) but
 * avoids importing renderer code into the Electron main bundle.
 */

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
])

export type UrlType = 'youtube' | 'http-file' | 'unknown'

/**
 * Returns the type of the given URL.
 *
 * Every valid HTTP/HTTPS URL that isn't YouTube is treated as a potential
 * direct file. The actual download attempt (via HttpDownloader) will confirm
 * whether the server returns downloadable content.
 */
export function detectUrlType(url: string): UrlType {
  try {
    const parsed = new URL(url)

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'unknown'
    }

    const hostname = parsed.hostname.toLowerCase()

    // --- YouTube ----------------------------------------------------------
    if (YOUTUBE_HOSTS.has(hostname)) {
      return 'youtube'
    }

    // --- Every other HTTP/HTTPS URL is a potential direct file ------------
    return 'http-file'
  } catch {
    return 'unknown'
  }
}

/**
 * Derive a reasonable filename from a URL (last path segment or a fallback).
 */
export function filenameFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split('/').filter(Boolean)
    if (segments.length > 0) {
      const last = decodeURIComponent(segments[segments.length - 1])
      if (last.includes('.')) return last
    }
    // No extension found — return a placeholder; the caller should
    // determine the real name from Content-Disposition or other sources
    return 'download'
  } catch {
    return 'download'
  }
}

/**
 * Follow HTTP redirects (HEAD) to resolve a download URL to its final
 * destination. This is useful for CDN-backed URLs (GitHub Releases,
 * opencode.ai, etc.) where the original URL redirects to a temporary
 * signed CDN URL. The resolved URL should be used for the actual download
 * and never persisted.
 *
 * Returns the original URL if no redirects occur or resolution fails.
 */
export async function resolveDownloadUrl(url: string): Promise<string> {
  const MAX_REDIRECTS = 10
  let currentUrl = url

  for (let i = 0; i < MAX_REDIRECTS; i++) {
    try {
      const parsed = new URL(currentUrl)
      const httpModule = parsed.protocol === 'https:' ? https : http

      const result = await new Promise<{ statusCode: number; location: string | null }>(
        (resolve, reject) => {
          const req = httpModule.request(
            currentUrl,
            { method: 'HEAD' },
            (res) => {
              const sc = res.statusCode ?? 0
              const loc = res.headers.location as string | undefined
              res.resume()
              resolve({ statusCode: sc, location: loc ?? null })
            },
          )
          req.on('error', () => reject(new Error('Request failed')))
          req.setTimeout(15000, () => {
            req.destroy()
            reject(new Error('Timeout'))
          })
          req.end()
        },
      )

      if (
        result.location &&
        [301, 302, 303, 307, 308].includes(result.statusCode)
      ) {
        currentUrl = new URL(result.location, currentUrl).toString()
      } else {
        return currentUrl
      }
    } catch {
      return currentUrl
    }
  }

  return currentUrl
}
