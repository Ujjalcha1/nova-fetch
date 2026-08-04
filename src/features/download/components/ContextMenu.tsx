import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  FolderOpen, Copy, Pause, Play, RefreshCw,
  Trash2, ListX, Info, FileDown, Link
} from 'lucide-react'
import type { DownloadItem } from '../../../types/download'
import { electron } from '../../../lib/electron'
import { useDownloadStore } from '../../../store/download-store'
import { useSelectionStore } from '../../../store/selection-store'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContextMenuState = {
  x: number
  y: number
  download: DownloadItem
}

type Props = {
  state: ContextMenuState
  onClose: () => void
  /** Called when an action is taken that requires a parent re-selection */
  onOpenProperties?: (id: string) => void
  /** Called when the user wants to delete a download — opens the confirmation dialog in the parent */
  onDelete?: (id: string) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INACTIVE = new Set(['completed', 'failed', 'cancelled', 'paused'])

function canOpen(d: DownloadItem)  { return d.status === 'completed' && d.files.length > 0 }
function canPause(d: DownloadItem) { return d.status === 'downloading' }
function canResume(d: DownloadItem){ return d.status === 'paused' }
function canRetry(d: DownloadItem) { return d.status === 'failed' || d.status === 'cancelled' }
function canDelete(d: DownloadItem){ return INACTIVE.has(d.status) }

// ---------------------------------------------------------------------------
// MenuItem sub-component
// ---------------------------------------------------------------------------

type ItemProps = {
  icon: React.ElementType
  label: string
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}

function MenuItem({ icon: Icon, label, shortcut, danger = false, disabled = false, onClick }: ItemProps) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`
        group flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm
        transition-colors duration-100
        ${disabled
          ? 'cursor-not-allowed text-gray-600'
          : danger
            ? 'text-red-400 hover:bg-red-500/15 hover:text-red-300'
            : 'text-gray-200 hover:bg-white/[0.08] hover:text-white'
        }
      `}
    >
      <Icon
        size={14}
        className={`shrink-0 ${
          disabled ? 'text-gray-700' : danger ? 'text-red-500' : 'text-gray-400 group-hover:text-gray-200'
        }`}
      />
      <span className="flex-1">{label}</span>
      {shortcut && !disabled && (
        <span className="ml-4 font-mono text-[10px] text-gray-500">{shortcut}</span>
      )}
    </button>
  )
}

function Divider() {
  return <div className="my-1 h-px bg-white/[0.08]" />
}

// ---------------------------------------------------------------------------
// ContextMenu
// ---------------------------------------------------------------------------

const MENU_WIDTH  = 220
const MENU_MARGIN = 8

export default function ContextMenu({ state, onClose, onOpenProperties, onDelete }: Props) {
  const { x, y, download: d } = state
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click, Escape, scroll
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function onScroll() { onClose() }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [onClose])

  // Clamp position to viewport
  const vw = window.innerWidth
  const vh = window.innerHeight
  const estimatedH = 330
  const left = Math.min(x, vw - MENU_WIDTH - MENU_MARGIN)
  const top  = Math.min(y, vh - estimatedH - MENU_MARGIN)

  const updateDownload = useDownloadStore((s) => s.updateDownload)

  // ── Actions ──────────────────────────────────────────────────────────────

  async function handleOpen() {
    onClose()
    if (!canOpen(d)) return
    await electron.openFile(`${d.savePath}/${d.files[0].name}`)
  }

  async function handleOpenFolder() {
    onClose()
    if (!canOpen(d)) return
    await electron.openFolder(`${d.savePath}/${d.files[0].name}`)
  }

  function handleCopyURL() {
    onClose()
    navigator.clipboard.writeText(d.url)
  }

  function handleCopyFilePath() {
    onClose()
    if (!canOpen(d)) return
    navigator.clipboard.writeText(`${d.savePath}/${d.files[0].name}`)
  }

  async function handlePause() {
    onClose()
    // Read the latest download from the store at call time so we never
    // act on a stale closure value captured when the menu was rendered.
    const fresh = useDownloadStore.getState().downloads.find((item) => item.id === d.id)
    if (!fresh) return

    console.trace('[IPC RESUME CALL]', {
      function: 'handlePause',
      id: fresh.id,
      ids: [fresh.id],
      status: fresh.status,
      paused: fresh.status === 'paused',
      stack: new Error().stack,
    })
    console.log('[HANDLE PAUSE]', {
      id: fresh.id,
      status: fresh.status,
      paused: fresh.status === 'paused'
    })
    await electron.pause(fresh.id)
    updateDownload(fresh.id, { status: 'paused', speed: 0, eta: 0 })
  }

  async function handleResume() {
    onClose()
    console.trace('[IPC RESUME CALL]', {
      function: 'handleResume',
      id: d.id,
      ids: [d.id],
      status: d.status,
      paused: d.status === 'paused',
      stack: new Error().stack,
    })
    await electron.resume(d.id)
    updateDownload(d.id, { status: 'downloading' })
  }

  async function handleRetry() {
    onClose()
    console.trace('[IPC RESUME CALL]', {
      function: 'handleRetry',
      id: d.id,
      ids: [d.id],
      status: d.status,
      paused: d.status === 'paused',
      stack: new Error().stack,
    })
    updateDownload(d.id, { status: 'queued', error: undefined, failureDetails: undefined, retryCount: 0, retryAt: null })
    await electron.start({ id: d.id, url: d.url, outputPath: d.savePath, format: '' })
  }

  function handleDelete() {
    const { selected } = useSelectionStore.getState()
    onDelete?.(selected.length > 1 && selected.includes(d.id) ? selected[0] : d.id)
    onClose()
  }

  function handleRemove() {
    const { selected } = useSelectionStore.getState()
    onDelete?.(selected.length > 1 && selected.includes(d.id) ? selected[0] : d.id)
    onClose()
  }

  function handleProperties() {
    onClose()
    onOpenProperties?.(d.id)
  }

  // ── Menu portal ──────────────────────────────────────────────────────────

  const menuPortal = createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={{ left, top, width: MENU_WIDTH }}
      className="
        context-menu-in fixed z-[9999] select-none rounded-xl border border-white/[0.09]
        bg-[#1C2537] p-1.5 shadow-lg shadow-black/50
        backdrop-blur-sm
      "
    >
      {/* Header — file name */}
      <div className="mb-1.5 truncate px-2.5 pt-0.5 pb-2 border-b border-white/[0.07]">
        <p className="truncate text-[11px] font-semibold text-gray-300">{d.title}</p>
        <p className="mt-0.5 truncate font-mono text-[10px] text-gray-600">{d.status}</p>
      </div>

      {/* Open / Folder */}
      <MenuItem icon={FileDown}   label="Open"         disabled={!canOpen(d)}  onClick={handleOpen} />
      <MenuItem icon={FolderOpen} label="Open Folder"  disabled={!canOpen(d)}  onClick={handleOpenFolder} />

      <Divider />

      {/* Copy */}
      <MenuItem icon={Link}  label="Copy URL"       onClick={handleCopyURL} />
      <MenuItem icon={Copy}  label="Copy File Path" disabled={!canOpen(d)}  onClick={handleCopyFilePath} />

      <Divider />

      {/* Playback control */}
      <MenuItem icon={Pause}     label="Pause"   disabled={!canPause(d)}  onClick={handlePause} />
      <MenuItem icon={Play}      label="Resume"  disabled={!canResume(d)} onClick={handleResume} />
      <MenuItem icon={RefreshCw} label="Retry"   disabled={!canRetry(d)}  onClick={handleRetry} />

      <Divider />

      {/* Destructive */}
      <MenuItem icon={Trash2} label="Delete"           danger disabled={!canDelete(d)} onClick={handleDelete} />
      <MenuItem icon={ListX}  label="Remove From List" danger onClick={handleRemove} />

      <Divider />

      {/* Meta */}
      <MenuItem icon={Info} label="Properties" onClick={handleProperties} />
    </div>,
    document.body,
  )

  return (
    <>
      {menuPortal}
    </>
  )
}
