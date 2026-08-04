import type { LucideIcon } from 'lucide-react'
import { DownloadCloud, ClipboardPaste, ArrowDownToLine } from 'lucide-react'

type Props = {
  icon?: LucideIcon
  title?: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export default function EmptyState({ icon: Icon = DownloadCloud, title = 'No Downloads', description = 'Click "Add Download" to start downloading.', action }: Props) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-violet-500/10">
        <Icon size={48} className="text-violet-400" />
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <p className="mt-2 text-sm text-gray-400">{description}</p>
      </div>

      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-medium transition hover:bg-violet-500"
        >
          <DownloadCloud size={16} />
          {action.label}
        </button>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-dashed border-white/10 px-4 py-2">
        <ClipboardPaste size={14} className="text-gray-500" />
        <span className="text-xs text-gray-500">Paste a URL to start downloading</span>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-gray-600">
        <ArrowDownToLine size={12} />
        <span>Or drag and drop files anywhere</span>
      </div>
    </div>
  )
}