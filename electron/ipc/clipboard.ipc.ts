import { clipboard, BrowserWindow } from 'electron'

import { safeHandle } from './safeHandle'

let pollTimer: ReturnType<typeof setInterval> | null = null
let lastText = ''

const URL_PATTERN = /^(https?:\/\/[^\s]+|magnet:\?xt=urn:[^\s]+)$/i

function isDownloadUrl(text: string): boolean {
  return URL_PATTERN.test(text.trim())
}

function getWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
}

function poll() {
  try {
    const text = clipboard.readText().trim()
    if (!text || text === lastText) return
    lastText = text

    const win = getWindow()
    if (!win) return

    if (isDownloadUrl(text)) {
      win.webContents.send('clipboard:url-detected', text)
    }
  } catch {
    // ignore clipboard read errors
  }
}

export function registerClipboardIpc() {
  safeHandle('clipboard:start-monitoring', () => {
    if (pollTimer) return
    lastText = clipboard.readText().trim()
    pollTimer = setInterval(poll, 1500)
  })

  safeHandle('clipboard:stop-monitoring', () => {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    lastText = ''
  })
}
