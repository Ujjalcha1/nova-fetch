import { describe, it, expect } from 'vitest'
import {
  normalizeCookiesMode,
  isBrowserCookieSource,
  detectInstalledBrowsers,
  isCookieExtractionError,
  isAuthRequiredError,
  cookieArgs,
  AUTH_REQUIRED_MESSAGE,
  BrowserCookieResolver
} from '../browserCookies'

describe('normalizeCookiesMode', () => {
  it('maps empty/unknown values to auto', () => {
    expect(normalizeCookiesMode('')).toBe('auto')
    expect(normalizeCookiesMode(undefined)).toBe('auto')
    expect(normalizeCookiesMode(null)).toBe('auto')
    expect(normalizeCookiesMode('bogus')).toBe('auto')
  })

  it('keeps explicit browser sources (case/whitespace insensitive)', () => {
    expect(normalizeCookiesMode('chrome')).toBe('chrome')
    expect(normalizeCookiesMode('Edge')).toBe('edge')
    expect(normalizeCookiesMode(' BRAVE ')).toBe('brave')
    expect(normalizeCookiesMode('firefox')).toBe('firefox')
  })

  it('maps disabled variants', () => {
    expect(normalizeCookiesMode('disabled')).toBe('disabled')
    expect(normalizeCookiesMode('none')).toBe('disabled')
    expect(normalizeCookiesMode('off')).toBe('disabled')
  })
})

describe('isBrowserCookieSource', () => {
  it('accepts the four known sources only', () => {
    expect(isBrowserCookieSource('chrome')).toBe(true)
    expect(isBrowserCookieSource('edge')).toBe(true)
    expect(isBrowserCookieSource('brave')).toBe(true)
    expect(isBrowserCookieSource('firefox')).toBe(true)
    expect(isBrowserCookieSource('auto')).toBe(false)
    expect(isBrowserCookieSource('disabled')).toBe(false)
    expect(isBrowserCookieSource('opera')).toBe(false)
  })
})

describe('detectInstalledBrowsers', () => {
  it('returns only valid sources, in priority order', () => {
    const installed = detectInstalledBrowsers()
    for (const source of installed) {
      expect(isBrowserCookieSource(source)).toBe(true)
    }
    const idx = installed.map((s) => ['chrome', 'edge', 'brave', 'firefox'].indexOf(s))
    const sorted = [...idx].sort((a, b) => a - b)
    expect(idx).toEqual(sorted)
  })
})

describe('isCookieExtractionError', () => {
  it('detects real yt-dlp cookie-extraction failures', () => {
    expect(
      isCookieExtractionError(
        'ERROR: Could not copy Chrome cookie database. See https://github.com/yt-dlp/yt-dlp/issues/7271 for more info'
      )
    ).toBe(true)
    expect(isCookieExtractionError('ERROR: Failed to decrypt with DPAPI.')).toBe(true)
    expect(
      isCookieExtractionError(
        'ERROR: could not find brave cookies database in "C:\\Users\\x\\AppData\\Local\\BraveSoftware\\Brave-Browser\\User Data"'
      )
    ).toBe(true)
    expect(
      isCookieExtractionError(
        'ERROR: [WinError 32] The process cannot access the file because it is being used by another process'
      )
    ).toBe(true)
    expect(isCookieExtractionError('ERROR: Could not find key in keyring')).toBe(true)
  })

  it('does not flag informational or unrelated errors', () => {
    expect(isCookieExtractionError('Extracting cookies from chrome')).toBe(false)
    expect(isCookieExtractionError('ERROR: Video unavailable')).toBe(false)
    expect(isCookieExtractionError("ERROR: Sign in to confirm you're not a bot")).toBe(false)
    expect(isCookieExtractionError('')).toBe(false)
  })
})

describe('isAuthRequiredError', () => {
  it('detects YouTube sign-in / bot-check messages', () => {
    expect(isAuthRequiredError("ERROR: Sign in to confirm you're not a bot")).toBe(true)
    expect(isAuthRequiredError('ERROR: [youtube] Sign in to confirm you are not a bot')).toBe(true)
    expect(isAuthRequiredError('ERROR: YouTube is requesting authentication')).toBe(true)
    expect(isAuthRequiredError('ERROR: Login required')).toBe(true)
  })

  it('does not flag non-auth errors', () => {
    expect(isAuthRequiredError('ERROR: Video unavailable')).toBe(false)
    expect(isAuthRequiredError('ERROR: This video is private')).toBe(false)
  })
})

describe('cookieArgs', () => {
  it('returns yt-dlp args for a source and none when null', () => {
    expect(cookieArgs('chrome')).toEqual(['--cookies-from-browser', 'chrome'])
    expect(cookieArgs('edge')).toEqual(['--cookies-from-browser', 'edge'])
    expect(cookieArgs(null)).toEqual([])
  })
})

describe('AUTH_REQUIRED_MESSAGE', () => {
  it('explains that YouTube is requesting authentication', () => {
    expect(AUTH_REQUIRED_MESSAGE).toContain('Sign-in required to download this content')
  })
})

describe('BrowserCookieResolver', () => {
  it('resets cached results and failure marks', () => {
    const r = BrowserCookieResolver.instance
    r.rememberFailed('auto')
    expect(r.isKnownFailed('auto')).toBe(true)
    r.reset()
    expect(r.isKnownFailed('auto')).toBe(false)
  })

  it('remembers a winning source per mode and reuses it', () => {
    const r = BrowserCookieResolver.instance
    r.reset()
    r.rememberSuccess('auto', 'chrome')
    const order = r.getTryOrder('auto')
    expect(order[0]).toBe('chrome')
    r.reset()
  })
})
