import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  app: { getVersion: () => '1.0.0' }
}))

import { UpdateService, compareVersions } from '../updateService'

function jsonResponse(json: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: async () => (typeof json === 'string' ? json : JSON.stringify(json)),
    json: async () => json
  } as unknown as Response
}

function makeService(
  fetchImpl: typeof fetch,
  manifestUrl = 'https://example.test/manifest.json'
): UpdateService {
  return new UpdateService({ manifestUrl, fetchImpl })
}

describe('compareVersions', () => {
  it('orders numeric dot-separated versions', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1)
    expect(compareVersions('1.2.0', '1.1.9')).toBe(1)
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1)
    expect(compareVersions('1.0', '1.0.0')).toBe(0)
    expect(compareVersions('1.0.0', '1.0')).toBe(0)
  })
})

describe('UpdateService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('reports the installed version from Electron', () => {
    const service = makeService(vi.fn() as unknown as typeof fetch)
    expect(service.getCurrentVersion()).toBe('1.0.0')
  })

  it('returns a structured result when a newer version exists', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        latestVersion: '1.2.0',
        minimumSupportedVersion: '1.0.0',
        forceUpdate: false,
        releaseNotes: ['Bug fixes']
      })
    )
    const result = await makeService(fetchImpl).checkForUpdates()

    expect(result).toEqual({
      currentVersion: '1.0.0',
      latestVersion: '1.2.0',
      updateAvailable: true,
      forceUpdate: false,
      minimumSupportedVersion: '1.0.0',
      releaseNotes: 'Bug fixes',
      downloadUrl: '',
      error: null
    })
    expect(fetchImpl).toHaveBeenCalledWith('https://example.test/manifest.json', expect.any(Object))
  })

  it('does not flag an update when versions are equal', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ latestVersion: '1.0.0' }))
    const result = await makeService(fetchImpl).checkForUpdates()

    expect(result.updateAvailable).toBe(false)
    expect(result.forceUpdate).toBe(false)
    expect(result.error).toBeNull()
  })

  it('only forces an update when an update is actually available', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ latestVersion: '1.0.0', forceUpdate: true }))
    const result = await makeService(fetchImpl).checkForUpdates()

    expect(result.updateAvailable).toBe(false)
    expect(result.forceUpdate).toBe(false)
  })

  it('propagates forceUpdate when a newer version is available', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ latestVersion: '2.0.0', forceUpdate: true }))
    const result = await makeService(fetchImpl).checkForUpdates()

    expect(result.updateAvailable).toBe(true)
    expect(result.forceUpdate).toBe(true)
  })

  it('returns a structured failure when the server cannot be reached', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ENOTFOUND example.test'))
    const result = await makeService(fetchImpl).checkForUpdates()

    expect(result).toMatchObject({
      currentVersion: '1.0.0',
      latestVersion: '',
      updateAvailable: false,
      forceUpdate: false,
      error: expect.stringContaining('Update server unreachable')
    })
  })

  it('returns a structured failure on non-2xx responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, false, 404))
    const result = await makeService(fetchImpl).checkForUpdates()

    expect(result.error).toContain('HTTP 404')
    expect(result.updateAvailable).toBe(false)
  })

  it('returns a structured failure on a malformed manifest', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ nope: true }))
    const result = await makeService(fetchImpl).checkForUpdates()

    expect(result.error).toContain('Invalid update manifest')
    expect(result.updateAvailable).toBe(false)
  })

  it('returns a structured failure on invalid JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse('not json'))
    const result = await makeService(fetchImpl).checkForUpdates()

    expect(result.error).toContain('Invalid update manifest')
  })
})
