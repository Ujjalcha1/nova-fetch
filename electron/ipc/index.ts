import { registerDownloadIpc } from './download.ipc'
import { registerSettingsIpc } from './settings.ipc'
import { registerClipboardIpc } from './clipboard.ipc'
import { registerUpdateIpc } from './update.ipc'

export function registerIpc() {
  registerDownloadIpc()
  registerSettingsIpc()
  registerClipboardIpc()
  registerUpdateIpc()
}
