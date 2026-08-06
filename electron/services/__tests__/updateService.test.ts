import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  app: { getVersion: () => '1.0.0', isPackaged: false }
}))

vi.mock('electron-updater', () => {
  const autoUpdater = {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    forceDevUpdateConfig: false,
    logger: undefined,
    setFeedURL: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    on: vi.fn(() => autoUpdater),
    removeListener: vi.fn()
  }
  return { autoUpdater }
})

import { UpdateService, compareVersions } from '../updateService'
import { autoUpdater } from 'electron-updater'

function makeService(): UpdateService {
  return new UpdateService()
}

function checkResult(
  version: string,
  releaseNotes?: string
): {
  isUpdateAvailable: boolean
  updateInfo: { version: string; releaseNotes?: string }
  versionInfo: { version: string; releaseNotes?: string }
} {
  return {
    isUpdateAvailable: true,
    updateInfo: {
      version,
      ...(releaseNotes !== undefined ? { releaseNotes } : {})
    },
    versionInfo: {
      version,
      ...(releaseNotes !== undefined ? { releaseNotes } : {})
    }
  }
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
    vi.clearAllMocks()
  })

  it('reports the installed version from Electron', () => {
    const service = makeService()
    expect(service.getCurrentVersion()).toBe('1.0.0')
  })

  it('returns a structured result when a newer version exists', async () => {
    vi.mocked(autoUpdater.checkForUpdates).mockResolvedValue(
      checkResult('1.2.0', 'Bug fixes') as never
    )
    const result = await makeService().checkForUpdates()

    expect(result).toEqual({
      currentVersion: '1.0.0',
      latestVersion: '1.2.0',
      updateAvailable: true,
      forceUpdate: false,
      minimumSupportedVersion: null,
      releaseNotes: ['Bug fixes'],
      downloadUrl: '',
      error: null
    })
  })

  it('does not flag an update when none is available', async () => {
    vi.mocked(autoUpdater.checkForUpdates).mockResolvedValue(
      { isUpdateAvailable: false, updateInfo: { version: '1.0.0' } } as never
    )
    const result = await makeService().checkForUpdates()

    expect(result.updateAvailable).toBe(false)
    expect(result.forceUpdate).toBe(false)
    expect(result.error).toBeNull()
  })

  it('splits release notes into one bullet per line', async () => {
    vi.mocked(autoUpdater.checkForUpdates).mockResolvedValue(
      checkResult(
        '1.2.0',
        'Added in-app rating system\nFirebase analytics integration\nWebsite visitor analytics'
      ) as never
    )
    const result = await makeService().checkForUpdates()

    expect(result.releaseNotes).toEqual([
      'Added in-app rating system',
      'Firebase analytics integration',
      'Website visitor analytics'
    ])
  })

  it('returns a structured failure when the update server cannot be reached', async () => {
    vi.mocked(autoUpdater.checkForUpdates).mockRejectedValue(new Error('ENOTFOUND api.github.com'))
    const result = await makeService().checkForUpdates()

    expect(result).toMatchObject({
      currentVersion: '1.0.0',
      latestVersion: '',
      updateAvailable: false,
      forceUpdate: false,
      error: expect.stringContaining('Update server unreachable')
    })
  })

  it('delegates downloadUpdate to electron-updater', async () => {
    vi.mocked(autoUpdater.downloadUpdate).mockResolvedValue(['C:\\temp\\update.exe'])
    await expect(makeService().downloadUpdate()).resolves.toBeUndefined()
    expect(autoUpdater.downloadUpdate).toHaveBeenCalledTimes(1)
  })

  it('installs silently and restarts through quitAndInstall', () => {
    makeService().quitAndInstall()
    expect(autoUpdater.quitAndInstall).toHaveBeenCalledWith(true, true)
  })

  it('subscribes to and unsubscribes from download progress', () => {
    const service = makeService()
    const callback = vi.fn()
    const unsub = service.onDownloadProgress(callback)

    expect(autoUpdater.on).toHaveBeenCalledWith('download-progress', callback)

    const calls = vi.mocked(autoUpdater.on).mock.calls
    const handler = calls[calls.length - 1][1] as (p: { percent: number }) => void
    handler({ percent: 42 })

    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ percent: 42 }))

    unsub()
    expect(autoUpdater.removeListener).toHaveBeenCalledWith('download-progress', callback)
  })
})
