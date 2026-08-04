import { describe, it, expect } from 'vitest'
import {
  FALLBACK_FILENAME,
  parseContentDispositionFilename,
  filenameFromUrlPathname,
  resolveFilenamePriority,
  resolveHeaderFilename,
  sanitizeFilename
} from '../httpFilename'

describe('parseContentDispositionFilename', () => {
  it('parses a plain filename=', () => {
    expect(parseContentDispositionFilename('attachment; filename="report.pdf"')).toBe('report.pdf')
    expect(parseContentDispositionFilename('attachment; filename=report.pdf')).toBe('report.pdf')
  })

  it('parses RFC 5987 filename*= with UTF-8 percent-encoding', () => {
    expect(parseContentDispositionFilename("attachment; filename*=UTF-8''my%20file%20name.zip")).toBe(
      'my file name.zip'
    )
  })

  it('prefers filename*= over filename=', () => {
    expect(
      parseContentDispositionFilename("attachment; filename=\"fallback.txt\"; filename*=UTF-8''real%20name.zip")
    ).toBe('real name.zip')
  })

  it('handles a semicolon inside a quoted filename', () => {
    expect(parseContentDispositionFilename('attachment; filename="odd;name.pdf"')).toBe('odd;name.pdf')
  })

  it('handles header arrays and string values', () => {
    expect(parseContentDispositionFilename(['attachment', 'filename="a.bin"'])).toBe('a.bin')
  })

  it('returns null for missing/unparseable headers', () => {
    expect(parseContentDispositionFilename(undefined)).toBeNull()
    expect(parseContentDispositionFilename(null)).toBeNull()
    expect(parseContentDispositionFilename('attachment')).toBeNull()
    expect(parseContentDispositionFilename('inline')).toBeNull()
  })

  it('strips path separators and unsafe characters', () => {
    expect(parseContentDispositionFilename('attachment; filename="..\\..\\evil.exe"')).toBe('.._.._evil.exe')
    expect(parseContentDispositionFilename('attachment; filename="a:b?.txt"')).toBe('a_b_.txt')
  })
})

describe('filenameFromUrlPathname', () => {
  it('returns the last pathname segment', () => {
    expect(filenameFromUrlPathname('https://cdn.example.com/files/report.pdf')).toBe('report.pdf')
  })

  it('percent-decodes the segment', () => {
    expect(filenameFromUrlPathname('https://cdn.example.com/my%20file.zip')).toBe('my file.zip')
  })

  it('returns null for invalid URLs or empty pathnames', () => {
    expect(filenameFromUrlPathname('not a url')).toBeNull()
    expect(filenameFromUrlPathname('https://cdn.example.com/')).toBeNull()
  })
})

describe('resolveFilenamePriority', () => {
  const finalUrl = 'https://lh3.googleusercontent.com/ADGPM2mHFdKn-y3yRANDOMTOKEN?foo=1'
  const originalUrl = 'https://drive.usercontent.google.com/download?id=abc123'

  it('uses Content-Disposition first', () => {
    expect(resolveFilenamePriority('real-name.mp4', finalUrl, originalUrl)).toBe('real-name.mp4')
  })

  it('falls back to the final redirected URL pathname', () => {
    expect(resolveFilenamePriority(null, 'https://cdn.example.com/final-name.zip', originalUrl)).toBe('final-name.zip')
  })

  it('falls back to the original URL pathname when the final URL has no usable segment', () => {
    expect(resolveFilenamePriority(null, 'https://cdn.example.com/', 'https://orig.example.com/orig-name.bin')).toBe(
      'orig-name.bin'
    )
  })

  it('never uses the Googleusercontent token when a real name exists in the chain', () => {
    // Priority 2 (final pathname) is still a token here — the original URL
    // pathname must win over it only when no CD and no final name exist.
    expect(resolveFilenamePriority('report v2.pdf', finalUrl, originalUrl)).toBe('report v2.pdf')
  })

  it('uses the final URL pathname (token or not) before the original URL', () => {
    // Priority 2: the final pathname segment wins even when it is an opaque
    // CDN token — download.bin is only for URLs with no usable pathname.
    expect(resolveFilenamePriority(null, finalUrl, originalUrl)).toBe('ADGPM2mHFdKn-y3yRANDOMTOKEN')
  })

  it('returns download.bin when no pathname is usable anywhere', () => {
    expect(resolveFilenamePriority(null, 'https://cdn.example.com/', 'https://orig.example.com/')).toBe(
      FALLBACK_FILENAME
    )
  })
})

describe('resolveHeaderFilename', () => {
  const finalUrl = 'https://lh3.googleusercontent.com/ADGPM2mHFdKn-y3yRANDOMTOKEN?foo=1'
  const originalUrl = 'https://drive.usercontent.google.com/download?id=abc123'

  it('flags a Content-Disposition name and uses it', () => {
    const r = resolveHeaderFilename('attachment; filename="real-name.mp4"', finalUrl, originalUrl)
    expect(r.filename).toBe('real-name.mp4')
    expect(r.fromContentDisposition).toBe(true)
  })

  it('does NOT flag a URL-derived token name (signals a GET probe is needed)', () => {
    // This is the exact Googleusercontent case: HEAD has no Content-Disposition,
    // so the fallback is the URL token — the caller must probe GET for the
    // real name, which CDNs only include on the actual download response.
    const r = resolveHeaderFilename(undefined, finalUrl, originalUrl)
    expect(r.filename).toBe('ADGPM2mHFdKn-y3yRANDOMTOKEN')
    expect(r.fromContentDisposition).toBe(false)
  })

  it('handles header arrays', () => {
    const r = resolveHeaderFilename(['attachment', 'filename="a.bin"'], finalUrl, originalUrl)
    expect(r.filename).toBe('a.bin')
    expect(r.fromContentDisposition).toBe(true)
  })
})

describe('sanitizeFilename', () => {
  it('replaces path separators and control characters', () => {
    expect(sanitizeFilename('a/b\\c\u0000d')).toBe('a_b_cd')
  })

  it('trims trailing dots and whitespace', () => {
    expect(sanitizeFilename('name.txt...')).toBe('name.txt')
    expect(sanitizeFilename('  spaced.txt  ')).toBe('spaced.txt')
  })

  it('returns null for empty input', () => {
    expect(sanitizeFilename('')).toBeNull()
    expect(sanitizeFilename('   ')).toBeNull()
  })
})
