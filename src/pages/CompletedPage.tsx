import { FolderOpen, FileDown, RotateCcw, Trash2, CheckCircle2, Play, Folder } from 'lucide-react'
import { useDownloadStore } from '../store/download-store'
import { useNavigationStore } from '../store/navigation-store'
import { electron } from '../lib/electron'
import DownloadList from '../features/download/components/DownloadList'
import DetailsPanel from '../features/details/components/DetailsPanel'

// ---------------------------------------------------------------------------
// Toolbar button — consistent style across all actions
// ---------------------------------------------------------------------------

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  danger = false,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium
        transition-colors duration-150
        disabled:cursor-not-allowed disabled:opacity-40
        ${danger
          ? 'bg-[#1A2232] text-red-400 hover:bg-red-600 hover:text-white'
          : 'bg-[#1A2232] text-gray-200 hover:bg-violet-600 hover:text-white'
        }
      `}
    >
      <Icon size={15} />
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// CompletedPage
// ---------------------------------------------------------------------------

export default function CompletedPage() {
  const activeId = useDownloadStore((s) => s.activeId)
  const downloads = useDownloadStore((s) => s.downloads)
  const removeDownload = useDownloadStore((s) => s.removeDownload)
  const selectDownload = useDownloadStore((s) => s.selectDownload)
  const navigate = useNavigationStore((s) => s.navigate)

  const selected = activeId ? downloads.find((d) => d.id === activeId) : null
  const hasFiles  = !!(selected && selected.files.length > 0)

  // ── Helpers ────────────────────────────────────────────────────────────────

  function filePath(index = 0) {
    return `${selected!.savePath}/${selected!.files[index].name}`
  }

  async function handleOpen() {
    if (!hasFiles) return
    await electron.openFile(filePath())
  }

  async function handlePlay() {
    if (!hasFiles) return
    // openFile lets the OS decide the default player — same as double-clicking
    await electron.openFile(filePath())
  }

  async function handleOpenFolder() {
    if (!hasFiles) return
    await electron.openFolder(filePath())
  }

  /** Reveal in Folder = openFolder on the file — highlights the file in Explorer */
  async function handleReveal() {
    if (!hasFiles) return
    await electron.openFolder(filePath())
  }

  async function handleRedownload() {
    if (!selected) return
    await electron.start({
      id: crypto.randomUUID(),
      url: selected.url,
      outputPath: selected.savePath,
      format: ''
    })
  }

  function handleDelete() {
    if (!selected) return
    removeDownload(selected.id)
    if (activeId === selected.id) selectDownload(null as unknown as string)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
        <ToolbarButton icon={FileDown}   label="Open"             disabled={!hasFiles} onClick={handleOpen}       />
        <ToolbarButton icon={Play}       label="Play"             disabled={!hasFiles} onClick={handlePlay}       />
        <ToolbarButton icon={FolderOpen} label="Open Folder"      disabled={!hasFiles} onClick={handleOpenFolder}  />
        <ToolbarButton icon={Folder}     label="Reveal in Folder" disabled={!hasFiles} onClick={handleReveal}     />

        <div className="mx-1 h-5 w-px bg-white/10" />

        <ToolbarButton icon={RotateCcw}  label="Redownload"       disabled={!selected} onClick={handleRedownload} />
        <ToolbarButton icon={Trash2}     label="Delete"  danger   disabled={!selected} onClick={handleDelete}     />
      </div>

      {/* Download list */}
      <div className="flex-1 overflow-hidden">
        <DownloadList
          statusFilter="completed"
          emptyState={{
            icon: CheckCircle2,
            title: 'No Completed Downloads',
            description: 'Your completed downloads will appear here.',
            action: { label: 'Go to Downloads', onClick: () => navigate('downloads') }
          }}
        />
      </div>

      {/* Details panel */}
      <div className="h-72 border-t border-white/10 bg-[#111827]">
        <DetailsPanel />
      </div>
    </div>
  )
}
