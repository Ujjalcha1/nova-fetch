import path from 'node:path'

export function isValidUrl(url: string): boolean {
  try {
    new URL(url)

    return true
  } catch {
    return false
  }
}

export function getFilename(url: string): string {
  try {
    const parsed = new URL(url)

    const filename = path.basename(parsed.pathname)

    return filename || 'download'
  } catch {
    return 'download'
  }
}

export function getExtension(filename: string): string {
  return path.extname(filename).replace('.', '').toLowerCase()
}

export function normalizeUrl(url: string): string {
  return url.trim()
}
