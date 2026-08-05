import os from 'node:os'
import crypto from 'node:crypto'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'
import { getDeviceId } from './device'

/** Firestore collection holding one document per tracked download. */
const DOWNLOADS_COLLECTION = 'downloads'

/** Lifecycle state of a tracked download. */
export type DownloadStatus = 'downloading' | 'completed' | 'failed'

/** Details required to begin tracking a download. */
export interface TrackDownloadParams {
  /** Optional caller-supplied id; a UUID is generated when omitted. */
  downloadId?: string
  /** The URL the download was fetched from. */
  url: string
  /** Name of the downloaded file. */
  fileName: string
  /** Size of the file in bytes (0 when unknown at start). */
  fileSize: number
  /** Kind of download, e.g. 'video', 'audio', 'http'. */
  downloadType: string
}

/**
 * Creates a download document in the `downloads` collection with status
 * "downloading". Returns the document id to pass to trackDownloadCompleted /
 * trackDownloadFailed so the same document is updated.
 */
export async function trackDownloadStart(params: TrackDownloadParams): Promise<string> {
  const downloadId = params.downloadId ?? crypto.randomUUID()
  await setDoc(doc(db, DOWNLOADS_COLLECTION, downloadId), {
    deviceId: getDeviceId(),
    hostname: os.hostname(),
    url: params.url,
    fileName: params.fileName,
    fileSize: params.fileSize,
    downloadType: params.downloadType,
    startedAt: serverTimestamp(),
    completedAt: null,
    status: 'downloading'
  })
  return downloadId
}

/**
 * Marks the download document as completed. `downloadId` must be the id
 * returned by trackDownloadStart so the same document is updated.
 */
export async function trackDownloadCompleted(downloadId: string): Promise<void> {
  await setDoc(
    doc(db, DOWNLOADS_COLLECTION, downloadId),
    { completedAt: serverTimestamp(), status: 'completed' },
    { merge: true }
  )
}

/**
 * Marks the download document as failed. `downloadId` must be the id
 * returned by trackDownloadStart so the same document is updated.
 */
export async function trackDownloadFailed(downloadId: string): Promise<void> {
  await setDoc(
    doc(db, DOWNLOADS_COLLECTION, downloadId),
    { completedAt: serverTimestamp(), status: 'failed' },
    { merge: true }
  )
}
