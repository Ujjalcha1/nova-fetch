import { useState, useEffect, useCallback } from 'react'
import { thumbnailService, type ThumbnailStatus } from '../services/ThumbnailService'

export interface ThumbnailState {
  status: ThumbnailStatus | 'idle'
  src: string | null
}

/**
 * useThumbnail — React hook that asynchronously loads a thumbnail URL.
 *
 * - Returns `{ status: 'idle' }` when no URL is provided.
 * - Returns `{ status: 'loading' }` while the image is fetching.
 * - Returns `{ status: 'loaded', src }` when the image is ready.
 * - Returns `{ status: 'error' }` if the image fails to load.
 *
 * Thumbnails are cached in ThumbnailService; the same URL is never
 * fetched twice within a session regardless of how many components
 * call this hook.
 */
export function useThumbnail(url: string | undefined): ThumbnailState {
  const [state, setState] = useState<ThumbnailState>(() => {
    if (!url) return { status: 'idle', src: null }
    const cached = thumbnailService.get(url)
    return cached ? { status: cached.status, src: cached.src } : { status: 'loading', src: null }
  })

  const sync = useCallback(() => {
    if (!url) return
    const entry = thumbnailService.get(url)
    if (entry) {
      setState({ status: entry.status, src: entry.src })
    }
  }, [url])

  useEffect(() => {
    if (!url) {
      setState({ status: 'idle', src: null })
      return
    }

    // Start loading (or get cached result) and register our sync callback
    const entry = thumbnailService.load(url, sync)

    // Immediately reflect whatever the service returned (could be cached)
    setState({ status: entry.status, src: entry.src })

    return () => {
      thumbnailService.unsubscribe(url, sync)
    }
  }, [url, sync])

  return state
}
