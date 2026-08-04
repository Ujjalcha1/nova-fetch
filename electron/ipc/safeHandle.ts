import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { IpcError, toStructuredIpcError } from './ipcErrors'

type IpcHandler<Args extends unknown[]> = (
  event: IpcMainInvokeEvent,
  ...args: Args
) => unknown

/**
 * Register an ipcMain.handle that can never leave an unhandled rejection
 * behind, while preserving the exact renderer contract:
 *
 *   - the handler's result is awaited inside a try/catch, so a synchronous
 *     throw, a rejected promise, or a "thenable" that rejects are all
 *     converted into a structured IpcError (code + message + details);
 *   - the error is logged once in the main process (visible in the app log);
 *   - the structured IpcError is re-thrown, so `ipcRenderer.invoke()` still
 *     rejects with the original message — renderer code that reads
 *     `err.message` (or checks rejection) keeps working unchanged.
 *
 * Because every promise produced by the wrapped handler is consumed inside
 * this function, `ipcMain.handle` never sees a rejection it has to swallow,
 * and Node never emits UnhandledPromiseRejectionWarning for these channels.
 */
export function safeHandle<Args extends unknown[]>(
  channel: string,
  handler: IpcHandler<Args>
): void {
  ipcMain.handle(channel, async (event, ...args: unknown[]) => {
    try {
      return await handler(event, ...(args as unknown as Args))
    } catch (err) {
      const structured = toStructuredIpcError(err)
      if (structured instanceof IpcError && structured.details) {
        console.error(`[IPC] ${channel} failed: ${structured.message}`, structured.details)
      } else {
        console.error(`[IPC] ${channel} failed: ${structured.message}`)
      }
      throw structured
    }
  })
}
