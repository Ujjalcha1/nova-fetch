import { useState, useRef, useEffect } from 'react'
import { useDownloadStore } from '../../../store/download-store'
import type { DownloadPriority } from '../../../types/download'

const PRIORITIES: DownloadPriority[] = ['very-low', 'low', 'normal', 'high', 'very-high']

const CONFIG: Record<DownloadPriority, { label: string; active: string; bg: string }> = {
  'very-low':  { label: 'Very Low',  active: 'text-gray-600', bg: 'bg-gray-500/10' },
  low:         { label: 'Low',       active: 'text-gray-400', bg: 'bg-gray-500/15' },
  normal:      { label: 'Normal',    active: 'text-blue-400', bg: 'bg-blue-500/15' },
  high:        { label: 'High',      active: 'text-orange-400', bg: 'bg-orange-500/15' },
  'very-high': { label: 'Very High', active: 'text-red-400', bg: 'bg-red-500/15' },
}

type Props = {
  id: string
  priority: DownloadPriority
  disabled?: boolean
}

export default function PriorityPicker({ id, priority, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const setPriority = useDownloadStore((s) => s.setPriority)
  const cfg = CONFIG[priority]

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${cfg.bg} ${cfg.active} ${disabled ? 'cursor-default opacity-60' : 'cursor-pointer hover:opacity-80'}`}
      >
        {cfg.label}
      </button>

      {open && (
        <div className="absolute left-1/2 top-full z-50 mt-1 w-[110px] -translate-x-1/2 rounded-lg border border-white/10 bg-[#1C2537] p-1 shadow-lg">
          {PRIORITIES.map((p) => {
            const c = CONFIG[p]
            const selected = p === priority
            return (
              <button
                key={p}
                onClick={() => {
                  setPriority(id, p)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition ${c.active} ${selected ? c.bg : 'hover:bg-white/5'}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${selected ? 'bg-current' : 'bg-current opacity-30'}`} />
                {c.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
