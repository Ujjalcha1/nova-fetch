import { memo } from 'react'

interface Props {
  title: string
  progress: number
  speed: string
  eta: string
  status: 'downloading' | 'waiting' | 'completed'
}

function QueueCard({ title, progress, speed, eta, status }: Props) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-[#111827] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] transition-all duration-200 hover:border-white/12 hover:bg-[#131B2B]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Queue Item</div>
          <h3 className="truncate text-sm font-medium leading-6 text-white">{title}</h3>
        </div>

        <span
          className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold
          ${
            status === 'downloading'
              ? 'bg-blue-500/10 text-blue-300'
              : status === 'completed'
                ? 'bg-emerald-500/10 text-emerald-300'
                : 'bg-amber-500/10 text-amber-300'
          }`}
        >
          {status}
        </span>
      </div>

      <div className="mt-5 space-y-2 rounded-2xl border border-white/8 bg-white/4 p-4">
        <div className="h-2 overflow-hidden rounded-full bg-slate-800/80">
          <div
            className="h-full rounded-full bg-linear-to-r from-violet-500 via-cyan-500 to-emerald-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs font-medium text-slate-500">
          <span>{progress}%</span>
          <span>{status === 'downloading' ? 'Live' : status === 'completed' ? 'Done' : 'Waiting'}</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-2xl border border-white/8 bg-white/4 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Progress</p>
          <p className="mt-2 font-medium text-white">{progress}%</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/4 p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Speed</p>
          <p className="mt-2 font-medium text-white">{speed}</p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/4 p-3 text-right">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">ETA</p>
          <p className="mt-2 font-medium text-white">{eta}</p>
        </div>
      </div>
    </div>
  )
}

export default memo(QueueCard)
