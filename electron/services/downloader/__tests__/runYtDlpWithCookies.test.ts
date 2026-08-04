import { describe, it, expect, vi, beforeEach } from 'vitest'

const execFileMock = vi.fn()

vi.mock('node:child_process', () => ({
  execFile: (...args: unknown[]) => execFileMock(...args)
}))

vi.mock('../browserCookies', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../browserCookies')>()
  return {
    ...actual,
    // Deterministic 'auto' chain for tests: chrome -> edge.
    detectInstalledBrowsers: () => ['chrome', 'edge'] as const
  }
})

import { runYtDlpWithCookies, AUTH_REQUIRED_MESSAGE, BrowserCookieResolver } from '../browserCookies'

function failWith(stderr: string): void {
  execFileMock.mockImplementation((_f: unknown, _a: unknown, _o: unknown, cb: (err: Error | null, res?: { stdout: string; stderr: string }) => void) => {
    const err = new Error('yt-dlp failed') as Error & { code?: number; stderr?: string }
    err.code = 1
    err.stderr = stderr
    cb(err)
  })
}

function succeedWith(stdout: string): void {
  execFileMock.mockImplementation((_f: unknown, _a: unknown, _o: unknown, cb: (err: Error | null, res?: { stdout: string; stderr: string }) => void) => {
    cb(null, { stdout, stderr: '' })
  })
}

beforeEach(() => {
  execFileMock.mockReset()
  BrowserCookieResolver.instance.reset()
})

describe('runYtDlpWithCookies failover', () => {
  it('falls back to a no-cookie run when a fixed browser cannot read its cookies', async () => {
    failWith('ERROR: Could not copy Chrome cookie database. See https://github.com/yt-dlp/yt-dlp/issues/7271')
    const { result, cookieSource } = await runYtDlpWithCookies('chrome', 'https://youtu.be/x', ['--dump-single-json'], 10000)
    expect(result.ok).toBe(false)
    expect(cookieSource).toBeNull()
    // Two invocations: the chrome attempt, then the no-cookie retry.
    expect(execFileMock).toHaveBeenCalledTimes(2)
  })

  it('uses the browser source when cookies are accepted', async () => {
    succeedWith('{"id":"abc"}')
    const { result, cookieSource } = await runYtDlpWithCookies('edge', 'https://youtu.be/x', ['--dump-single-json'], 10000)
    expect(result.ok).toBe(true)
    expect(result.stdout).toContain('abc')
    expect(cookieSource).toBe('edge')
    expect(execFileMock).toHaveBeenCalledTimes(1)
  })

  it('returns the failing source when cookies work but the content is gone', async () => {
    failWith('ERROR: Video unavailable')
    const { result, cookieSource } = await runYtDlpWithCookies('chrome', 'https://youtu.be/x', ['--dump-single-json'], 10000)
    expect(result.ok).toBe(false)
    expect(cookieSource).toBe('chrome')
  })

  it('skips cookie attempts once a mode is known to have failed', async () => {
    failWith('ERROR: could not find chrome cookies database')
    BrowserCookieResolver.instance.rememberFailed('chrome')
    const { cookieSource } = await runYtDlpWithCookies('chrome', 'https://youtu.be/x', ['--dump-single-json'], 10000)
    expect(cookieSource).toBeNull()
    // Only the no-cookie retry ran — no cookie attempt.
    expect(execFileMock).toHaveBeenCalledTimes(1)
    const args = execFileMock.mock.calls[0][1] as string[]
    expect(args).not.toContain('--cookies-from-browser')
  })

  it('throws a clear authentication message when YouTube demands sign-in after all browsers fail', async () => {
    failWith("ERROR: [youtube] Sign in to confirm you're not a bot")
    await expect(
      runYtDlpWithCookies('chrome', 'https://youtu.be/x', ['--dump-single-json'], 10000)
    ).rejects.toThrow(AUTH_REQUIRED_MESSAGE)
  })

  it('tries the next browser when the first one cannot read its cookies (auto)', async () => {
    execFileMock
      .mockImplementationOnce((_f: unknown, _a: unknown, _o: unknown, cb: (err: Error | null, res?: { stdout: string; stderr: string }) => void) => {
        const err = new Error('fail') as Error & { stderr?: string }
        err.stderr = 'ERROR: Failed to decrypt with DPAPI.'
        cb(err)
      })
      .mockImplementationOnce((_f: unknown, _a: unknown, _o: unknown, cb: (err: Error | null, res?: { stdout: string; stderr: string }) => void) => {
        cb(null, { stdout: '{"id":"ok"}', stderr: '' })
      })
    const { result, cookieSource } = await runYtDlpWithCookies('auto', 'https://youtu.be/x', ['--dump-single-json'], 10000)
    expect(result.ok).toBe(true)
    expect(cookieSource).toBe('edge')
    expect(execFileMock).toHaveBeenCalledTimes(2)
  })

  it('throws the auth message in disabled mode when YouTube demands sign-in', async () => {
    failWith("ERROR: Sign in to confirm you're not a bot")
    await expect(
      runYtDlpWithCookies('disabled', 'https://youtu.be/x', ['--dump-single-json'], 10000)
    ).rejects.toThrow(AUTH_REQUIRED_MESSAGE)
    // No cookie attempts at all in disabled mode.
    const args = execFileMock.mock.calls[0][1] as string[]
    expect(args).not.toContain('--cookies-from-browser')
  })
})
