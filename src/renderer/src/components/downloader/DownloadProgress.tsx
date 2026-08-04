import { FolderOpen, Loader2, XCircle, CheckCircle2, AlertTriangle } from 'lucide-react'

import type { QueueStatus } from '../../types/queue'

interface Props {
  progress: number
  speed: string
  eta: string
  status: QueueStatus
  folder: string
  onCancel(): void
}

export default function DownloadProgress({
  progress,
  speed,
  eta,
  status,
  folder,
  onCancel
}: Props) {
  const safeProgress = Math.min(Math.max(progress, 0), 100)

  if (status === 'completed') {
    return (
      <div className="mt-6 rounded-2xl border border-emerald-600/30 bg-emerald-500/10 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={28} className="mt-0.5 text-emerald-400" />

            <div>
              <h3 className="text-lg font-semibold text-emerald-400">Download Completed</h3>

              <p className="mt-1 text-sm text-slate-400">
                Your file has been downloaded successfully.
              </p>
            </div>
          </div>

          <button
            disabled={!folder}
            onClick={() => window.api.system.openFolder(folder)}
            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FolderOpen size={18} />
            Open Folder
          </button>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="mt-6 rounded-2xl border border-red-600/30 bg-red-500/10 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle size={28} className="mt-0.5 text-red-400" />

          <div>
            <h3 className="text-lg font-semibold text-red-400">Download Failed</h3>

            <p className="mt-1 text-sm text-slate-400">
              Something went wrong while downloading this video.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'cancelled') {
    return (
      <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-5">
        <div className="flex items-start gap-3">
          <XCircle size={28} className="mt-0.5 text-slate-400" />

          <div>
            <h3 className="text-lg font-semibold text-slate-300">Download Cancelled</h3>

            <p className="mt-1 text-sm text-slate-500">The download was cancelled by the user.</p>
          </div>
        </div>
      </div>
    )
  }

  const waiting = status === 'waiting'

  return (
    <div className="mt-6 rounded-2xl border border-slate-700 bg-[#111827] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(waiting || status === 'downloading') && (
            <Loader2 size={18} className="animate-spin text-cyan-400" />
          )}

          <span className="font-semibold capitalize text-white">{status}</span>
        </div>

        <span className="font-semibold text-cyan-400">{safeProgress.toFixed(1)}%</span>
      </div>

      <div className="h-3 overflow-hidden rounded-full bg-slate-700">
        <div
          className="h-full rounded-full bg-linear-to-r from-violet-500 via-cyan-500 to-emerald-500 transition-all duration-300"
          style={{
            width: `${safeProgress}%`
          }}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-slate-500">Speed</p>

          <p className="mt-1 font-medium text-white">{speed || '-'}</p>
        </div>

        <div>
          <p className="text-slate-500">ETA</p>

          <p className="mt-1 font-medium text-white">{eta || '-'}</p>
        </div>
      </div>

      {status === 'downloading' && (
        <button
          onClick={onCancel}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 font-medium text-white transition hover:bg-red-700"
        >
          <XCircle size={18} />
          Cancel Download
        </button>
      )}
    </div>
  )
}
