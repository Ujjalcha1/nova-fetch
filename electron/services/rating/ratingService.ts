import crypto from 'node:crypto'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../analytics/firebase'
import { getDeviceId } from '../analytics/device'
import { DownloadStoreService } from '../downloader/downloadStoreService'
import { hasUserRated, markUserRated } from './storage'
import type { RatingPayload, RatingResult } from './types'

/**
 * Rating service.
 *
 * Decides when to surface the rating prompt and submits ratings to the
 * Firestore `ratings` collection. The prompt is shown at most once per device:
 * only after the first successful download has completed and only while the
 * device has never submitted a rating. Once a rating upload succeeds the device
 * is marked as rated locally (see storage.ts), so a later network failure does
 * not lose that guarantee — marking happens only after a successful upload.
 */

/** Firestore collection holding one document per submitted rating. */
const RATINGS_COLLECTION = 'ratings'

/**
 * Returns true when the rating prompt should be shown: the device has at least
 * one completed (successful) download and has never submitted a rating before.
 * Reads the persisted download history via DownloadStoreService. Never throws.
 */
export function shouldShowRating(): boolean {
  if (hasUserRated()) return false

  // DownloadStoreService.load() never throws (it falls back to [] on error).
  const downloads = DownloadStoreService.load()
  return downloads.some((entry) => {
    const status = (entry as { status?: unknown }).status
    return status === 'completed'
  })
}

/** Basic payload validation shared with the Firestore write below. */
function isValidPayload(payload: RatingPayload): boolean {
  return (
    typeof payload.downloadId === 'string' &&
    payload.downloadId.length > 0 &&
    Number.isInteger(payload.rating) &&
    payload.rating >= 1 &&
    payload.rating <= 5
  )
}

/**
 * Saves a rating to the Firestore `ratings` collection. On success the device
 * is marked as rated locally so the prompt is never shown again. Never throws:
 * failures are reported through the `error` field of the returned result, and
 * only a successful upload marks the device as rated.
 */
export async function saveRating(payload: RatingPayload): Promise<RatingResult> {
  if (!isValidPayload(payload)) {
    return { success: false, ratingId: null, error: 'Invalid rating payload' }
  }

  try {
    const ratingId = crypto.randomUUID()
    await setDoc(doc(db, RATINGS_COLLECTION, ratingId), {
      downloadId: payload.downloadId,
      rating: payload.rating,
      comment: payload.comment ?? '',
      deviceId: getDeviceId(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    // Only mark the device as rated after the upload actually succeeded.
    markUserRated()

    return { success: true, ratingId, error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Rating] submitRating failed:', message)
    return { success: false, ratingId: null, error: message }
  }
}
