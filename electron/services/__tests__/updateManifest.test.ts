import { describe, it, expect } from 'vitest'
import {
  parseUpdateManifest,
  isValidVersion,
  isValidDownloadUrl,
  type UpdateManifest
} from '../updateManifest'

const VALID_MANIFEST: UpdateManifest = {
  latestVersion: '1.1.0',
  minimumSupportedVersion: '1.0.0',
  forceUpdate: false,
  downloadUrl: '',
  releaseNotes: []
}

describe('isValidVersion', () => {
  it('accepts dot-separated numeric versions', () => {
    expect(isValidVersion('1.1.0')).toBe(true)
    expect(isValidVersion('1.0')).toBe(true)
    expect(isValidVersion('2')).toBe(true)
    expect(isValidVersion('10.2.34')).toBe(true)
  })

  it('rejects non-numeric or malformed versions', () => {
    expect(isValidVersion('')).toBe(false)
    expect(isValidVersion('abc')).toBe(false)
    expect(isValidVersion('1.1.0-beta')).toBe(false)
    expect(isValidVersion('v1.1.0')).toBe(false)
    expect(isValidVersion('1..0')).toBe(false)

    // Whitespace is tolerated: the validator trims before testing, since the
    // loader stores trimmed versions.
    expect(isValidVersion(' 1.1.0 ')).toBe(true)
  })
})

describe('isValidDownloadUrl', () => {
  it('accepts http(s) URLs', () => {
    expect(isValidDownloadUrl('https://example.com/NovaFetch-1.1.0-Setup.exe')).toBe(true)
    expect(isValidDownloadUrl('http://localhost:8080/update')).toBe(true)
  })

  it('accepts an empty string as "not published yet"', () => {
    expect(isValidDownloadUrl('')).toBe(true)
  })

  it('rejects malformed or non-http(s) URLs', () => {
    expect(isValidDownloadUrl('not-a-url')).toBe(false)
    expect(isValidDownloadUrl('ftp://example.com/file')).toBe(false)
    expect(isValidDownloadUrl('file:///c:/temp/file.exe')).toBe(false)
    expect(isValidDownloadUrl('https://')).toBe(false)
  })
})

describe('parseUpdateManifest', () => {
  it('parses a valid manifest', () => {
    const result = parseUpdateManifest({
      latestVersion: '1.1.0',
      minimumSupportedVersion: '1.0.0',
      forceUpdate: false,
      downloadUrl: '',
      releaseNotes: []
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.manifest).toEqual(VALID_MANIFEST)
    }
  })

  it('applies defaults for optional fields', () => {
    const result = parseUpdateManifest({ latestVersion: '1.1.0' })

    expect(result).toEqual({
      ok: true,
      manifest: {
        latestVersion: '1.1.0',
        forceUpdate: false,
        downloadUrl: '',
        releaseNotes: []
      }
    })
  })

  it('reports a missing latestVersion', () => {
    const result = parseUpdateManifest({})

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toEqual([
        { field: 'latestVersion', message: 'missing field: latestVersion is required' }
      ])
    }
  })

  it('reports a mistyped latestVersion', () => {
    const result = parseUpdateManifest({ latestVersion: 42 })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toEqual([
        { field: 'latestVersion', message: 'latestVersion must be a non-empty string' }
      ])
    }
  })

  it('reports an invalid latestVersion', () => {
    const result = parseUpdateManifest({ latestVersion: 'not-a-version' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0].field).toBe('latestVersion')
      expect(result.errors[0].message).toContain('invalid version')
    }
  })

  it('reports an invalid minimumSupportedVersion', () => {
    const result = parseUpdateManifest({ latestVersion: '1.1.0', minimumSupportedVersion: 'abc' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toEqual([
        { field: 'minimumSupportedVersion', message: 'invalid version: "abc"' }
      ])
    }
  })

  it('reports an invalid downloadUrl', () => {
    const result = parseUpdateManifest({ latestVersion: '1.1.0', downloadUrl: 'not-a-url' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0].field).toBe('downloadUrl')
      expect(result.errors[0].message).toContain('invalid URL')
    }
  })

  it('rejects a non-boolean forceUpdate', () => {
    const result = parseUpdateManifest({ latestVersion: '1.1.0', forceUpdate: 'yes' })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0].field).toBe('forceUpdate')
    }
  })

  it('accepts releaseNotes as a string and normalizes it to an array', () => {
    const result = parseUpdateManifest({ latestVersion: '1.1.0', releaseNotes: 'Bug fixes' })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.manifest.releaseNotes).toEqual(['Bug fixes'])
    }
  })

  it('rejects releaseNotes that is neither a string nor an array of strings', () => {
    const result = parseUpdateManifest({ latestVersion: '1.1.0', releaseNotes: ['ok', 42] })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors[0].field).toBe('releaseNotes')
    }
  })

  it('rejects non-object input', () => {
    for (const input of [null, 'string', 42, ['1.1.0']]) {
      const result = parseUpdateManifest(input)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.errors[0].field).toBe('manifest')
      }
    }
  })

  it('collects every problem found in one result', () => {
    const result = parseUpdateManifest({
      latestVersion: 'x',
      forceUpdate: 'no',
      downloadUrl: 'nope'
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      const fields = result.errors.map((e) => e.field)
      expect(fields).toContain('latestVersion')
      expect(fields).toContain('forceUpdate')
      expect(fields).toContain('downloadUrl')
    }
  })
})
