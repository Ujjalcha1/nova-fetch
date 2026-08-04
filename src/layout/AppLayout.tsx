import Sidebar from './Sidebar'
import Toolbar from './Toolbar'
import StatusBar from './StatusBar'
import NewDownloadDialog from '../features/dialogs/NewDownloadDialog'
import SettingsDialog from '../features/settings/SettingsDialog'
import Toast from '../components/common/Toast'
import DragDropOverlay from '../components/common/DragDropOverlay'
import { useDialogStore } from '../store/dialog-store'

type Props = {
  children: React.ReactNode
}

export default function AppLayout({ children }: Props) {
  const showNewDownload = useDialogStore((s) => s.showNewDownload)
  const closeNewDownload = useDialogStore((s) => s.closeNewDownload)
  const openNewDownload = useDialogStore((s) => s.openNewDownload)
  const showSettings = useDialogStore((s) => s.showSettings)
  const openSettings = useDialogStore((s) => s.openSettings)
  const closeSettings = useDialogStore((s) => s.closeSettings)

  return (
    <div className="flex h-screen bg-[#0E131C] text-white">
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <Toolbar onNewDownload={openNewDownload} onOpenSettings={openSettings} />

        <main className="flex-1 overflow-hidden">{children}</main>

        <StatusBar />
      </div>

      {showNewDownload && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={closeNewDownload}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <NewDownloadDialog onClose={closeNewDownload} />
          </div>
        </div>
      )}

      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={closeSettings}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <SettingsDialog onClose={closeSettings} />
          </div>
        </div>
      )}

      <Toast />
      <DragDropOverlay />
    </div>
  )
}