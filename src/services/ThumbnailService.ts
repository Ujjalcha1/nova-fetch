/**
 * ThumbnailService — singleton in-memory thumbnail loader/cache.
 *
 * Loads thumbnail images asynchronously via HTMLImageElement (off the main
 * thread). Caches results by URL so the same image is never fetched twice
 * within a session. Notifies all registered listeners when loading completes.
 */

export type ThumbnailStatus = 'loading' | 'loaded' | 'error'

type Listener = () => void

interface CacheEntry {
  status: ThumbnailStatus
  src: string | null
}

class ThumbnailService {
  /** In-memory cache: url → current status + resolved src */
  private cache = new Map<string, CacheEntry>()

  /** Listeners waiting for a URL to finish loading */
  private listeners = new Map<string, Set<Listener>>()

  /**
   * Request a thumbnail URL to be loaded.
   * Returns the current cache entry immediately (may be 'loading' on first call).
   * Calls `listener` once when the status changes (load or error).
   */
  load(url: string, listener: Listener): CacheEntry {
    const existing = this.cache.get(url)

    // Return cached result immediately — do not re-fetch
    if (existing) {
      if (existing.status !== 'loading') {
        // Already settled — invoke listener asynchronously so callers
        // can set up state before receiving the notification.
        Promise.resolve().then(listener)
      } else {
        this.subscribe(url, listener)
      }
      return existing
    }

    // First request for this URL — start loading
    const entry: CacheEntry = { status: 'loading', src: null }
    this.cache.set(url, entry)
    this.subscribe(url, listener)
    this.fetch(url)

    return entry
  }

  /** Read the current cache entry for a URL without triggering a load */
  get(url: string): CacheEntry | undefined {
    return this.cache.get(url)
  }

  /** Remove a listener (call on component unmount) */
  unsubscribe(url: string, listener: Listener): void {
    this.listeners.get(url)?.delete(listener)
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private subscribe(url: string, listener: Listener): void {
    if (!this.listeners.has(url)) {
      this.listeners.set(url, new Set())
    }
    this.listeners.get(url)!.add(listener)
  }

  private notify(url: string): void {
    this.listeners.get(url)?.forEach((fn) => fn())
  }

  private fetch(url: string): void {
    const img = new Image()

    img.onload = () => {
      this.cache.set(url, { status: 'loaded', src: url })
      this.notify(url)
    }

    img.onerror = () => {
      this.cache.set(url, { status: 'error', src: null })
      this.notify(url)
    }

    img.src = url
  }
}

// Export a single shared instance for the whole renderer process
export const thumbnailService = new ThumbnailService()
