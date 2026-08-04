import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { UpdateCheckResult } from '../../types/electron'

type Props = {
  result: UpdateCheckResult
  onClose: () => void
  onUpdate: () => void
  /** True while the installer is downloading; disables the Update button. */
  downloading?: boolean
  /** Download progress 0-100, or null before progress starts. */
  progress?: number | null
}

/**
 * UpdateAvailableDialog — shows the outcome of an update check.
 *
 * Displays the current and latest versions plus release notes, with actions
 * that depend on whether the update is forced:
 *
 *   Optional (forceUpdate === false):
 *     Close (X), Later, and Update; dismissible via Escape or outside click.
 *   Forced (forceUpdate === true):
 *     Only "Update Now" is shown. Close (X), Later, Escape, and outside-click
 *     dismissal are all blocked so the dialog stays visible until the update
 *     starts.
 *
 * While the installer downloads, `downloading` disables the Update button and
 * the label shows live progress. The dialog is presentational: it renders
 * whatever UpdateCheckResult it is given and never performs a check on its
 * own.
 */
export default function UpdateAvailableDialog({
  result,
  onClose,
  onUpdate,
  downloading = false,
  progress = null
}: Props): React.JSX.Element {
  const isForced = result.forceUpdate

  // Escape dismisses optional updates but is blocked for forced updates so the
  // dialog cannot be closed until the update starts.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key !== 'Escape') return
      if (isForced) return
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isForced, onClose])

  return (
    <div className="flex w-[460px] flex-col overflow-hidden rounded-2xl bg-[#111827] shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <h2 className="text-xl font-bold">Update Available</h2>
        {!isForced && (
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <div className="space-y-4 px-6 py-5">
        <div>
          <p className="text-sm text-gray-400">Current Version</p>
          <p className="text-lg font-semibold text-gray-100">{result.currentVersion}</p>
        </div>

        <div>
          <p className="text-sm text-gray-400">Latest Version</p>
          <p className="text-lg font-semibold text-violet-400">{result.latestVersion}</p>
        </div>

        <div>
          <p className="text-sm text-gray-400">Release Notes</p>
          <div className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-[#1A2232] p-3 text-sm leading-relaxed text-gray-300">
            {result.releaseNotes || 'No release notes provided.'}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-white/10 px-6 py-4">
        {!isForced && (
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-gray-300 transition hover:bg-white/10"
          >
            Later
          </button>
        )}
        <button
          onClick={onUpdate}
          disabled={downloading}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {downloading
            ? `Downloading${progress !== null ? ` ${Math.round(progress)}%` : '…'}`
            : isForced
              ? 'Update Now'
              : 'Update'}
        </button>
      </div>
    </div>
  )
}
