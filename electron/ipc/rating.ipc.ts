import { safeHandle } from './safeHandle'
import { shouldShowRating, saveRating } from '../services/rating/ratingService'
import type { RatingPayload, RatingResult } from '../services/rating/types'

export function registerRatingIpc(): void {
  /**
   * Renderer asks whether the rating dialog should be shown. The main process
   * owns the rating state (completed download + never rated), so the renderer
   * only renders the dialog when this returns true.
   */
  safeHandle('rating:should-show', async (): Promise<boolean> => {
    return shouldShowRating()
  })

  /** Renderer submits a rating. Never throws — failures come back in the result. */
  safeHandle('rating:submit', async (_event, payload: RatingPayload): Promise<RatingResult> => {
    return saveRating(payload)
  })
}
