import type { ReactNode } from 'react'

/**
 * highlightText — splits `text` at every occurrence of `query` (case-insensitive)
 * and wraps matched segments in a <mark> span.
 *
 * Returns an array of ReactNodes ready to render inside any element.
 * If query is empty or not found, returns the original string as a single node.
 *
 * Usage:
 *   <h3>{highlightText(download.title, searchQuery)}</h3>
 */
export function highlightText(text: string, query: string): ReactNode {
  if (!query || !query.trim()) return text

  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)

  if (parts.length === 1) return text

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark
        key={i}
        className="rounded-sm bg-violet-500/25 px-0.5 text-violet-200 not-italic ring-1 ring-violet-400/30"
      >
        {part}
      </mark>
    ) : (
      part
    )
  )
}
