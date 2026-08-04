/**
 * Structured error helpers shared by the IPC layer.
 *
 * Every ipcMain.handle registration is routed through safeHandle() so that no
 * handler can ever leave a floating rejection behind. Errors thrown by a
 * handler are converted into an IpcError (code + message + details), logged
 * once, and re-thrown so Electron forwards them to the renderer exactly as it
 * does today (a rejected invoke()). Renderer behavior is therefore unchanged
 * while the main process gets a consistent, structured error and a guarantee
 * that nothing is left unhandled.
 */

export interface IpcErrorOptions {
  code?: string
  details?: unknown
  cause?: unknown
}

export class IpcError extends Error {
  readonly code?: string
  readonly details?: unknown

  constructor(message: string, options?: IpcErrorOptions) {
    super(message)
    this.name = 'IpcError'
    this.code = options?.code
    this.details = options?.details
  }
}

/**
 * Convert any thrown value into an IpcError. Preserves an existing `.code`
 * when present (e.g. yt-dlp exit codes or Node error codes) so the structured
 * error keeps useful metadata.
 */
export function toStructuredIpcError(err: unknown, fallbackCode = 'IPC_ERROR'): IpcError {
  if (err instanceof IpcError) return err
  if (err instanceof Error) {
    const code = (err as Error & { code?: string }).code
    return new IpcError(err.message, { code: code ?? fallbackCode, cause: err })
  }
  return new IpcError(String(err), { code: fallbackCode })
}
