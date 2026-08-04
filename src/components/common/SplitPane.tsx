import { useState, useRef, useEffect, useCallback } from 'react'

const SPLITTER_SIZE = 4
const DEFAULT_STORAGE_KEY = 'splitter-ratio-default'

type Props = {
  top: React.ReactNode
  bottom: React.ReactNode
  defaultRatio?: number
  minTopHeight?: number
  minBottomHeight?: number
  storageKey?: string
}

export default function SplitPane({
  top,
  bottom,
  defaultRatio = 0.5,
  minTopHeight = 180,
  minBottomHeight = 180,
  storageKey = DEFAULT_STORAGE_KEY
}: Props): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  // Load saved ratio from localStorage, falling back to default
  const [ratio, setRatio] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved !== null) {
        const parsed = parseFloat(saved)
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) return parsed
      }
    } catch { /* localStorage unavailable */ }
    return defaultRatio
  })

  // Persist ratio to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(ratio))
    } catch { /* localStorage unavailable */ }
  }, [ratio, storageKey])

  // Track container size via ResizeObserver for window resize handling
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Clamp ratio to respect min pane heights
  const clampedRatio = useCallback(
    (rawRatio: number, totalHeight: number): number => {
      const available = totalHeight - SPLITTER_SIZE
      if (available <= minTopHeight + minBottomHeight) return rawRatio // can't satisfy mins
      const minRatio = minTopHeight / available
      const maxRatio = 1 - minBottomHeight / available
      return Math.max(minRatio, Math.min(maxRatio, rawRatio))
    },
    [minTopHeight, minBottomHeight]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      setIsDragging(true)
      document.body.style.userSelect = 'none'
    },
    []
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const y = e.clientY - rect.top
      const rawRatio = Math.max(0, Math.min(1, y / rect.height))
      const finalRatio = clampedRatio(rawRatio, rect.height)
      setRatio(finalRatio)
    },
    [isDragging, clampedRatio]
  )

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
    document.body.style.userSelect = ''
  }, [])

  const handleDoubleClick = useCallback(() => {
    setRatio(defaultRatio)
  }, [defaultRatio])

  // Calculate pane heights
  const availableHeight = Math.max(0, containerHeight - SPLITTER_SIZE)
  const safeRatio = clampedRatio(ratio, containerHeight)
  const topHeight = Math.round(availableHeight * safeRatio)
  const bottomHeight = Math.max(0, availableHeight - topHeight)

  return (
    <div
      ref={containerRef}
      className="flex h-full flex-col overflow-hidden"
    >
      {/* Top pane */}
      <div className="shrink-0 overflow-hidden" style={{ height: topHeight }}>
        {top}
      </div>

      {/* Splitter bar */}
      <div
        className="relative shrink-0 cursor-ns-resize"
        style={{ height: SPLITTER_SIZE }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      >
        {/* Hover/drag highlight stripe */}
        <div
          className={`absolute inset-0 transition-colors duration-150 ${
            isDragging
              ? 'bg-violet-500/60'
              : 'bg-white/5 hover:bg-white/15'
          }`}
        />
        {/* Center grip dots */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="flex items-center gap-[3px]">
            <span
              className={`block h-[3px] w-[3px] rounded-full transition-colors duration-150 ${
                isDragging ? 'bg-white' : 'bg-white/30'
              }`}
            />
            <span
              className={`block h-[3px] w-[3px] rounded-full transition-colors duration-150 ${
                isDragging ? 'bg-white' : 'bg-white/30'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Bottom pane */}
      <div className="flex-1 overflow-hidden" style={{ height: bottomHeight }}>
        {bottom}
      </div>
    </div>
  )
}
