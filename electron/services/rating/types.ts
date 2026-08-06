/**
 * Rating service types.
 *
 * Shared data shapes for the download rating system: the payload submitted by
 * clients, the Firestore document persisted for each rating, and the structured
 * result returned by rating operations (which never throw).
 */

/** Star rating from 1 (worst) to 5 (best). */
export type RatingValue = 1 | 2 | 3 | 4 | 5

/** Payload submitted when a user rates a download. */
export interface RatingPayload {
  /** Id of the download being rated. */
  downloadId: string
  /** Star rating from 1 to 5. */
  rating: RatingValue
  /** Optional free-form feedback comment. */
  comment?: string
}

/** Firestore document shape persisted for a rating. */
export interface RatingData extends RatingPayload {
  /** Persistent device id of the rater, attached server-side. */
  deviceId: string
  /** ISO timestamp when the rating was submitted. */
  createdAt: string
  /** ISO timestamp of the last update to the rating. */
  updatedAt: string
}

/** Structured result returned by rating operations. Never throws. */
export interface RatingResult {
  /** Whether the rating was saved successfully. */
  success: boolean
  /** Persisted document id of the rating, when available. */
  ratingId: string | null
  /** Non-null when the rating could not be saved (validation, network, etc.). */
  error: string | null
}
