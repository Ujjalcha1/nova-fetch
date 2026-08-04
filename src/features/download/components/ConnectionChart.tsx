import { useState, useEffect } from 'react'
import { useDownloadStore } from '../../../store/download-store'

const COLORS = { HTTP: '#3b82f6', Torrent: '#22c55e', Other: '#6b7280' }

function classifyProtocol(host: string): 'HTTP' | 'Torrent' | 'Other' {
  const h = host.toLowerCase()
  if (h.includes('tracker') || h.includes('announce') || h.includes('torrent')) return 'Torrent'
  if (h.startsWith('http')) return 'HTTP'
  return 'Other'
}

export default function ConnectionChart() {
  const [, setTick] = useState(0)
  const downloads = useDownloadStore((s) => s.downloads)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const allConnections = downloads.flatMap((d) => d.connections ?? [])
  const counts = { HTTP: 0, Torrent: 0, Other: 0 }
  for (const conn of allConnections) {
    if (conn?.host) counts[classifyProtocol(conn.host)]++
  }

  const total = counts.HTTP + counts.Torrent + counts.Other
  const size = 140
  const stroke = 20
  const r = (size - stroke) / 2
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r

  const keys = ['HTTP', 'Torrent', 'Other'] as const
  const segments = total > 0 ? keys.filter((k) => counts[k] > 0) : []

  let offset = 0
  const arcs = segments.map((key) => {
    const ratio = counts[key] / total
    const dash = ratio * circ
    const seg = { key, color: COLORS[key], dash, offset, ratio }
    offset -= dash
    return seg
  })

  return (
    <div className="mt-4">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Connection Protocol
      </div>
      <div className="flex items-center gap-4 rounded-xl bg-[#1A2232] p-3">
        <svg width={size} height={size} className="-rotate-90 shrink-0">
          {total > 0 ? (
            arcs.map((seg) => (
              <circle
                key={seg.key}
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={stroke}
                strokeDasharray={`${seg.dash} ${circ - seg.dash}`}
                strokeDashoffset={seg.offset}
              />
            ))
          ) : (
            <circle
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={stroke}
              strokeDasharray={`${circ * 0.25} ${circ * 0.75}`}
            />
          )}
        </svg>

        <div className="flex flex-col gap-2">
          {keys.map((key) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[key] }} />
              <span className="w-12 text-gray-400">{key}</span>
              <span className="tabular-nums text-white">{counts[key]}</span>
              <span className="text-gray-500">
                {total > 0 ? `(${Math.round((counts[key] / total) * 100)}%)` : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
