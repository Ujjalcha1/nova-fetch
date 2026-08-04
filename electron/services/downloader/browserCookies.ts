import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app as electronApp } from 'electron'

const execFileAsync = promisify(execFile)

/**
 * Automatic browser cookie support for yt-dlp.
 *
 * yt-dlp can read cookies directly from an installed browser's cookie store
 * (no manual export needed) via `--cookies-from-browser <source>`. This module
 * resolves WHICH browser to use based on the user's setting:
 *
 *   - auto      (default) — try chrome, then edge, then brave, then firefox
 *   - chrome / edge / brave / firefox — that browser only
 *   - disabled  — never pass cookie arguments
 *
 * Failover rules:
 *   - If a browser's cookie store cannot be read (not installed, locked by the
 *     running browser, undecryptable), the next browser in the chain is tried.
 *   - If every browser fails to yield usable cookies, the operation is retried
 *     WITHOUT cookies — public content still works.
 *   - If YouTube still demands authentication (bot-check / age gate), a clear
 *     error is thrown: "YouTube is requesting authentication".
 *
 * This module is ONLY used on yt-dlp code paths (metadata, playlists, video
 * downloads). Plain HTTP downloads never touch it.
 */

export const BROWSER_COOKIE_SOURCES = ['chrome', 'edge', 'brave', 'firefox'] as const
export type BrowserCookieSource = (typeof BROWSER_COOKIE_SOURCES)[number]

export type CookiesMode = 'auto' | BrowserCookieSource | 'disabled'

export const COOKIES_MODES: readonly CookiesMode[] = [
  'auto',
  ...BROWSER_COOKIE_SOURCES,
  'disabled'
]

const isDev = electronApp ? !electronApp.isPackaged : true

function logDebug(...args: unknown[]): void {
  if (isDev) console.log('[BrowserCookies]', ...args)
}

function getResource(file: string): string {
  if (electronApp && electronApp.isPackaged) {
    return path.join(process.resourcesPath, 'resources', file)
  }
  return path.join(process.cwd(), 'resources', file)
}

// ---------------------------------------------------------------------------
// Mode parsing
// ---------------------------------------------------------------------------

export function isBrowserCookieSource(value: unknown): value is BrowserCookieSource {
  return (
    typeof value === 'string' &&
    (BROWSER_COOKIE_SOURCES as readonly string[]).includes(value)
  )
}

/** Maps any stored value to a valid CookiesMode (unknown/empty → 'auto'). */
export function normalizeCookiesMode(value: unknown): CookiesMode {
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    if (v === 'auto' || v === '') return 'auto'
    if (v === 'disabled' || v === 'none' || v === 'off') return 'disabled'
    if (isBrowserCookieSource(v)) return v
  }
  return 'auto'
}

// ---------------------------------------------------------------------------
// Offline browser detection (installation hints per platform)
// ---------------------------------------------------------------------------

const HOME = os.homedir()
const LOCAL_APP_DATA = process.env.LOCALAPPDATA ?? path.join(HOME, 'AppData', 'Local')

const BROWSER_INSTALL_HINTS: Record<BrowserCookieSource, string[]> = {
  chrome: [
    path.join(LOCAL_APP_DATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join('C:', 'Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join('C:', 'Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(HOME, 'Applications', 'Google Chrome.app'),
    '/Applications/Google Chrome.app',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable'
  ],
  edge: [
    path.join(LOCAL_APP_DATA, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join('C:', 'Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join('C:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(HOME, 'Applications', 'Microsoft Edge.app'),
    '/Applications/Microsoft Edge.app',
    '/usr/bin/microsoft-edge'
  ],
  brave: [
    path.join(LOCAL_APP_DATA, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    path.join('C:', 'Program Files', 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    path.join(HOME, 'Applications', 'Brave Browser.app'),
    '/Applications/Brave Browser.app',
    '/usr/bin/brave-browser'
  ],
  firefox: [
    path.join(LOCAL_APP_DATA, 'Mozilla Firefox', 'firefox.exe'),
    path.join('C:', 'Program Files', 'Mozilla Firefox', 'firefox.exe'),
    path.join('C:', 'Program Files (x86)', 'Mozilla Firefox', 'firefox.exe'),
    path.join(HOME, 'Applications', 'Firefox.app'),
    '/Applications/Firefox.app',
    '/usr/bin/firefox'
  ]
}

/** Installed browsers in the canonical priority order (chrome → firefox). */
export function detectInstalledBrowsers(): BrowserCookieSource[] {
  return BROWSER_COOKIE_SOURCES.filter((source) =>
    BROWSER_INSTALL_HINTS[source].some((p) => {
      try {
        return fs.existsSync(p)
      } catch {
        return false
      }
    })
  )
}

// ---------------------------------------------------------------------------
// Error classification (yt-dlp stderr)
// ---------------------------------------------------------------------------

const COOKIE_ERROR_PATTERNS: RegExp[] = [
  /unable to extract cookies/i,
  /failed to extract cookies/i,
  /could not extract cookies/i,
  /could not copy .*cookie/i,
  /could not find .*cookies database/i,
  /cookies database.*(not found|does not exist|no such file)/i,
  /no such file.*\bcookies?\b/i,
  /database is locked/i,
  /file is locked/i,
  /failed to decrypt/i,
  /decrypt.*dpapi/i,
  /dpapi/i,
  /wrong key/i,
  /master key/i,
  /keyring/i,
  /keychain/i,
  /safe storage/i,
  /app-bound/i,
  /being used by another process/i,
  /permission denied.*cookie/i
]

/** True when yt-dlp could not READ cookies from the requested browser. */
export function isCookieExtractionError(stderr: string): boolean {
  return COOKIE_ERROR_PATTERNS.some((re) => re.test(stderr))
}

const AUTH_REQUIRED_PATTERNS: RegExp[] = [
  /sign in to confirm/i,
  /confirm you'?re not a bot/i,
  /confirm you are not a bot/i,
  /log in to confirm/i,
  /requesting authentication/i,
  /must.*sign in/i,
  /needs.*sign in/i,
  /login required/i,
  /sign in.*to confirm/i,
  /sign in.*is required/i
]

/** True when YouTube itself asks the user to sign in (bot-check / age gate). */
export function isAuthRequiredError(stderr: string): boolean {
  return AUTH_REQUIRED_PATTERNS.some((re) => re.test(stderr))
}

export const AUTH_REQUIRED_MESSAGE =
  'YouTube is requesting authentication (sign-in required). ' +
  'Sign in to YouTube in your browser and try again, or change the browser ' +
  'cookie source in Settings.'

/** yt-dlp argument fragment for a resolved cookie source (or none). */
export function cookieArgs(source: BrowserCookieSource | null): string[] {
  return source ? ['--cookies-from-browser', source] : []
}

// ---------------------------------------------------------------------------
// Session resolver — remembers the first working source per mode
// ---------------------------------------------------------------------------

interface Winner {
  mode: CookiesMode
  source: BrowserCookieSource
}

export class BrowserCookieResolver {
  private winner: Winner | null = null
  private failedModes = new Set<CookiesMode>()

  private static get singleton(): BrowserCookieResolver {
    const self = BrowserCookieResolver as unknown as { __instance?: BrowserCookieResolver }
    if (!self.__instance) self.__instance = new BrowserCookieResolver()
    return self.__instance
  }

  static get instance(): BrowserCookieResolver {
    return BrowserCookieResolver.singleton
  }

  /** Forget cached results (e.g. when the user changes the setting). */
  reset(): void {
    this.winner = null
    this.failedModes.clear()
  }

  /** True when every candidate for this mode already failed to yield cookies. */
  isKnownFailed(mode: CookiesMode): boolean {
    return this.failedModes.has(mode)
  }

  /** Record that every candidate for a mode failed (session-scoped). */
  rememberFailed(mode: CookiesMode): void {
    this.failedModes.add(mode)
  }

  getCandidates(mode: CookiesMode): BrowserCookieSource[] {
    if (mode === 'disabled') return []
    if (mode === 'auto') return detectInstalledBrowsers()
    return [mode]
  }

  /** Order to try for a run: known winner first, then the rest. */
  getTryOrder(mode: CookiesMode): BrowserCookieSource[] {
    const candidates = this.getCandidates(mode)
    if (this.winner && this.winner.mode === mode) {
      return [this.winner.source, ...candidates.filter((c) => c !== this.winner!.source)]
    }
    return candidates
  }

  rememberSuccess(mode: CookiesMode, source: BrowserCookieSource): void {
    this.winner = { mode, source }
  }

  /**
   * Does yt-dlp accept this browser's cookies for the given URL?
   * Uses `--simulate` so nothing is written; cookie extraction runs before any
   * network request, so extraction failures fail fast and offline.
   */
  async probeCookieSource(
    source: BrowserCookieSource,
    url: string
  ): Promise<{ ok: boolean; cookieError: boolean; authError: boolean; stderr: string }> {
    const ytDlp = getResource('yt-dlp.exe')
    if (!fs.existsSync(ytDlp)) {
      return { ok: false, cookieError: false, authError: false, stderr: 'yt-dlp.exe not found' }
    }

    try {
      await execFileAsync(
        ytDlp,
        ['--cookies-from-browser', source, '--simulate', '--no-warnings', url],
        { timeout: 25_000 }
      )
      return { ok: true, cookieError: false, authError: false, stderr: '' }
    } catch (err) {
      const stderr = String((err as { stderr?: unknown })?.stderr ?? '')
      return {
        ok: false,
        cookieError: isCookieExtractionError(stderr),
        authError: isAuthRequiredError(stderr),
        stderr
      }
    }
  }

  /**
   * Resolve a working cookie source before running an operation that streams
   * (e.g. a video download, where we cannot retry mid-transfer). Returns null
   * when the operation should run WITHOUT cookies (disabled, or every browser
   * failed to yield cookies for public content).
   */
  async resolve(mode: CookiesMode, url: string): Promise<BrowserCookieSource | null> {
    if (mode === 'disabled') return null
    if (this.winner && this.winner.mode === mode) return this.winner.source
    if (this.isKnownFailed(mode)) return null

    const candidates = this.getCandidates(mode)
    if (candidates.length === 0) return null

    let lastAuthCandidate: BrowserCookieSource | null = null

    for (const candidate of candidates) {
      const probe = await this.probeCookieSource(candidate, url)
      if (probe.ok) {
        logDebug(`resolved cookie source: ${candidate}`)
        this.rememberSuccess(mode, candidate)
        return candidate
      }
      if (probe.cookieError) {
        logDebug(`cookie extraction failed for ${candidate}, trying next`)
        continue
      }
      if (probe.authError) {
        // Cookies extracted but YouTube wants auth — try another browser whose
        // session might be signed in, and remember this one as a last resort.
        logDebug(`auth required with ${candidate}, trying next`)
        lastAuthCandidate = candidate
        continue
      }
      // Cookies are fine; the operation failed for a real (non-cookie) reason.
      logDebug(`cookies accepted for ${candidate} (operation failed for another reason)`)
      this.rememberSuccess(mode, candidate)
      return candidate
    }

    // Every candidate failed to yield usable cookies this session.
    this.rememberFailed(mode)
    return lastAuthCandidate
  }
}

// ---------------------------------------------------------------------------
// Run a yt-dlp command to completion with cookie failover (metadata/playlists)
// ---------------------------------------------------------------------------

export interface YtDlpRunResult {
  ok: boolean
  stdout: string
  stderr: string
  code?: number | string
  killed?: boolean
  message?: string
}

async function execYtDlp(args: string[], timeout: number): Promise<YtDlpRunResult> {
  const ytDlp = getResource('yt-dlp.exe')
  try {
    const res = await execFileAsync(ytDlp, args, { timeout, maxBuffer: 64 * 1024 * 1024 })
    return { ok: true, stdout: res.stdout, stderr: res.stderr }
  } catch (err) {
    const e = err as {
      code?: number | string
      killed?: boolean
      message?: string
      stdout?: string
      stderr?: string
    }
    return {
      ok: false,
      stdout: String(e.stdout ?? ''),
      stderr: String(e.stderr ?? ''),
      code: e.code,
      killed: e.killed,
      message: e.message
    }
  }
}

/**
 * Runs `yt-dlp` with `--dump-json`-style arguments (given by `baseArgs`, which
 * must NOT contain the URL) applying the cookie mode with full failover:
 *
 *   1. try each candidate browser in order;
 *   2. on cookie-extraction failure → next browser;
 *   3. if cookies worked but YouTube demands auth → next browser (auto mode);
 *   4. if every browser failed → retry WITHOUT cookies (public content);
 *   5. if YouTube still demands auth → throw AUTH_REQUIRED_MESSAGE.
 *
 * Resolves to the winning `{ result, cookieSource }`.
 */
export async function runYtDlpWithCookies(
  mode: CookiesMode,
  url: string,
  baseArgs: string[],
  timeout: number
): Promise<{ result: YtDlpRunResult; cookieSource: BrowserCookieSource | null }> {
  const resolver = BrowserCookieResolver.instance

  // Disabled — no cookie attempts at all.
  if (mode === 'disabled') {
    const result = await execYtDlp([...baseArgs, url], timeout)
    if (!result.ok && isAuthRequiredError(result.stderr)) {
      throw new Error(AUTH_REQUIRED_MESSAGE)
    }
    return { result, cookieSource: null }
  }

  // Every candidate already failed to yield cookies this session — run without
  // them directly (public content still works) instead of re-probing each time.
  if (resolver.isKnownFailed(mode)) {
    const result = await execYtDlp([...baseArgs, url], timeout)
    if (!result.ok && isAuthRequiredError(result.stderr)) {
      throw new Error(AUTH_REQUIRED_MESSAGE)
    }
    return { result, cookieSource: null }
  }

  const order = resolver.getTryOrder(mode)
  let lastAuthCandidate: BrowserCookieSource | null = null

  for (const candidate of order) {
    const result = await execYtDlp([...baseArgs, ...cookieArgs(candidate), url], timeout)
    if (result.ok) {
      logDebug(`cookie source ${candidate} worked`)
      resolver.rememberSuccess(mode, candidate)
      return { result, cookieSource: candidate }
    }
    if (isCookieExtractionError(result.stderr)) {
      logDebug(`cookie extraction failed for ${candidate}, trying next`)
      continue
    }
    if (isAuthRequiredError(result.stderr)) {
      logDebug(`auth required with ${candidate}, trying next`)
      lastAuthCandidate = candidate
      continue
    }
    // Cookies accepted — the command failed for a real (non-cookie) reason.
    logDebug(`cookies accepted for ${candidate} (real failure: ${result.stderr.slice(0, 120)})`)
    resolver.rememberSuccess(mode, candidate)
    return { result, cookieSource: candidate }
  }

  // Some browser's cookies extracted but YouTube still demands auth.
  if (lastAuthCandidate) {
    throw new Error(AUTH_REQUIRED_MESSAGE)
  }

  // Every browser failed to yield cookies — retry without them.
  resolver.rememberFailed(mode)
  logDebug('all browsers failed cookie extraction; retrying without cookies')
  const noCookies = await execYtDlp([...baseArgs, url], timeout)
  if (!noCookies.ok && isAuthRequiredError(noCookies.stderr)) {
    throw new Error(AUTH_REQUIRED_MESSAGE)
  }
  return { result: noCookies, cookieSource: null }
}
