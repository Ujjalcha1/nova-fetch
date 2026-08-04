import { useState } from 'react'
import { Link } from 'lucide-react'
import { useDialogStore } from '../../store/dialog-store'

type Props = {
  url: string
  onDismiss: () => void
}

export default function ClipboardNotification({ url, onDismiss }: Props) {
  const [dismissed, setDismissed] = useState(false)

  function handleDownload() {
    useDialogStore.getState().openNewDownload(url)
    setDismissed(true)
    onDismiss()
  }

  function handleIgnore() {
    setDismissed(true)
    onDismiss()
  }

  if (dismissed) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-xl border border-white/10 bg-[#1A2232] px-4 py-3 shadow-lg">
      <div className="rounded-full bg-violet-500/20 p-2">
        <Link size={16} className="text-violet-400" />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium">Download detected</span>
        <span className="max-w-[260px] truncate text-xs text-gray-400">{url}</span>
      </div>
      <div className="ml-2 flex gap-2">
        <button
          onClick={handleDownload}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium transition hover:bg-violet-500"
        >
          Download
        </button>
        <button
          onClick={handleIgnore}
          className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium transition hover:bg-white/20"
        >
          Ignore
        </button>
      </div>
    </div>
  )
}
