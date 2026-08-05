import crypto from 'node:crypto'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { getDeviceId } from './device'

/** Firestore collection holding one document per recorded update. */
const UPDATES_COLLECTION = 'updates'

/** Version transition details required to record an update. */
export interface TrackUpdateParams {
  /** Version the app was running before the update. */
  previousVersion: string
  /** Version the app is running after the update. */
  currentVersion: string
}

/**
 * Records an app update in the `updates` collection. Returns the document id
 * of the newly created record.
 */
export async function trackUpdate(params: TrackUpdateParams): Promise<string> {
  const updateId = crypto.randomUUID()
  await setDoc(doc(db, UPDATES_COLLECTION, updateId), {
    deviceId: getDeviceId(),
    previousVersion: params.previousVersion,
    currentVersion: params.currentVersion,
    updatedAt: serverTimestamp()
  })
  return updateId
}
