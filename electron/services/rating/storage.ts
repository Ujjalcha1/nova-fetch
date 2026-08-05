import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

/**
 * Rating storage.
 *
 * Remembers whether this device has already submitted a rating so the app never
 * asks for a second one. Persisted to a small JSON file in the app's userData
 * directory, following the same pattern as settings.json and update-config.json
 * (the project does not use electron-store).
 */

/** File recording the device-level "already rated" flag. */
const RATING_STATE_FILE = 'rating-state.json'

function ratingStatePath(): string {
  return path.join(app.getPath('userData'), RATING_STATE_FILE)
}

/**
 * Returns true when this device has already submitted a rating. Missing or
 * corrupt state is treated as "not rated". Never throws.
 */
export function hasUserRated(): boolean {
  try {
    const p = ratingStatePath()
    if (!fs.existsSync(p)) return false
    const saved = JSON.parse(fs.readFileSync(p, 'utf8')) as { rated?: unknown }
    return saved.rated === true
  } catch {
    return false
  }
}

/**
 * Records that this device has submitted a rating. Best-effort: a write
 * failure is logged but never thrown, so the rating flow is not blocked.
 */
export function markUserRated(): void {
  try {
    const p = ratingStatePath()
    const dir = path.dirname(p)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(p, JSON.stringify({ rated: true }, null, 2), 'utf8')
  } catch (err) {
    console.error('[RatingStorage] markUserRated failed:', err)
  }
}
