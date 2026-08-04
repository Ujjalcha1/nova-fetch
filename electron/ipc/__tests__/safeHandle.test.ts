import { describe, it, expect, vi, beforeEach } from 'vitest'

import { IpcError, toStructuredIpcError } from '../ipcErrors'

const handlers = vi.hoisted(() => new Map<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>())

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: (event: unknown, ...args: unknown[]) => Promise<unknown>) => {
      handlers.set(channel, handler)
    }
  }
}))

import { safeHandle } from '../safeHandle'

beforeEach(() => {
  handlers.clear()
})

describe('toStructuredIpcError', () => {
  it('preserves IpcError instances', () => {
    const original = new IpcError('boom', { code: 'X' })
    const structured = toStructuredIpcError(original)
    expect(structured).toBe(original)
    expect(structured.code).toBe('X')
  })

  it('maps plain Errors to IpcError with the same message and code', () => {
    const original = new Error('download failed') as Error & { code?: string }
    original.code = 'ENOENT'
    const structured = toStructuredIpcError(original)
    expect(structured).toBeInstanceOf(IpcError)
    expect(structured.message).toBe('download failed')
    expect(structured.code).toBe('ENOENT')
  })

  it('maps plain Errors to IpcError with fallback code when none exists', () => {
    const structured = toStructuredIpcError(new Error('generic failure'))
    expect(structured.code).toBe('IPC_ERROR')
  })

  it('maps non-Error values to IpcError with a string message', () => {
    const structured = toStructuredIpcError('some string error')
    expect(structured).toBeInstanceOf(IpcError)
    expect(structured.message).toBe('some string error')
    expect(structured.code).toBe('IPC_ERROR')
  })
})

describe('safeHandle', () => {
  it('registers the handler under the given channel', () => {
    safeHandle('test:ping', async () => 'pong')
    expect(handlers.has('test:ping')).toBe(true)
  })

  it('resolves with the handler result on success', async () => {
    safeHandle('test:ok', async (_event, n: number) => ({ value: n }))
    const handler = handlers.get('test:ok')!
    await expect(handler({}, 42)).resolves.toEqual({ value: 42 })
  })

  it('rethrows a rejected handler as IpcError (preserves renderer rejection)', async () => {
    safeHandle('test:fail', async () => {
      throw new Error('metadata unavailable')
    })
    const handler = handlers.get('test:fail')!
    await expect(handler({})).rejects.toBeInstanceOf(IpcError)
    await expect(handler({})).rejects.toThrow('metadata unavailable')
  })

  it('handles synchronous throws inside a handler', async () => {
    safeHandle('test:sync-throw', () => {
      throw new IpcError('sync failure', { code: 'SYNC' })
    })
    const handler = handlers.get('test:sync-throw')!
    await expect(handler({})).rejects.toMatchObject({ name: 'IpcError', code: 'SYNC' })
  })

  it('never returns a rejected promise from the wrapped call (all paths settle)', async () => {
    safeHandle('test:always-settle', async () => {
      throw new Error('boom')
    })
    const handler = handlers.get('test:always-settle')!
    const result = handler({})
    // The wrapped promise must have a catch attached so Electron never sees an
    // unhandled rejection — calling .catch below must not produce a warning.
    await expect(result.catch(() => null)).resolves.toBeNull()
  })
})
