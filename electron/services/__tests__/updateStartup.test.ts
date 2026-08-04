import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../updateConfigService', () => ({
  UpdateConfigService: { load: vi.fn() }
}))

vi.mock('../updateService', () => ({
  updateService: { checkForUpdates: vi.fn() }
}))

import { UpdateConfigService } from '../updateConfigService'
import { updateService } from '../updateService'
import { runStartupUpdateCheck } from '../updateStartup'

describe('runStartupUpdateCheck', () => {
  beforeEach(() => {
    vi.mocked(UpdateConfigService.load).mockReset()
    vi.mocked(updateService.checkForUpdates).mockReset()
  })

  it('does nothing when auto update is disabled', async () => {
    vi.mocked(UpdateConfigService.load).mockReturnValue({
      autoUpdate: false,
      updateChannel: 'stable'
    })

    await runStartupUpdateCheck()

    expect(updateService.checkForUpdates).not.toHaveBeenCalled()
  })

  it('checks for updates exactly once when auto update is enabled', async () => {
    vi.mocked(UpdateConfigService.load).mockReturnValue({
      autoUpdate: true,
      updateChannel: 'stable'
    })
    vi.mocked(updateService.checkForUpdates).mockResolvedValue({
      currentVersion: '1.0.0',
      latestVersion: '1.0.0',
      updateAvailable: false,
      forceUpdate: false,
      minimumSupportedVersion: null,
      releaseNotes: null,
      downloadUrl: '',
      error: null
    })

    await runStartupUpdateCheck()

    expect(updateService.checkForUpdates).toHaveBeenCalledTimes(1)
  })

  it('logs when an update is available', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    vi.mocked(UpdateConfigService.load).mockReturnValue({
      autoUpdate: true,
      updateChannel: 'stable'
    })
    vi.mocked(updateService.checkForUpdates).mockResolvedValue({
      currentVersion: '1.0.0',
      latestVersion: '1.1.0',
      updateAvailable: true,
      forceUpdate: false,
      minimumSupportedVersion: '1.0.0',
      releaseNotes: null,
      downloadUrl: '',
      error: null
    })

    await runStartupUpdateCheck()

    expect(log).toHaveBeenCalledWith(expect.stringContaining('Update available'))
    log.mockRestore()
  })

  it('warns and does not throw when the check fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.mocked(UpdateConfigService.load).mockReturnValue({
      autoUpdate: true,
      updateChannel: 'stable'
    })
    vi.mocked(updateService.checkForUpdates).mockResolvedValue({
      currentVersion: '1.0.0',
      latestVersion: '',
      updateAvailable: false,
      forceUpdate: false,
      minimumSupportedVersion: null,
      releaseNotes: null,
      downloadUrl: '',
      error: 'Update server unreachable: ENOTFOUND'
    })

    await expect(runStartupUpdateCheck()).resolves.toBeUndefined()

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Startup check failed'))
    warn.mockRestore()
  })
})
