import { useState, useEffect, useRef } from 'react'
import { useDownloadStore } from '../../../store/download-store'
import { formatSpeed } from '../../../lib/format'

const MAX_POINTS = 60
const HEIGHT = 160
const PAD = { top: 16, bottom: 24, left: 64, right: 16 }
const MIN_Y_MAX = 1024 * 1024

function niceMax(value: number): number {
  if (value <= 0) return MIN_Y_MAX
  const mag = Math.pow(10, Math.floor(Math.log10(value)))
  const norm = value / mag
  return (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag
}

function catmullRomPath(
  points: number[],
  offset: number,
  mapX: (i: number) => number,
  mapY: (v: number) => number
): string {
  const n = points.length
  if (n === 0) return ''
  const pts = points.map((v, i) => ({ x: mapX(offset + i), y: mapY(v) }))
  if (n === 1) return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
  const d: string[] = [`M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`]
  for (let i = 1; i < n; i++) {
    const p1 = pts[i - 1], p2 = pts[i]
    const p0 = i >= 2 ? pts[i - 2] : { x: pts[0].x - (pts[1].x - pts[0].x), y: pts[0].y }
    const p3 = i < n - 1 ? pts[i + 1] : { x: pts[n - 1].x + (pts[n - 1].x - pts[n - 2].x), y: pts[n - 1].y }
    d.push(`C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)},${(p1.y + (p2.y - p0.y) / 6).toFixed(1)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)},${(p2.y - (p3.y - p1.y) / 6).toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`)
  }
  return d.join(' ')
}

export default function SpeedGraph() {
  const [, setTick] = useState(0)
  const targetRef = useRef<number[]>([])
  const displayRef = useRef<number[]>([])
  const rafRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      const { downloads } = useDownloadStore.getState()
      const active = downloads.filter((d) => d.status === 'downloading')
      const speed = active.reduce((sum, d) => sum + d.speed, 0)
      if (active.length > 0) {
        targetRef.current.push(speed)
        if (targetRef.current.length > MAX_POINTS) targetRef.current.shift()
      }
      setTick((t) => t + 1)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let alive = true
    function frame() {
      if (!alive) return
      const t = targetRef.current, d = displayRef.current
      while (d.length < t.length) d.push(0)
      while (d.length > t.length) d.pop()
      let dirty = false
      for (let i = 0; i < d.length; i++) {
        const diff = t[i] - d[i]
        if (Math.abs(diff) > 1) { d[i] += diff * 0.18; dirty = true }
        else d[i] = t[i]
      }
      if (dirty) setTick((x) => x + 1)
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => { alive = false; cancelAnimationFrame(rafRef.current) }
  }, [])

  const points = displayRef.current
  const hasActiveDownloads = useDownloadStore((s) => s.downloads.some((d) => d.status === 'downloading'))
  const noData = points.length === 0
  const plotW = Math.max(1, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const yMax = niceMax(points.length > 0 ? Math.max(...points) : 0)
  const offset = MAX_POINTS - points.length

  const mapX = (i: number) => PAD.left + (i / (MAX_POINTS - 1)) * plotW
  const mapY = (v: number) => PAD.top + plotH - (v / yMax) * plotH

  const pathD = noData ? '' : catmullRomPath(points, offset, mapX, mapY)
  let fillD = ''
  if (pathD) {
    const fx = mapX(offset), lx = mapX(offset + Math.max(0, points.length - 1))
    const by = PAD.top + plotH
    fillD = `${pathD} L${lx.toFixed(1)},${by} L${fx.toFixed(1)},${by} Z`
  }

  const gridCount = 4
  const gridLines = Array.from({ length: gridCount + 1 }, (_, i) => (yMax / gridCount) * i)

  const idle = points.length > 0 && !hasActiveDownloads

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Speed</span>
        {idle && (
          <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[9px] font-medium text-yellow-400">Paused</span>
        )}
      </div>
      <div ref={containerRef} className="relative w-full rounded-xl bg-[#1A2232] p-2">
        {noData && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <span className="text-xs text-gray-500">No active downloads</span>
          </div>
        )}
        {width > 0 && (
          <svg width={width} height={HEIGHT} className="overflow-visible">
            <defs>
              <linearGradient id="speedFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.35} />
                <stop offset="50%" stopColor="#06b6d4" stopOpacity={0.12} />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
              <filter id="speedGlow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {gridLines.map((v) => (
              <line key={v} x1={PAD.left} y1={mapY(v)} x2={width - PAD.right} y2={mapY(v)} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" strokeWidth={1} />
            ))}

            {gridLines.map((v) => (
              <text key={v + 'l'} x={PAD.left - 6} y={mapY(v)} textAnchor="end" dominantBaseline="middle" className="fill-gray-500 text-[10px]">
                {formatSpeed(v)}
              </text>
            ))}

            {fillD && <path d={fillD} fill="url(#speedFill)" />}

            {pathD && (
              <path d={pathD} fill="none" stroke="#06b6d4" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" filter="url(#speedGlow)" />
            )}

            <text x={PAD.left} y={HEIGHT - 2} className="fill-gray-500 text-[10px]">
              -{Math.min(points.length, MAX_POINTS)}s
            </text>
            <text x={width - PAD.right} y={HEIGHT - 2} textAnchor="end" className="fill-gray-500 text-[10px]">
              now
            </text>
          </svg>
        )}
      </div>
    </div>
  )
}
